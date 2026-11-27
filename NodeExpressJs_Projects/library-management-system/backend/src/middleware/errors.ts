import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { AppError } from '../lib/errors';
import { isProd } from '../config/env';

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(new AppError(404, 'NOT_FOUND', 'Route not found'));
}

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : `Upload error: ${err.message}`;
    return res.status(400).json({ error: { code: 'UPLOAD_ERROR', message: msg } });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'BAD_JSON', message: 'Malformed JSON body' } });
  }
  if (err?.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: { code: 'DUPLICATE', message: 'A record with the same unique value already exists' } });
  }
  if (err?.code === 'ER_LOCK_DEADLOCK') {
    return res.status(503).json({ error: { code: 'RETRY', message: 'The system was busy, please try again' } });
  }
  // Log server-side only; never leak internals to the client.
  console.error(`[error] ${req.method} ${req.originalUrl}:`, isProd ? err?.message : err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong' } });
}
