import { NextFunction, Request, Response } from 'express';
import type { UserRole } from '../models/User';

// Middleware que solo deja pasar a los usuarios con un rol concreto.
// Va siempre despues de VerifyToken, que es quien rellena req.user. Por ejemplo:
//
//     router.use('/exercises', VerifyToken, RequireRole('ADMIN'), exerciseRoutes);
//
// 401 (Unauthorized) quiere decir "no sé quién eres": no hay sesion.
// 403 (Forbidden) quiere decir "sé quién eres, pero no puedes hacer esto": falta el rol.
export const RequireRole = (role: UserRole) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            // Mismo code que el resto de 401 por falta de sesión: el cliente decide por código
            return res.status(401).json({ message: 'Falta el token', code: 'TOKEN_MISSING' });
        }

        if (req.user.role !== role) {
            return res.status(403).json({ message: `Necesitas el rol ${role}` });
        }

        next();
    };
};

export default RequireRole;
