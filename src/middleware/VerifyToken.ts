import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { config } from '../config/config';
import User from '../models/User';
import type { AccessTokenPayload } from '../types/auth';

// Middleware que comprueba que la peticion trae un access token valido.
// Se pone delante de las rutas protegidas (ver server.ts).
//
// El token llega en la cabecera:   Authorization: Bearer eyJhbGciOi...
//
// Si es valido, deja el usuario en req.user para los siguientes middlewares y controladores.
//
// Ademas de la firma y la caducidad, lee al usuario de la base y comprueba dos cosas: la version
// de tokens (al cerrar sesion sube y los tokens firmados antes dejan de valer aqui, al instante)
// y el rol (si a alguien se le quita ADMIN, deja de serlo en la siguiente peticion). Esa consulta
// cuesta una lectura por peticion protegida, y es el precio de que un token robado muera al
// cerrar sesion y no a los 15 minutos. De paso deja fuera a los usuarios borrados.
export const VerifyToken = async (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;

    // Sin cabecera, o con una que no empieza por "Bearer ", no hay sesion.
    // El code es estable: los clientes deciden con el si renuevan la sesion, sin mirar el mensaje
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Falta el token', code: 'TOKEN_MISSING' });
    }

    // Nos quedamos con lo que va despues de "Bearer "
    const token = header.slice('Bearer '.length);

    try {
        // jwt.verify comprueba la firma con nuestro secreto y que el token no haya caducado (exp).
        // Si algo falla lanza un error: TokenExpiredError si ha caducado, JsonWebTokenError si
        // la firma no es correcta o el token esta mal formado
        const payload = jwt.verify(token, config.jwt.secret) as AccessTokenPayload;

        // Buscamos solo lo que hace falta comprobar: la version de tokens y el rol.
        // El rol se lee de aqui, no del token, para que quitarselo a alguien tenga efecto en el
        // acto y no cuando caduque su access token (hasta 15 minutos despues).
        const user = await User.findOne({ _id: payload.sub, isDeleted: false }).select('tokenVersion role');

        // La version del token tiene que ser la del usuario. Si no coincide es que cerro sesion
        // despues de firmarlo; si no hay usuario, es que ya no existe o esta borrado.
        // Los tokens firmados antes de existir este campo no lo llevan y cuentan como version 0.
        if (!user || (payload.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
            // SESSION_REVOKED: el token esta bien firmado y no ha caducado, pero la sesion ya no sirve.
            // El cliente no puede arreglarlo renovando: tiene que volver a entrar
            return res.status(401).json({ message: 'La sesión ya no es válida', code: 'SESSION_REVOKED' });
        }

        // El rol sale de la base, no del token: el token solo dice quien eres, no lo que puedes hacer.
        req.user = { id: payload.sub, role: user.role };

        next();
    } catch (error) {
        // El ErrorHandler convierte los errores de JWT en un 401
        next(error);
    }
};

export default VerifyToken;
