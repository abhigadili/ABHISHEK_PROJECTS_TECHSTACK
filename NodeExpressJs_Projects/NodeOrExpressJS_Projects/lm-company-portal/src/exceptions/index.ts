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

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean; // operational = safe to expose to client

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    // Restore prototype chain (needed when extending built-ins in TS)
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

// 400 — client sent invalid data
export class ValidationError extends AppError {
  public readonly fields?: Record<string, string>;
  constructor(message: string, fields?: Record<string, string>) {
    super(message, 400);
    this.fields = fields;
  }
}

// 401 — missing or invalid authentication credentials
// Interview Tip: 401 = "who are you?", 403 = "I know who you are, but no."
export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401);
  }
}

// 403 — authenticated but not permitted
export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(message, 403);
  }
}

// 404 — resource does not exist
export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
  }
}

// 409 — duplicate resource (e.g. email already registered)
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}

// 500 — database / infrastructure failures
// isOperational=false → generic message shown to client; full detail logged server-side
export class DatabaseError extends AppError {
  constructor(message = 'A database error occurred') {
    super(message, 500, false);
  }
}
