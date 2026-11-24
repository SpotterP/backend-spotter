import express from 'express';

import controller from '../controllers/Workout';

import { Schemas, ValidateId, ValidateJoi, ValidateQuery } from '../middleware/Joi';
import { RequireOwnerOrAdmin } from '../middleware/RequireOwnerOrAdmin';
import { RequireRole } from '../middleware/RequireRole';

// Creamos el router que se encargara de las rutas relacionadas con las rutinas
const router = express.Router();

/**
 * @openapi
 * /workouts:
 *   post:
 *     tags: [Workouts]
 *     summary: Crea una rutina
 *     description: >
 *       Solo un ADMIN puede crear rutinas. Puede indicar el dueño con `owner` (id de un usuario);
 *       si no lo indica, la rutina es del propio ADMIN. Si el dueño o algún ejercicio no existe, responde 404. Cada ejercicio se envia como
 *       { exercise, sets, reps } y el orden de la lista es el orden de la rutina.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/WorkoutAdminInput' }
 *     responses:
 *       201:
 *         description: Rutina creada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Workout' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/Conflict' }
 *       422: { $ref: '#/components/responses/Unprocessable' }
 */

/**
 * @openapi
 * /workouts:
 *   get:
 *     tags: [Workouts]
 *     summary: Lista las rutinas con paginación y buscador
 *     description: >
 *       Cada rutina lleva sus ejercicios completos y su dueño (`owner`, con su id y su nombre). El buscador mira el nombre y la descripción.
 *       Cualquier sesión con token puede consultarlo: un ADMIN ve todas las rutinas, también las
 *       borradas, y puede filtrar por `owner`; un usuario normal solo ve sus propias rutinas activas.
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 10 }
 *       - in: query
 *         name: search
 *         description: Texto que debe contener el nombre o la descripción (sin distinguir mayúsculas)
 *         schema: { type: string }
 *       - in: query
 *         name: day
 *         description: Solo las rutinas que incluyen este día
 *         schema: { type: string, enum: [MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY] }
 *       - in: query
 *         name: owner
 *         description: Solo las rutinas de este usuario (id del dueño)
 *         schema: { type: string, pattern: '^[0-9a-fA-F]{24}$' }
 *       - in: query
 *         name: sort
 *         description: Columna por la que se ordena (por defecto name)
 *         schema: { type: string, enum: [name, description] }
 *       - in: query
 *         name: order
 *         description: Sentido del orden (por defecto asc)
 *         schema: { type: string, enum: [asc, desc], default: asc }
 *     responses:
 *       200:
 *         description: Una página de rutinas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 workouts:
 *                   type: array
 *                   items: { type: object }
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page: { type: integer }
 *                     limit: { type: integer }
 *                     total: { type: integer }
 *                     totalPages: { type: integer }
 *                     hasNextPage: { type: boolean }
 *                     hasPrevPage: { type: boolean }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       422: { $ref: '#/components/responses/Unprocessable' }
 */

// Ruta para listar rutinas: primero validamos los parametros de la URL
// La lectura la puede hacer cualquier sesion: el controlador pasa el rol y el id del usuario al servicio
// y el servicio decide: el ADMIN ve todas y un USER solo las suyas activas
router.get('/', ValidateQuery(Schemas.query.workout), controller.listWorkouts);

// Ruta para crear una rutina nueva
// Solo ADMIN: escribir en el catalogo es cosa del backoffice
// Primero comprobamos que los datos cumplen el esquema de Joi
// Si son correctos llamamos a la funcion createWorkout del controlador
router.post('/', RequireRole('ADMIN'), ValidateJoi(Schemas.workout.adminCreate), controller.createWorkout);

/**
 * @openapi
 * /workouts:
 *   delete:
 *     tags: [Workouts]
 *     summary: Borrado lógico de varios rutinas
 *     description: >
 *       Marca como borrados (isDeleted) los rutinas cuyos ids se envían en el cuerpo. Los que no existen
 *       o ya estaban borrados no cuentan. Solo ADMIN.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ids]
 *             properties:
 *               ids:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 100
 *                 items: { type: string, pattern: '^[0-9a-fA-F]{24}$' }
 *     responses:
 *       200:
 *         description: Cuántos se han borrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 deleted: { type: integer }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       422: { $ref: '#/components/responses/Unprocessable' }
 */

// Borrado logico multiple. Va antes de las rutas con :id para que "hard" no se tome por un id
router.delete('/', RequireRole('ADMIN'), ValidateJoi(Schemas.bulkDelete), controller.softDeleteManyWorkouts);

/**
 * @openapi
 * /workouts/hard:
 *   delete:
 *     tags: [Workouts]
 *     summary: Borrado definitivo de varios rutinas
 *     description: >
 *       Elimina de la base de datos los rutinas cuyos ids se envían en el cuerpo. No se puede deshacer.
 *       Solo ADMIN.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ids]
 *             properties:
 *               ids:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 100
 *                 items: { type: string, pattern: '^[0-9a-fA-F]{24}$' }
 *     responses:
 *       200:
 *         description: Cuántos se han eliminado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 deleted: { type: integer }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       422: { $ref: '#/components/responses/Unprocessable' }
 */

// Borrado definitivo multiple
router.delete('/hard', RequireRole('ADMIN'), ValidateJoi(Schemas.bulkDelete), controller.hardDeleteManyWorkouts);

/**
 * @openapi
 * /workouts/{workoutId}:
 *   get:
 *     tags: [Workouts]
 *     summary: Devuelve una rutina con sus ejercicios completos
 *     description: >
 *       Los ejercicios se guardan como ids, pero esta respuesta los devuelve ya resueltos:
 *       cada elemento de exercises es un objeto Exercise entero, no un id.
 *       Cualquier sesión con token puede consultarlo. Un ADMIN ve cualquier rutina, también las borradas;
 *       un usuario normal solo ve las suyas, y si la rutina es de otro o está borrada responde 404.
 *     parameters:
 *       - in: path
 *         name: workoutId
 *         required: true
 *         schema: { type: string, pattern: '^[0-9a-fA-F]{24}$' }
 *         example: 6ab2d1ad9ada2730451295a7
 *     responses:
 *       200: { $ref: '#/components/responses/WorkoutOne' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */

// Ruta para buscar una rutina por su ID
// Antes de llamar al controlador comprobamos que el ID tiene el formato correcto
router.get('/:workoutId', ValidateId('workoutId'), controller.readWorkout);

/**
 * @openapi
 * /workouts/{workoutId}:
 *   put:
 *     tags: [Workouts]
 *     summary: Reemplaza los datos de una rutina
 *     description: >
 *       Hay que enviar la rutina entera, no solo los campos que cambian.
 *       Cada ejercicio se envia como { exercise, sets, reps } y el orden de la lista es el orden de la rutina.
 *       Solo un ADMIN puede cambiar el dueño con `owner`; si lo envia un usuario normal, se ignora.
 *       La puede modificar un ADMIN (cualquier rutina) o el usuario dueño de la rutina; si es de otro usuario responde 404.
 *     parameters:
 *       - in: path
 *         name: workoutId
 *         required: true
 *         schema: { type: string, pattern: '^[0-9a-fA-F]{24}$' }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/WorkoutAdminInput' }
 *     responses:
 *       200:
 *         description: Rutina actualizada. Al actualizar, los ejercicios se devuelven como ids, no como objetos.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Workout' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/Conflict' }
 *       422: { $ref: '#/components/responses/Unprocessable' }
 */

// Ruta para actualizar una rutina
// ADMIN (cualquier rutina) o el dueño de la rutina (solo las suyas)
// Primero comprobamos que el ID sea correcto, despues quien es el dueño y por ultimo validamos los datos recibidos
router.put('/:workoutId', ValidateId('workoutId'), RequireOwnerOrAdmin, ValidateJoi(Schemas.workout.adminUpdate), controller.updateWorkout);

// Exportamos el router para poder utilizar estas rutas en la aplicacion
/**
 * @openapi
 * /workouts/{workoutId}:
 *   delete:
 *     tags: [Workouts]
 *     summary: Borrado lógico de una rutina
 *     description: >
 *       Marca la rutina como borrada (isDeleted). Sigue en la base de datos, pero deja de salir
 *       en los listados y su nombre queda libre. La puede borrar un ADMIN (cualquier rutina) o el usuario dueño; si es de otro usuario responde 404.
 *     parameters:
 *       - in: path
 *         name: workoutId
 *         required: true
 *         schema: { type: string, pattern: '^[0-9a-fA-F]{24}$' }
 *     responses:
 *       204: { description: Rutina borrada lógicamente }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */

// Borrado logico: solo marca la rutina como borrada. ADMIN o el dueño de la rutina
router.delete('/:workoutId', ValidateId('workoutId'), RequireOwnerOrAdmin, controller.softDeleteWorkout);

/**
 * @openapi
 * /workouts/{workoutId}/restore:
 *   patch:
 *     tags: [Workouts]
 *     summary: Recupera la rutina borrado lógicamente
 *     description: Deshace el borrado lógico (isDeleted vuelve a false). Solo ADMIN.
 *     parameters:
 *       - in: path
 *         name: workoutId
 *         required: true
 *         schema: { type: string, pattern: '^[0-9a-fA-F]{24}$' }
 *     responses:
 *       200: { description: Recuperado }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/Conflict' }
 */

// Recuperar: solo ADMIN
router.patch('/:workoutId/restore', RequireRole('ADMIN'), ValidateId('workoutId'), controller.restoreWorkout);

/**
 * @openapi
 * /workouts/{workoutId}/hard:
 *   delete:
 *     tags: [Workouts]
 *     summary: Borrado definitivo de una rutina
 *     description: >
 *       Elimina la rutina de la base de datos para siempre. Sus ejercicios no se borran.
 *       No se puede deshacer. Solo ADMIN.
 *     parameters:
 *       - in: path
 *         name: workoutId
 *         required: true
 *         schema: { type: string, pattern: '^[0-9a-fA-F]{24}$' }
 *     responses:
 *       204: { description: Rutina eliminada de la base de datos }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */

// Borrado definitivo: elimina la rutina de la base de datos
router.delete('/:workoutId/hard', RequireRole('ADMIN'), ValidateId('workoutId'), controller.hardDeleteWorkout);

export = router;
