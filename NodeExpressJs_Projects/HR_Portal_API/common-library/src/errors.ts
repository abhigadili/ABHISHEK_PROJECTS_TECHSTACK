/** Custom business exceptions mapped to the standard API error format by the global error handler. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}
export class BusinessRuleError extends AppError {
  constructor(message: string, details?: unknown) {
    super(422, 'BUSINESS_RULE_VIOLATION', message, details);
  }
}
export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(401, 'UNAUTHORIZED', message);
  }
}
export class ForbiddenError extends AppError {
  constructor(message = 'You are not allowed to perform this action') {
    super(403, 'FORBIDDEN', message);
  }
}
export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(404, 'RESOURCE_NOT_FOUND', id ? `${resource} '${id}' was not found` : `${resource} was not found`);
  }
}
export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(409, 'CONFLICT', message, details);
  }
}
export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests') {
    super(429, 'RATE_LIMITED', message);
  }
}
export class UpstreamError extends AppError {
  constructor(service: string, message: string, status = 502) {
    super(status, 'UPSTREAM_ERROR', `${service}: ${message}`);
  }
}
