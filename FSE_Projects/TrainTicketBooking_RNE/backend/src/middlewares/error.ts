import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/errors';
import { env } from '../config/env';

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction) => next(new AppError(404, 'NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found`));
/** Centralised exception handling: AppError, Zod validation, Prisma constraint errors, malformed JSON, anything else -> 500 (details only in the log). */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  let status = 500, code = 'INTERNAL_ERROR', message = 'Unexpected server error', fields: Record<string, string> | undefined;
  if (err instanceof AppError) ({ status, code, message, fields } = err);
  else if (err instanceof ZodError) { status = 400; code = 'VALIDATION_FAILED'; message = 'Validation failed'; fields = {}; for (const i of err.issues) { const k = i.path.join('.'); if (!(k in fields)) fields[k] = i.message; } }
  else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') { status = 409; code = 'CONFLICT'; message = 'A record with the same unique value already exists'; }
    else if (err.code === 'P2025') { status = 404; code = 'NOT_FOUND'; message = 'Record not found'; }
    else if (err.code === 'P2003') { status = 409; code = 'CONFLICT'; message = 'The record is referenced by other data'; }
    else console.error('[prisma]', err.code, err.message);
  } else if (err instanceof SyntaxError && 'body' in err) { status = 400; code = 'BAD_JSON'; message = 'Request body is not valid JSON'; }
  else if (err instanceof Error && err.message.startsWith('INVALID_ID:')) { status = 400; code = 'BAD_REQUEST'; message = `Invalid ${err.message.slice(11)}`; }
  else console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  res.status(status).json({ success: false, error: { code, message, ...(fields ? { fields } : {}), ...(!env.isProd && status === 500 && err instanceof Error ? { debug: err.message } : {}) } });
}
