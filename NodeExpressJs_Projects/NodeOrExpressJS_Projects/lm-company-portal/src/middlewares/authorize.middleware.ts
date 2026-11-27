// ============================================================
// WHAT: Authorization middleware — Role-Based Access Control (RBAC)
// WHY:  Authentication answers "who are you?". Authorization answers
//       "what are you allowed to do?". They are separate concerns.
// HOW:  authorize() is a middleware factory — it returns a middleware
//       function configured with the allowed roles or permissions.
// Usage in routes:
//   router.post('/companies', authenticate, authorize(['Admin', 'SuperAdmin']), controller)
// Interview Tip: Middleware factories are a common Node.js pattern.
//               The outer function configures; the inner function runs per request.
// Best Practice: Fail fast — check role before hitting the database.
// ============================================================

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { Role, Permission } from '../constants';
import { ForbiddenError, UnauthorizedError } from '../exceptions';

// Authorize by role
export const authorize = (allowedRoles: Role[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    // authenticate middleware must run first
    if (!req.user) {
      return next(new UnauthorizedError());
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Role "${req.user.role}" is not authorized. Required: ${allowedRoles.join(', ')}`
        )
      );
    }

    next();
  };
};

// Authorize by permission (finer-grained than role)
export const authorizePermission = (requiredPermission: Permission) => {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new UnauthorizedError());

    if (!req.user.permissions.includes(requiredPermission)) {
      return next(
        new ForbiddenError(`Permission "${requiredPermission}" is required.`)
      );
    }

    next();
  };
};
