import mongoose, { HydratedDocument } from 'mongoose';
import Workout, { DayOfWeek, IWorkout } from '../models/Workout';
import { buildPageInfo, buildSort, escapeRegex, getSkip } from '../utils/pagination';

// Un ejercicio de la rutina tal y como llega en el cuerpo de la peticion: el id del ejercicio
// del catalogo (texto) y sus series y repeticiones.
export type WorkoutExerciseInput = { exercise: string; sets: number; reps: number };

// Datos necesarios para crear una rutina. Solo el nombre es obligatorio; los dias y los ejercicios
// pueden estar vacios. El dueño no viene en el cuerpo: lo pone el controlador a partir del token.
export type NewWorkout = Pick<IWorkout, 'name'> & { description?: string; days?: DayOfWeek[]; exercises?: WorkoutExerciseInput[] };

// Datos que se pueden actualizar de una rutina.
export type UpdateWorkoutInput = Partial<Pick<IWorkout, 'name' | 'description' | 'days'>> & { exercises?: WorkoutExerciseInput[] };

// Tipo de un documento de rutina ya cargado por Mongoose
type WorkoutDocument = HydratedDocument<IWorkout>;
// Convierte los ejercicios del cuerpo (ids como texto) a ObjectId, conservando el orden.
const toWorkoutExercises = (exercises: WorkoutExerciseInput[]) =>
    exercises.map(({ exercise, sets, reps }) => ({ exercise: new mongoose.Types.ObjectId(exercise), sets, reps }));

// Funcion que se encarga de crear una rutina en la base de datos para un dueño.
// Si el nombre ya existe entre las rutinas no borradas de ese usuario, MongoDB devuelve
// el error 11000 (clave duplicada) por el indice unico parcial del modelo.
export const createWorkout = async (data: NewWorkout, ownerId: string): Promise<WorkoutDocument> => {

    const workout = new Workout({
        ...data,
        owner: new mongoose.Types.ObjectId(ownerId),
        exercises: toWorkoutExercises(data.exercises ?? [])
    });

    return workout.save();

};

// Funcion que busca una rutina por su ID en la base de datos.
// El ADMIN consulta todas las rutinas, tambien las borradas logicamente.
// Cualquier otra sesion solo ve las activas: si la rutina esta borrada se comporta
// como si no existiera y el controlador responde 404.
// El populate carga los documentos completos de Exercise en lugar de dejar los ObjectId,
// para que el controlador pueda responder con los ejercicios enteros. Si no hay ejercicios,
// el populate mantiene una lista vacia.
export const getWorkoutById = (workoutId: string, isAdmin: boolean): Promise<WorkoutDocument | null> => {

    // Con el rol ADMIN buscamos por ID a secas; el resto exige ademas isDeleted: false.
    // En los dos casos cargamos los ejercicios referenciados.
    return isAdmin
        ? Workout.findById(workoutId).populate('exercises.exercise').populate('owner', 'name')
        : Workout.findOne({ _id: workoutId, isDeleted: false }).populate('exercises.exercise').populate('owner', 'name');

};

// Borrado logico: la rutina sigue en la base de datos, pero marcada como borrada.
// Deja de salir en los listados y su nombre queda libre. Devuelve null si no existe o ya estaba borrada.
export const softDeleteWorkout = (workoutId: string): Promise<WorkoutDocument | null> => {

    return Workout.findOneAndUpdate({ _id: workoutId, isDeleted: false }, { isDeleted: true, deletedAt: new Date() }, { new: true });

};

// Borrado logico de varias rutinas a la vez. Devuelve cuantas se han borrado.
export const softDeleteManyWorkouts = async (ids: string[]): Promise<number> => {

    const result = await Workout.updateMany({ _id: { $in: ids }, isDeleted: false }, { isDeleted: true, deletedAt: new Date() });

    return result.modifiedCount;

};

// Borrado definitivo de varias rutinas a la vez. Sus ejercicios no se borran.
export const hardDeleteManyWorkouts = async (ids: string[]): Promise<number> => {

    const result = await Workout.deleteMany({ _id: { $in: ids } });

    return result.deletedCount;

};

// Borrado definitivo: la rutina desaparece de la base de datos para siempre.
// Los ejercicios de la rutina no se borran. Funciona tambien con rutinas ya borradas logicamente.
export const hardDeleteWorkout = (workoutId: string): Promise<WorkoutDocument | null> => {

    return Workout.findByIdAndDelete(workoutId);

};

// Funcion que se encarga de actualizar una rutina.
// Si se pasa ownerId, solo se actualiza si la rutina es de ese usuario (si no, devuelve null y el controlador responde 404).
export const updateWorkout = async (workoutId: string, data: UpdateWorkoutInput, ownerId?: string): Promise<WorkoutDocument | null> => {

    // Copiamos los datos recibidos y convertimos los ejercicios a ObjectId
    const updates: Record<string, unknown> = { ...data };
    if (data.exercises) {

        updates.exercises = toWorkoutExercises(data.exercises);

    }

    // Filtramos isDeleted: false para que una rutina borrada logicamente no se pueda actualizar
    const filter: Record<string, unknown> = { _id: workoutId, isDeleted: false };
    if (ownerId) {
        filter.owner = ownerId;
    }

    return Workout.findOneAndUpdate(filter, updates, { new: true }).populate('exercises.exercise');

};

// Parametros de un listado: los que llegan ya validados por ValidateQuery
// (sort es la columna por la que ordenar y order el sentido: asc o desc)
export type ListWorkoutsInput = { page: number; limit: number; search?: string; day?: DayOfWeek; owner?: string; sort?: string; order?: 'asc' | 'desc' };

// Devuelve una pagina de rutinas, filtrada por dia y/o por texto en nombre o descripcion.
// El ADMIN ve todas las rutinas; cualquier otra sesion solo las activas (isDeleted: false).
export const listWorkouts = async ({ page, limit, search, day, owner, sort, order }: ListWorkoutsInput, isAdmin: boolean) => {

    // El ADMIN consulta todo, asi que su filtro empieza vacio; el resto empieza solo con las activas
    const filter: Record<string, unknown> = isAdmin ? {} : { isDeleted: false };

    // Filtro por dia de la semana (rutinas que incluyen ese dia), si se ha pedido
    if (day) {
        filter.days = day;
    }

    // Filtro por dueño: solo las rutinas de ese usuario, si se ha pedido
    if (owner) {
        filter.owner = owner;
    }

    // Buscador: el texto puede estar en el nombre O en la descripcion
    if (search) {
        const regex = new RegExp(escapeRegex(search), 'i');
        filter.$or = [{ name: regex }, { description: regex }];
    }

    // Pedimos la pagina y el total a la vez, con el MISMO filtro
    const [workouts, total] = await Promise.all([
        // Ordenamos por la columna pedida (por defecto el nombre)
        Workout.find(filter).sort(buildSort(sort, order, 'name')).skip(getSkip(page, limit)).limit(limit).populate('exercises.exercise').populate('owner', 'name'),
        Workout.countDocuments(filter)
    ]);

    return { workouts, pagination: buildPageInfo(page, limit, total) };

};

// Recuperar: deshace el borrado logico, o sea isDeleted vuelve a false.
// Devuelve null si no existe o si no estaba borrado.
// Si ya hay otro activo con el mismo nombre/email, MongoDB da error 11000 (409).
export const restoreWorkout = (workoutId: string): Promise<WorkoutDocument | null> => {

    return Workout.findOneAndUpdate({ _id: workoutId, isDeleted: true }, { isDeleted: false, deletedAt: null }, { new: true });

};

// ---- Rutinas del propio usuario (/users/me/workouts) ----
// Todas filtran por owner: una rutina de otro usuario es como si no existiera (el controlador responde 404).

// Listado de las rutinas activas del usuario, con sus ejercicios completos.
export const listMyWorkouts = (ownerId: string): Promise<WorkoutDocument[]> => {

    return Workout.find({ owner: ownerId, isDeleted: false }).populate('exercises.exercise');

};

// Una rutina activa del usuario por su id. Devuelve null si no existe, esta borrada o es de otro.
export const getMyWorkout = (ownerId: string, workoutId: string): Promise<WorkoutDocument | null> => {

    return Workout.findOne({ _id: workoutId, owner: ownerId, isDeleted: false }).populate('exercises.exercise');

};

// Borrado logico de una rutina del usuario. Devuelve null si no existe, ya estaba borrada o es de otro.
export const softDeleteMyWorkout = (ownerId: string, workoutId: string): Promise<WorkoutDocument | null> => {

    return Workout.findOneAndUpdate({ _id: workoutId, owner: ownerId, isDeleted: false }, { isDeleted: true, deletedAt: new Date() }, { new: true });

};

// Exportamos todas las funciones para poder utilizarlas desde el controlador
export default {

    createWorkout,

    getWorkoutById,

    updateWorkout,

    softDeleteWorkout,

    restoreWorkout,

    hardDeleteWorkout,

    softDeleteManyWorkouts,

    hardDeleteManyWorkouts,

    listWorkouts,

    listMyWorkouts,

    getMyWorkout,

    softDeleteMyWorkout

};
