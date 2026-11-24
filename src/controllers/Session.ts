import { NextFunction, Request, Response } from 'express';
import SessionService from '../services/SessionService';
import { emitToUser } from '../socket';

// Controladores de los entrenamientos del propio usuario (/users/me/sessions).
// El usuario siempre es el del token (req.user.id).

// Guarda un entrenamiento terminado
const createSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const session = await SessionService.createSession(req.body, req.user!.id);

        // Avisamos en tiempo real a las conexiones abiertas de este usuario (Socket.IO)
        emitToUser(req.user!.id, 'session:created', session);

        // 201: se ha creado un recurso nuevo
        res.status(201).json({ session });
    } catch (error) {
        next(error);
    }
};

// Lista los entrenamientos del usuario con paginacion
const listSessions = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // ValidateQuery ya ha comprobado y convertido page y limit
        const { page, limit } = res.locals.query;

        const result = await SessionService.listSessions(req.user!.id, page, limit);

        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

// Devuelve un entrenamiento con sus ejercicios. Si es de otro usuario o no existe, 404
const readSession = async (req: Request<{ sessionId: string }>, res: Response, next: NextFunction) => {
    try {
        const session = await SessionService.getSessionById(req.user!.id, req.params.sessionId);

        if (session) {
            res.status(200).json({ session });
        } else {
            res.status(404).json({ message: 'not found' });
        }
    } catch (error) {
        next(error);
    }
};

export default { createSession, listSessions, readSession };
