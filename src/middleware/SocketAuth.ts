import jwt from 'jsonwebtoken';
import type { Socket } from 'socket.io';
import { config } from '../config/config';
import Logging from '../library/Logging';
import type { AccessTokenPayload } from '../types/auth';

// Middleware de Socket.IO que comprueba que la conexion trae un access token valido.
// Es el equivalente de VerifyToken, pero para sockets: el token llega en el handshake
// (cuando el cliente abre la conexion), por ejemplo:   io(url, { auth: { token } })
//
// Si es valido, deja el usuario en socket.data.user. Si no, rechaza la conexion.
export const SocketAuth = (socket: Socket, next: (error?: Error) => void) => {
    const token = socket.handshake.auth?.token;

    // Sin token no hay sesion
    if (typeof token !== 'string' || token.length === 0) {
        Logging.warning('Socket rechazado: falta el token');
        return next(new Error('Falta el token'));
    }

    try {
        // jwt.verify comprueba la firma y que no haya caducado. Un refresh token no vale: se firma con otro secreto
        const payload = jwt.verify(token, config.jwt.secret) as AccessTokenPayload;

        // Solo guardamos el id: es lo que hace falta para meter al usuario en su sala
        socket.data.user = { id: payload.sub };

        next();
    } catch (error) {
        // error.message dice por que falla: "jwt expired", "invalid signature"...
        Logging.warning(`Socket rechazado: ${(error as Error).message}`);
        next(new Error('Token no válido'));
    }
};

export default SocketAuth;
