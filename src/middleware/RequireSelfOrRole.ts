import { NextFunction, Request, Response } from 'express';
import type { UserRole } from '../models/User';

// Deja pasar si el usuario del token es el mismo que el de la ruta (:userId)
// o si tiene el rol indicado (por ejemplo ADMIN). Va despues de VerifyToken.
export const RequireSelfOrRole = (role: UserRole, param = 'userId') => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Falta el token' });
        }

        if (req.user.role !== role && req.user.id !== req.params[param]) {
            return res.status(403).json({ message: 'Solo puedes acceder a tus propios datos' });
        }

        next();
    };
};

export default RequireSelfOrRole;
