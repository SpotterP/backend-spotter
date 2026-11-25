import express from 'express';
import controller from '../controllers/Session';

import { Schemas, ValidateId, ValidateJoi, ValidateQuery } from '../middleware/Joi';
import { RequireRole } from '../middleware/RequireRole';

// Rutas de los entrenamientos realizados del propio usuario. Se montan en /users/me/sessions
// (ver server.ts), antes que /users para que "me" no se confunda con un :userId.
// Solo para el rol USER: cada usuario ve unicamente los suyos.
const router = express.Router();

router.use(RequireRole('USER'));

/**
 * @openapi
 * /users/me/sessions:
 *   post:
 *     tags: [My sessions]
 *     summary: Guarda un entrenamiento terminado
 *     description: >
 *       La app lo envía entero al pulsar finalizar. El usuario es el de la sesión. `workout` es
 *       opcional: se omite si el entrenamiento se empezó de cero; si se envía, tiene que ser una rutina mía. Si la rutina o algún ejercicio no existe, responde 404. Cada ejercicio lleva las series
 *       que se han hecho, con sus repeticiones y su peso en kg.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/SessionInput' }
 *     responses:
 *       201:
 *         description: El entrenamiento guardado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 session: { $ref: '#/components/schemas/Session' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/Unprocessable' }
 */
router.post('/', ValidateJoi(Schemas.session.create), controller.createSession);

/**
 * @openapi
 * /users/me/sessions:
 *   get:
 *     tags: [My sessions]
 *     summary: Lista mis entrenamientos
 *     description: Del más reciente al más antiguo, con paginación. Solo los del usuario de la sesión.
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 10 }
 *     responses:
 *       200:
 *         description: Una página de mis entrenamientos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sessions:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Session' }
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
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       422: { $ref: '#/components/responses/Unprocessable' }
 */
router.get('/', ValidateQuery(Schemas.query.session), controller.listSessions);

/**
 * @openapi
 * /users/me/sessions/{sessionId}:
 *   get:
 *     tags: [My sessions]
 *     summary: Devuelve un entrenamiento mío
 *     description: Con sus ejercicios completos y sus series. Si es de otro usuario o no existe, responde 404.
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema: { type: string, pattern: '^[0-9a-fA-F]{24}$' }
 *     responses:
 *       200:
 *         description: El entrenamiento
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 session: { $ref: '#/components/schemas/Session' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:sessionId', ValidateId('sessionId'), controller.readSession);

export = router;
