import WorkoutSession from '../models/WorkoutSession';

// Resultado del progreso: lo que devuelve GET /users/me/progress
export type Progress = {
    totalSessions: number;
    trainedDays: string[];
    exercises: { exercise: { _id: string; name: string }; timesDone: number }[];
};

// Calcula el progreso del usuario a partir de sus entrenamientos.
// Solo se piden los entrenamientos del usuario (filtro por user), asi nunca se cuentan los de otros.
export const getProgress = async (userId: string): Promise<Progress> => {

    // Los ejercicios vienen completos (populate) para poder devolver su nombre
    const sessions = await WorkoutSession.find({ user: userId }).populate('exercises.exercise');

    // Dias entrenados: la fecha de cada entrenamiento sin la hora (AAAA-MM-DD).
    // Un Set no guarda repetidos, asi un dia con varios entrenamientos solo cuenta una vez.
    const days = new Set<string>();

    // Ejercicios hechos: por cada ejercicio, su nombre y en cuantos entrenamientos ha salido
    const counts = new Map<string, { exercise: { _id: string; name: string }; timesDone: number }>();

    for (const session of sessions) {

        days.add(session.startedAt.toISOString().slice(0, 10));

        for (const item of session.exercises) {

            // Los ejercicios borrados del catalogo (borrado logico) no se muestran
            const exercise = item.exercise as unknown as { _id: string; name: string; isDeleted: boolean } | null;
            if (!exercise || exercise.isDeleted) continue;

            const id = String(exercise._id);
            const entry = counts.get(id) ?? { exercise: { _id: id, name: exercise.name }, timesDone: 0 };
            entry.timesDone += 1;
            counts.set(id, entry);

        }

    }

    return {
        totalSessions: sessions.length,
        // Los dias van ordenados del mas antiguo al mas reciente
        trainedDays: [...days].sort(),
        // Los ejercicios van de los mas hechos a los menos
        exercises: [...counts.values()].sort((a, b) => b.timesDone - a.timesDone)
    };

};

export default { getProgress };
