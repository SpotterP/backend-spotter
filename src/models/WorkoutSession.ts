import mongoose, { Document, Schema } from 'mongoose';

// Una serie que ha hecho el usuario: cuantas repeticiones y con cuanto peso (en kg)
export interface ISessionSet {

    reps: number;

    weight: number;

}

// Un ejercicio del entrenamiento con las series que se han hecho
export interface ISessionExercise {

    exercise: mongoose.Types.ObjectId;

    sets: ISessionSet[];

}

// Definimos los datos que puede tener un entrenamiento realizado
export interface IWorkoutSession {

    // Usuario que ha hecho el entrenamiento
    user: mongoose.Types.ObjectId;

    // Rutina que se ha hecho. Es opcional: si el usuario empezo un entrenamiento vacio no hay rutina
    workout?: mongoose.Types.ObjectId;

    startedAt: Date;

    finishedAt: Date;

    exercises: ISessionExercise[];

}

// Esta interfaz junta los datos del entrenamiento con las propiedades de un documento de MongoDB
export interface IWorkoutSessionModel extends IWorkoutSession, Document {}

// Definimos el esquema que van a seguir los entrenamientos en la base de datos
const WorkoutSessionSchema: Schema = new Schema(

    {
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },

        // Sin required: puede quedar vacio
        workout: { type: Schema.Types.ObjectId, ref: 'Workout' },

        startedAt: { type: Date, required: true },

        finishedAt: { type: Date, required: true },

        // Cada ejercicio lleva sus series. _id: false porque no necesitan id propio
        exercises: [
            {
                _id: false,
                exercise: { type: Schema.Types.ObjectId, ref: 'Exercise', required: true },
                sets: [
                    {
                        _id: false,
                        reps: { type: Number, required: true, min: 1 },
                        weight: { type: Number, required: true, min: 0 }
                    }
                ]
            }
        ]

    },

    {
        timestamps: true,

        versionKey: false

    }

);

// Creamos y exportamos el modelo WorkoutSession a partir del esquema
export default mongoose.model<IWorkoutSessionModel>('WorkoutSession', WorkoutSessionSchema);
