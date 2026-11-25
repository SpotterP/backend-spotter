import { NextFunction, Request, Response } from 'express';
import ProgressService from '../services/ProgressService';

// Controlador del progreso del propio usuario (GET /users/me/progress).
// El usuario siempre es el del token (req.user.id).
const readProgress = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const progress = await ProgressService.getProgress(req.user!.id);

        res.status(200).json({ progress });
    } catch (error) {
        next(error);
    }
};

export default { readProgress };
