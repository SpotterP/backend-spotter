import express from 'express';
import controller from '../controllers/Progress';

import { RequireRole } from '../middleware/RequireRole';

// Ruta del progreso del propio usuario. Se monta en /users/me/progress (ver server.ts)
// ANTES que /users, para que "me" no se confunda con un :userId.
// Solo para el rol USER: cada usuario ve únicamente su progreso.
const router = express.Router();

router.use(RequireRole('USER'));

/**
 * @openapi
 * /users/me/progress:
 *   get:
 *     tags: [My progress]
 *     summary: Muestra mi progreso
 *     description: >
 *       Resumen de los entrenamientos del usuario de la sesión (los de otros usuarios no cuentan).
 *       `trainedDays` son las fechas en las que entrenó (AAAA-MM-DD, en UTC), sin repetir y de la
 *       más antigua a la más reciente. `exercises` lleva cada ejercicio hecho con las veces que
 *       aparece en sus entrenamientos (`timesDone`), de más a menos veces.
 *     responses:
 *       200:
 *         description: El progreso del usuario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 progress:
 *                   type: object
 *                   properties:
 *                     totalSessions: { type: integer, example: 3 }
 *                     trainedDays:
 *                       type: array
 *                       items: { type: string, format: date, example: '2026-11-17' }
 *                     exercises:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           exercise:
 *                             type: object
 *                             properties:
 *                               _id: { type: string, example: 6ab2d1ad9ada2730451295a7 }
 *                               name: { type: string, example: Press banca }
 *                           timesDone: { type: integer, example: 2 }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get('/', controller.readProgress);

export = router;
