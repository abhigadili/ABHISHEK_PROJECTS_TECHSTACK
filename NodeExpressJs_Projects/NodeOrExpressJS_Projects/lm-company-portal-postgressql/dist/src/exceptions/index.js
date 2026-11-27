"use strict";
// ============================================================
// WHAT: Custom error classes for the application
// WHY:  Using typed errors lets the global error handler respond
//       with the correct HTTP status without if/else chains.
//       It also provides a consistent error shape to clients.
// HOW:  All custom errors extend AppError. The global handler
//       checks instanceof to determine status code and message.
// Interview Tip: Custom error hierarchies are a sign of mature
//               backend code. Know why NOT to throw plain Error objects.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseError = exports.ConflictError = exports.NotFoundError = exports.ForbiddenError = exports.UnauthorizedError = exports.ValidationError = exports.AppError = void 0;
class AppError extends Error {
    constructor(message, statusCode, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        // Restore prototype chain (needed when extending built-ins in TS)
        Object.setPrototypeOf(this, new.target.prototype);
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
// 400 — client sent invalid data
class ValidationError extends AppError {
    constructor(message, fields) {
        super(message, 400);
        this.fields = fields;
    }
}
exports.ValidationError = ValidationError;
// 401 — missing or invalid authentication credentials
// Interview Tip: 401 = "who are you?", 403 = "I know who you are, but no."
class UnauthorizedError extends AppError {
    constructor(message = 'Authentication required') {
        super(message, 401);
    }
}
exports.UnauthorizedError = UnauthorizedError;
// 403 — authenticated but not permitted
class ForbiddenError extends AppError {
    constructor(message = 'You do not have permission to perform this action') {
        super(message, 403);
    }
}
exports.ForbiddenError = ForbiddenError;
// 404 — resource does not exist
class NotFoundError extends AppError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 404);
    }
}
exports.NotFoundError = NotFoundError;
// 409 — duplicate resource (e.g. email already registered)
class ConflictError extends AppError {
    constructor(message) {
        super(message, 409);
    }
}
exports.ConflictError = ConflictError;
// 500 — database / infrastructure failures
// isOperational=false → generic message shown to client; full detail logged server-side
class DatabaseError extends AppError {
    constructor(message = 'A database error occurred') {
        super(message, 500, false);
    }
}
exports.DatabaseError = DatabaseError;
