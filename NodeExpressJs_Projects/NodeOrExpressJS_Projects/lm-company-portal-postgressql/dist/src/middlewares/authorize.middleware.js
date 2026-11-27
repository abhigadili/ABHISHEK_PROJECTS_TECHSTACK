"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorizePermission = exports.authorize = void 0;
const exceptions_1 = require("../exceptions");
// Authorize by role
const authorize = (allowedRoles) => {
    return (req, _res, next) => {
        // authenticate middleware must run first
        if (!req.user) {
            return next(new exceptions_1.UnauthorizedError());
        }
        if (!allowedRoles.includes(req.user.role)) {
            return next(new exceptions_1.ForbiddenError(`Role "${req.user.role}" is not authorized. Required: ${allowedRoles.join(', ')}`));
        }
        next();
    };
};
exports.authorize = authorize;
// Authorize by permission (finer-grained than role)
const authorizePermission = (requiredPermission) => {
    return (req, _res, next) => {
        if (!req.user)
            return next(new exceptions_1.UnauthorizedError());
        if (!req.user.permissions.includes(requiredPermission)) {
            return next(new exceptions_1.ForbiddenError(`Permission "${requiredPermission}" is required.`));
        }
        next();
    };
};
exports.authorizePermission = authorizePermission;
