import mongoose, { HydratedDocument } from 'mongoose';
import WorkoutSession, { IWorkoutSession } from '../models/WorkoutSession';
import { buildPageInfo, getSkip } from '../utils/pagination';
import { assertExercisesExist, assertWorkoutOfUser } from '../utils/references';

// Un ejercicio del entrenamiento tal y como llega en el body: el id del ejercicio (texto) y sus series
export type SessionExerciseInput = { exercise: string; sets: { reps: number; weight: number }[] };

// Datos necesarios para guardar un entrenamiento. El usuario no viene en el body: es el del token
export type NewSession = {
    workout?: string;
    startedAt: Date;
    finishedAt: Date;
    exercises?: SessionExerciseInput[];
};

// Tipo de un documento de entrenamiento ya cargado por Mongoose
type SessionDocument = HydratedDocument<IWorkoutSession>;

// Guarda un entrenamiento terminado del usuario. La app lo envia entero al finalizar.
export const createSession = async (data: NewSession, userId: string): Promise<SessionDocument> => {

    // La rutina (si la hay) tiene que ser del usuario, y los ejercicios tienen que existir; si no, 404
    if (data.workout) {
        await assertWorkoutOfUser(data.workout, userId);
    }
    await assertExercisesExist((data.exercises ?? []).map(({ exercise }) => exercise));

    const session = new WorkoutSession({
        ...data,
        user: new mongoose.Types.ObjectId(userId),
        // Convertimos los ids de los ejercicios (texto) a ObjectId
        exercises: (data.exercises ?? []).map(({ exercise, sets }) => ({ exercise: new mongoose.Types.ObjectId(exercise), sets }))
    });

    return session.save();

};

// Lista los entrenamientos del usuario, del mas reciente al mas antiguo, con paginacion
export const listSessions = async (userId: string, page: number, limit: number) => {

    const filter = { user: userId };

    const [sessions, total] = await Promise.all([
        WorkoutSession.find(filter).sort({ startedAt: -1, _id: -1 }).skip(getSkip(page, limit)).limit(limit).populate('exercises.exercise'),
        WorkoutSession.countDocuments(filter)
    ]);

    return { sessions, pagination: buildPageInfo(page, limit, total) };

};

// Busca un entrenamiento por su ID, pero solo si es del usuario.
// Si es de otro usuario devuelve null y el controlador responde 404.
export const getSessionById = (userId: string, sessionId: string): Promise<SessionDocument | null> => {

    return WorkoutSession.findOne({ _id: sessionId, user: userId }).populate('exercises.exercise');

};

export default { createSession, listSessions, getSessionById };
