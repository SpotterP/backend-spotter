import { NextFunction, Request, Response } from 'express';
import Workout from '../models/Workout';

// Middleware para las rutas de una rutina concreta (/workouts/:workoutId).
// Deja pasar a un ADMIN con cualquier rutina, y a un USER solo si la rutina es suya.
// Va despues de VerifyToken (que rellena req.user) y de ValidateId.
export const RequireOwnerOrAdmin = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Falta el token' });
        }

        // El ADMIN puede tocar las rutinas de todo el mundo
        if (req.user.role === 'ADMIN') {
            return next();
        }

        // Buscamos la rutina para ver de quien es
        const workout = await Workout.findById(req.params.workoutId).select('owner');

        // Si la rutina no existe seguimos: el controlador responde 404
        // Si existe pero es de otro usuario, 403
        if (workout && String(workout.owner) !== req.user.id) {
            return res.status(403).json({ message: 'Solo puedes modificar tus propias rutinas' });
        }

        next();
    } catch (error) {
        next(error);
    }
};

export default RequireOwnerOrAdmin;
