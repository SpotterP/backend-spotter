import express from 'express';
import controller from '../controllers/MyWorkouts';

import { Schemas, ValidateId, ValidateJoi } from '../middleware/Joi';
import { RequireRole } from '../middleware/RequireRole';

// Rutas de las rutinas del propio usuario. Se montan en /users/me/workouts (ver server.ts)
// ANTES que /users, para que "me" no se confunda con un :userId.
// Solo para el rol USER: cada usuario ve y toca unicamente sus rutinas.
const router = express.Router();

router.use(RequireRole('USER'));

/**
 * @openapi
 * /users/me/workouts:
 *   get:
 *     tags: [My workouts]
 *     summary: Lista mis rutinas
 *     description: Solo las rutinas activas del usuario de la sesión, con sus ejercicios completos.
 *     responses:
 *       200:
 *         description: Mis rutinas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 workouts:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/WorkoutPopulated' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get('/', controller.listMyWorkouts);

/**
 * @openapi
 * /users/me/workouts:
 *   post:
 *     tags: [My workouts]
 *     summary: Crea una rutina mía
 *     description: >
 *       El dueño es el usuario de la sesión. El orden de `exercises` es el orden de la rutina y cada
 *       ejercicio lleva sus propias series y repeticiones. `days` puede estar vacío. El nombre no
 *       puede repetirse entre mis rutinas activas (otro usuario sí puede usarlo). Si algún ejercicio no existe, responde 404.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/WorkoutInput' }
 *     responses:
 *       201: { $ref: '#/components/responses/WorkoutOne' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/Conflict' }
 *       422: { $ref: '#/components/responses/Unprocessable' }
 */
router.post('/', ValidateJoi(Schemas.workout.create), controller.createMyWorkout);

/**
 * @openapi
 * /users/me/workouts/{workoutId}:
 *   get:
 *     tags: [My workouts]
 *     summary: Devuelve una rutina mía
 *     description: Con los ejercicios completos. Si la rutina es de otro usuario, está borrada o no existe, responde 404.
 *     parameters:
 *       - in: path
 *         name: workoutId
 *         required: true
 *         schema: { type: string, pattern: '^[0-9a-fA-F]{24}$' }
 *     responses:
 *       200: { $ref: '#/components/responses/WorkoutOne' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:workoutId', ValidateId('workoutId'), controller.readMyWorkout);

/**
 * @openapi
 * /users/me/workouts/{workoutId}:
 *   put:
 *     tags: [My workouts]
 *     summary: Modifica una rutina mía
 *     description: >
 *       Cambia el nombre, los ejercicios (con su orden, series y repeticiones) y los días.
 *       La lista de `exercises` que se envía sustituye a la anterior. Si la rutina es de otro usuario, responde 404.
 *     parameters:
 *       - in: path
 *         name: workoutId
 *         required: true
 *         schema: { type: string, pattern: '^[0-9a-fA-F]{24}$' }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/WorkoutInput' }
 *     responses:
 *       200: { $ref: '#/components/responses/WorkoutOne' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/Conflict' }
 *       422: { $ref: '#/components/responses/Unprocessable' }
 */
router.put('/:workoutId', ValidateId('workoutId'), ValidateJoi(Schemas.workout.update), controller.updateMyWorkout);

/**
 * @openapi
 * /users/me/workouts/{workoutId}:
 *   delete:
 *     tags: [My workouts]
 *     summary: Borra una rutina mía (borrado lógico)
 *     description: La rutina deja de salir en mis listados y su nombre queda libre. Si es de otro usuario, responde 404.
 *     parameters:
 *       - in: path
 *         name: workoutId
 *         required: true
 *         schema: { type: string, pattern: '^[0-9a-fA-F]{24}$' }
 *     responses:
 *       204: { description: Rutina borrada }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.delete('/:workoutId', ValidateId('workoutId'), controller.deleteMyWorkout);

export = router;
