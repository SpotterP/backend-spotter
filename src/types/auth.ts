import type { UserRole } from '../models/User';

// Lo que guardamos dentro del access token (el "payload" del JWT).
// sub (subject) es el id del usuario y role su rol. La librería añade además iat (cuándo se
// firmó) y exp (cuándo caduca).
// Ojo: el payload de un JWT no está cifrado, solo firmado. Cualquiera puede leerlo (por ejemplo
// en jwt.io), así que nunca se pone aquí la contraseña ni nada privado.
export interface AccessTokenPayload {
    sub: string;
    role: UserRole;

    // Version de tokens del usuario cuando se firmo. VerifyToken la compara con la base: si no
    // coincide, la sesion se cerro y el token ya no vale. Opcional porque los tokens firmados
    // antes de existir este campo no lo llevan, y cuentan como version 0.
    tokenVersion?: number;
}

// Lo que guardamos dentro del refresh token: solo el id del usuario.
// El rol no hace falta, porque al renovar se vuelve a leer el usuario de la base de datos.
export interface RefreshTokenPayload {
    sub: string;

    // Version de tokens con la que se firmo; /auth/refresh la compara con la base antes de
    // renovar, asi cerrar sesion tambien corta la renovacion.
    tokenVersion?: number;
}

// El usuario con sesión que el middleware VerifyToken deja en req.user
export interface AuthUser {
    id: string;
    role: UserRole;
}
