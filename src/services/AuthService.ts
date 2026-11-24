import jwt from 'jsonwebtoken';
import { HydratedDocument } from 'mongoose';
import { config } from '../config/config';
import User, { IUser, IUserModel } from '../models/User';
import type { AccessTokenPayload, RefreshTokenPayload } from '../types/auth';
import { verifyPassword } from '../utils/password';

// Firma el access token: el que se envia en cada peticion en la cabecera Authorization.
// Dura poco (JWT_EXPIRES_IN, 15 minutos por defecto) para que, si alguien lo roba, le sirva poco tiempo.
// jwt.sign añade solo el claim exp a partir de expiresIn.
// Lleva la version de tokens del usuario: al cerrar sesion sube esa version y este token deja
// de valer en la siguiente peticion, sin esperar a que caduque.
export const signAccessToken = (user: IUserModel) => {
    const payload: AccessTokenPayload = { sub: String(user._id), role: user.role, tokenVersion: user.tokenVersion ?? 0 };

    return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
};

// Firma el refresh token: solo sirve para pedir un access token nuevo en POST /auth/refresh.
// Dura mas (JWT_REFRESH_EXPIRES_IN, 7 dias por defecto) y se firma con otro secreto, asi que
// no se puede usar como access token. Tambien lleva la version de tokens: cerrar sesion lo corta.
export const signRefreshToken = (user: IUserModel) => {
    const payload: RefreshTokenPayload = { sub: String(user._id), tokenVersion: user.tokenVersion ?? 0 };

    return jwt.sign(payload, config.jwt.refreshSecret, { expiresIn: config.jwt.refreshExpiresIn });
};

// Registra un usuario nuevo. Siempre se crea con el rol user (el valor por defecto del modelo).
// Si el email ya existe, MongoDB lanza un error 11000 y el ErrorHandler responde 409.
export const register = (data: Pick<IUser, 'name' | 'email' | 'password'>) => {
    const user = new User({ name: data.name, email: data.email, password: data.password });

    return user.save();
};

// Comprueba el email y la contraseña. Si son correctos devuelve los dos tokens y el usuario;
// si no, devuelve null y el controlador responde 401.
// Los usuarios borrados logicamente no pueden entrar: se buscan como si no existieran.
export const login = async (email: string, password: string) => {
    // La contraseña tiene select: false en el modelo, asi que hay que pedirla a proposito
    const user = await User.findOne({ email: email.toLowerCase(), isDeleted: false }).select('+password');

    // Si el email no existe o la contraseña no coincide, devolvemos lo mismo (null).
    // Asi el que llama no puede saber que emails estan registrados, ni cuales estan borrados.
    if (!user || !(await verifyPassword(password, user.password))) {
        return null;
    }

    return {
        token: signAccessToken(user),
        refreshToken: signRefreshToken(user),
        // toJSON() quita la contraseña del usuario antes de devolverlo
        user: user.toJSON()
    };
};

// Login del backoffice: el mismo email y la misma contraseña que /auth/login, pero solo entra un ADMIN.
// Reutiliza login() para no repetir la comprobacion de las credenciales y despues mira el rol.
// Devuelve null si las credenciales no son correctas, 'FORBIDDEN' si son correctas pero el usuario
// no es ADMIN, y la sesion ({ token, refreshToken, user }) si es ADMIN.
export const adminLogin = async (email: string, password: string) => {
    const session = await login(email, password);

    if (!session) {
        return null;
    }

    // El rol se lee del usuario que acabamos de cargar de la base de datos, no de lo que manda el cliente
    if (session.user.role !== 'ADMIN') {
        return 'FORBIDDEN' as const;
    }

    return session;
};

// Recibe un refresh token y, si es valido, devuelve un access token nuevo.
// Si el token esta caducado o mal firmado, jwt.verify lanza un error y el ErrorHandler responde 401.
// Si el usuario ya no existe, o esta borrado logicamente, devuelve null y el controlador responde 401.
// Si el usuario cerro sesion despues de firmarlo, devuelve 'REVOKED' y tambien responde 401.
export const refresh = async (refreshToken: string) => {
    const payload = jwt.verify(refreshToken, config.jwt.refreshSecret) as RefreshTokenPayload;

    // Volvemos a leer el usuario de la base de datos: asi el token nuevo lleva su rol actual.
    // Exigimos isDeleted: false para que borrar un usuario le corte tambien la renovacion.
    const user = await User.findOne({ _id: payload.sub, isDeleted: false });

    if (!user) {
        return null;
    }

    // La version del token tiene que ser la del usuario: si cerro sesion, ya no lo es.
    // Los tokens firmados antes de existir este campo no lo llevan y cuentan como version 0.
    if ((payload.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
        return 'REVOKED' as const;
    }

    return { token: signAccessToken(user) };
};

// Cierra la sesion del usuario: sube su version de tokens, asi el access token y el refresh token
// que ya existian dejan de valer en la siguiente peticion. Eso incluye los de otros dispositivos:
// cerrar sesion en uno cierra la sesion en todos. Devuelve null si el usuario ya no existe.
export const logout = (userId: string): Promise<HydratedDocument<IUserModel> | null> => {

    return User.findOneAndUpdate({ _id: userId, isDeleted: false }, { $inc: { tokenVersion: 1 } }, { new: true });

};

export default { register, login, adminLogin, refresh, logout };
