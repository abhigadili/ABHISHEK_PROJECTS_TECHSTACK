import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.details = details;
  }
}
export class BadRequestError extends AppError { constructor(m, d) { super(400, m, d); } }
export class UnauthorizedError extends AppError { constructor(m = 'Authentication required: missing, invalid or expired token') { super(401, m); } }
export class ForbiddenError extends AppError { constructor(m = 'You do not have permission to perform this action') { super(403, m); } }
export class NotFoundError extends AppError { constructor(m = 'Resource not found') { super(404, m); } }
export class ConflictError extends AppError { constructor(m) { super(409, m); } }
export class ServiceUnavailableError extends AppError { constructor(m = 'A dependent service is temporarily unavailable') { super(503, m); } }
/** A downstream service rejected the request with a 4xx - passed through, not a dependency failure. */
export class DownstreamClientError extends AppError {}

const REASONS = { 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 409: 'Conflict', 429: 'Too Many Requests', 500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable', 504: 'Gateway Timeout' };
export const reason = (status) => REASONS[status] ?? 'Error';

export function errorBody(req, status, message, details) {
  return { timestamp: new Date().toISOString(), status, error: reason(status), message, path: req.originalUrl?.split('?')[0] ?? req.url, ...(details ? { details } : {}) };
}

export function notFoundHandler(req, res) {
  res.status(404).json(errorBody(req, 404, 'No such endpoint'));
}

/** One JSON error contract for every service: Zod -> 400, AppError -> its status, Prisma unique/not-found -> 409/404, open circuit -> 503, anything else -> 500. */
export function errorHandler(logger) {
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, next) => {
    let status = 500;
    let message = 'Unexpected internal error';
    let details;
    if (err instanceof ZodError) {
      status = 400; message = 'Validation failed';
      details = err.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`);
    } else if (err instanceof AppError) {
      status = err.status; message = err.message; details = err.details;
    } else if (err?.code === 'P2002') {
      status = 409; message = 'The request conflicts with existing data (duplicate or constraint violation)';
    } else if (err?.code === 'P2025') {
      status = 404; message = 'Resource not found';
    } else if (err?.code === 'EOPENBREAKER' || err?.code === 'ETIMEDOUT') {
      status = 503; message = 'A dependent service is temporarily unavailable';
    } else if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
      status = 400; message = 'Malformed JSON body';
    } else if (err?.name === 'MulterError') {
      status = 400; message = `Upload rejected: ${err.message}`;
    }
    if (status >= 500) logger.error({ err, path: req.originalUrl?.split('?')[0] }, 'Unhandled error');
    else if (status === 503) logger.warn({ path: req.originalUrl?.split('?')[0] }, message);
    if (res.headersSent) return;
    res.status(status).json(errorBody(req, status, message, details));
  };
}
