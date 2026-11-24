import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { config } from './config/config';
import Logging from './library/Logging';
import { SocketAuth } from './middleware/SocketAuth';

// Socket.IO: avisos en tiempo real. Se monta sobre el mismo servidor HTTP de Express (mismo puerto).
// Cada usuario que se conecta entra en su sala personal "user:<id>", y asi solo recibe sus avisos.

let io: Server | undefined;

// Crea el servidor de Socket.IO. Se llama una vez desde server.ts
export const initSocket = (server: HttpServer) => {
    io = new Server(server, { cors: { origin: config.cors.origin } });

    // Antes de aceptar la conexion se comprueba el token
    io.use(SocketAuth);

    io.on('connection', (socket) => {
        const userId = socket.data.user.id;

        // Metemos al usuario en su sala personal
        socket.join(`user:${userId}`);

        Logging.info(`Socket conectado: usuario ${userId}`);
    });

    return io;
};

// Manda un evento solo a las conexiones abiertas de un usuario.
// Si ese usuario no tiene ninguna conexion abierta, no pasa nada.
export const emitToUser = (userId: string, event: string, data: unknown) => {
    // Si el servidor de sockets todavia no se ha creado, no hay a quien avisar
    if (io) {
        io.to(`user:${userId}`).emit(event, data);
    }
};
