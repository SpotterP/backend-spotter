import Exercise from '../models/Exercise';
import User from '../models/User';
import Workout from '../models/Workout';

// Comprobaciones de que las cosas a las que apunta una peticion existen de verdad
// (un ejercicio, una rutina, un usuario). Si no existen, lanzan un error con status 404
// y el ErrorHandler lo convierte en la respuesta, con el mensaje que le damos aqui.

const notFound = (message: string) => Object.assign(new Error(message), { status: 404 });

// Todos los ejercicios de la lista tienen que existir en el catalogo
export const assertExercisesExist = async (exerciseIds: string[]) => {
    // Quitamos los repetidos para poder contarlos
    const ids = [...new Set(exerciseIds)];

    if (ids.length === 0) {
        return;
    }

    const found = await Exercise.countDocuments({ _id: { $in: ids } });

    if (found !== ids.length) {
        throw notFound('El ejercicio no existe');
    }
};

// El usuario tiene que existir y no estar borrado
export const assertUserExists = async (userId: string) => {
    if (!(await User.exists({ _id: userId, isDeleted: false }))) {
        throw notFound('El usuario no existe');
    }
};

// La rutina tiene que existir, ser de ese usuario y no estar borrada
export const assertWorkoutOfUser = async (workoutId: string, userId: string) => {
    if (!(await Workout.exists({ _id: workoutId, owner: userId, isDeleted: false }))) {
        throw notFound('La rutina no existe');
    }
};
