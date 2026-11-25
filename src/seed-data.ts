import { IExercise } from './models/Exercise';
import { IUser } from './models/User';
import { IWorkout } from './models/Workout';

// Datos de ejemplo para llenar la base de datos del gimnasio.
// Los nombres de los ejercicios y de las rutinas son inventados.

// Usuarios para iniciar sesión en la aplicación: uno de cada rol.
// Las contraseñas están sin cifrar y son públicas a propósito (ver el README):
// el hook pre-save del modelo User las cifra al guardarlas.
export const usersSeed: IUser[] = [
    {
        name: 'Admin',
        email: 'admin@example.com',
        password: 'seminari7',
        role: 'ADMIN'
    },
    {
        name: 'Usuario',
        email: 'user@example.com',
        password: 'seminari7',
        role: 'USER'
    }
];

// El campo 'isDeleted' no se indica aquí: el esquema lo pone en false por defecto.
export type ExerciseSeed = Omit<IExercise, 'isDeleted' | 'deletedAt'>;

// Ejercicios repartidos entre todas las categorías de EXERCISE_CATEGORIES.
// El catalogo solo tiene nombre y categoria: las series y repeticiones las pone cada rutina.
export const exercisesSeed: ExerciseSeed[] = [
    {
        name: 'Press de banca',
        category: 'CHEST'
    },
    {
        name: 'Aperturas con mancuernas',
        category: 'CHEST'
    },
    {
        name: 'Dominadas',
        category: 'BACK'
    },
    {
        name: 'Remo con barra',
        category: 'BACK'
    },
    {
        name: 'Sentadilla',
        category: 'LEGS'
    },
    {
        name: 'Prensa de piernas',
        category: 'LEGS'
    },
    {
        name: 'Press militar',
        category: 'SHOULDERS'
    },
    {
        name: 'Elevaciones laterales',
        category: 'SHOULDERS'
    },
    {
        name: 'Curl de bíceps',
        category: 'ARMS'
    },
    {
        name: 'Fondos en paralelas',
        category: 'ARMS'
    },
    {
        name: 'Plancha abdominal',
        category: 'CORE'
    },
    {
        name: 'Cinta a intervalos',
        category: 'CARDIO'
    }
];

// Las rutinas son del usuario 'user@example.com' (el seed pone el dueño al insertarlas).
// Cada ejercicio de la rutina dice su nombre, que el script del seed cambia por el id que MongoDB
// ha dado al ejercicio, y sus propias series y repeticiones. El orden de la lista es el orden de la rutina.
// Los campos 'owner', 'exercises' e 'isDeleted' no se indican aquí: el seed o el esquema los ponen.
export type WorkoutSeed = Omit<IWorkout, 'owner' | 'exercises' | 'isDeleted' | 'deletedAt'> & {
    exerciseItems: { name: string; sets: number; reps: number }[];
};

export const workoutsSeed: WorkoutSeed[] = [
    {
        name: 'Día de pecho',
        description: 'Empuje con barra y mancuernas, y fondos para terminar de cansar el pecho.',
        days: ['MONDAY'],
        exerciseItems: [
            { name: 'Press de banca', sets: 4, reps: 10 },
            { name: 'Aperturas con mancuernas', sets: 3, reps: 12 },
            { name: 'Fondos en paralelas', sets: 3, reps: 10 }
        ]
    },
    {
        name: 'Día de espalda',
        description: 'Tirón vertical y horizontal, con bíceps al final.',
        days: ['TUESDAY'],
        exerciseItems: [
            { name: 'Dominadas', sets: 4, reps: 8 },
            { name: 'Remo con barra', sets: 4, reps: 10 },
            { name: 'Curl de bíceps', sets: 3, reps: 12 }
        ]
    },
    {
        name: 'Pierna',
        description: 'Sentadilla y prensa, con plancha para cerrar el entrenamiento.',
        days: ['MONDAY', 'THURSDAY'],
        exerciseItems: [
            { name: 'Sentadilla', sets: 4, reps: 10 },
            { name: 'Prensa de piernas', sets: 3, reps: 12 },
            { name: 'Plancha abdominal', sets: 3, reps: 1 }
        ]
    },
    {
        name: 'Día de hombro y brazos',
        description: 'Hombro completo y un bloque corto de brazos.',
        days: ['FRIDAY'],
        exerciseItems: [
            { name: 'Press militar', sets: 4, reps: 8 },
            { name: 'Elevaciones laterales', sets: 3, reps: 15 },
            { name: 'Curl de bíceps', sets: 3, reps: 12 },
            { name: 'Fondos en paralelas', sets: 3, reps: 10 }
        ]
    },
    {
        // Sin días: no sale en el calendario hasta que el usuario le ponga alguno
        name: 'Cardio y core',
        description: 'Sesión corta de cardio y abdomen. Los minutos de cardio van en las series.',
        days: [],
        exerciseItems: [
            { name: 'Cinta a intervalos', sets: 20, reps: 1 },
            { name: 'Plancha abdominal', sets: 3, reps: 1 }
        ]
    }
];
