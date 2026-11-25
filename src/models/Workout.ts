import mongoose, { Document, Schema } from 'mongoose';

// Dias de la semana en los que se puede realizar una rutina.
export const DAYS_OF_WEEK = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const;
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

// Un ejercicio dentro de una rutina: referencia al catalogo y sus propias series y repeticiones.
// Las series y repeticiones son de la rutina, no del ejercicio: Sentadilla puede ser 4x10 en una rutina y 5x5 en otra.
export interface IWorkoutExercise {

    exercise: mongoose.Types.ObjectId;

    sets: number;

    reps: number;

}

// Definimos los datos que puede tener una rutina.
export interface IWorkout {

    // Usuario dueño de la rutina
    owner: mongoose.Types.ObjectId;

    name: string;

    description?: string;

    // Dias de la semana en los que se hace la rutina (para el calendario). Puede estar vacio
    days: DayOfWeek[];

    // Ejercicios de la rutina con sus series y repeticiones. El orden del array es el orden de la rutina
    exercises: IWorkoutExercise[];

    // Marca si la rutina esta borrada. Las rutinas borradas no se eliminan fisicamente de la base de datos
    isDeleted: boolean;

    deletedAt?: Date;

}

// Esta interfaz junta los datos de la rutina con las propiedades de un documento de MongoDB
export interface IWorkoutModel extends IWorkout, Document {}

// Definimos el esquema que van a seguir las rutinas en la base de datos
const WorkoutSchema: Schema = new Schema(

    {
        // El dueño es obligatorio y es una referencia al modelo User
        owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },

        // El nombre es obligatorio y quitamos los espacios del principio y del final
        name: { type: String, required: true, trim: true },

        // La descripcion es opcional y quitamos los espacios del principio y del final
        description: { type: String, trim: true },

        // Los dias son opcionales (por defecto, lista vacia) y cada uno tiene que ser uno de los definidos arriba
        days: { type: [{ type: String, enum: DAYS_OF_WEEK }], default: [] },

        // Cada ejercicio de la rutina guarda la referencia al catalogo y sus series y repeticiones.
        // _id: false porque cada elemento se identifica por su ejercicio, no necesita id propio
        exercises: [
            {
                _id: false,
                exercise: { type: Schema.Types.ObjectId, ref: 'Exercise', required: true },
                sets: { type: Number, required: true, min: 1 },
                reps: { type: Number, required: true, min: 1 }
            }
        ],

        isDeleted: { type: Boolean, default: false },

        deletedAt: { type: Date, default: null }

    },

    {
        timestamps: true,

        versionKey: false

    }

);

// Indice unico parcial del nombre por usuario: dos usuarios pueden tener una rutina con el mismo nombre,
// pero el mismo usuario no. Solo cuentan las rutinas no borradas: una rutina borrada logicamente
// libera su nombre. El nombre va primero para que, si hay duplicado, el error 409 diga "name ya existe".
// Es importante definirlo con schema.index(): Mongoose ignora partialFilterExpression
// cuando se pone como opcion del campo.
WorkoutSchema.index({ name: 1, owner: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });

// Creamos y exportamos el modelo Workout a partir del esquema
export default mongoose.model<IWorkoutModel>('Workout', WorkoutSchema);
