import { NextFunction, Request, Response } from 'express';
import WorkoutService from '../services/WorkoutService';

// Controladores de las rutinas del propio usuario (/users/me/workouts).
// El dueño siempre es el usuario del token (req.user.id), nunca un dato que llegue en la peticion.
// Una rutina de otro usuario, borrada o inexistente responde igual: 404.

// Lista las rutinas del usuario
const listMyWorkouts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const workouts = await WorkoutService.listMyWorkouts(req.user!.id);
        res.status(200).json({ workouts });
    } catch (error) {
        next(error);
    }
};

// Crea una rutina que pertenece al usuario
const createMyWorkout = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const workout = await WorkoutService.createWorkout(req.body, req.user!.id);
        res.status(201).json({ workout });
    } catch (error) {
        next(error);
    }
};

// Devuelve una rutina del usuario con sus ejercicios completos
const readMyWorkout = async (req: Request<{ workoutId: string }>, res: Response, next: NextFunction) => {
    try {
        const workout = await WorkoutService.getMyWorkout(req.user!.id, req.params.workoutId);

        if (workout) {
            res.status(200).json({ workout });
        } else {
            res.status(404).json({ message: 'not found' });
        }
    } catch (error) {
        next(error);
    }
};

// Modifica una rutina del usuario: nombre, ejercicios (orden, series y repeticiones) y dias
const updateMyWorkout = async (req: Request<{ workoutId: string }>, res: Response, next: NextFunction) => {
    try {
        const workout = await WorkoutService.updateWorkout(req.params.workoutId, req.body, req.user!.id);

        if (workout) {
            res.status(200).json({ workout });
        } else {
            res.status(404).json({ message: 'not found' });
        }
    } catch (error) {
        next(error);
    }
};

// Borrado logico de una rutina del usuario
const deleteMyWorkout = async (req: Request<{ workoutId: string }>, res: Response, next: NextFunction) => {
    try {
        const workout = await WorkoutService.softDeleteMyWorkout(req.user!.id, req.params.workoutId);

        if (workout) {
            res.status(204).send();
        } else {
            res.status(404).json({ message: 'not found' });
        }
    } catch (error) {
        next(error);
    }
};

export default { listMyWorkouts, createMyWorkout, readMyWorkout, updateMyWorkout, deleteMyWorkout };
