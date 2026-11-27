// ============================================================
// WHAT: Global error-handling middleware
// WHY:  Without a central error handler, each route would need its
//       own try/catch and res.json(error) — duplicated everywhere.
//       Express recognises a 4-argument middleware (err, req, res, next)
//       as an error handler and calls it when next(err) is invoked.
// HOW:  All controllers call next(err) on failure. Express skips
//       normal middleware and jumps to this handler.
// Interview Tip: The 4-argument signature is REQUIRED for Express to
//               treat this as an error handler, even if 'next' is unused.
// Security Consideration: Never expose stack traces in production.
//               Use isOperational flag to distinguish safe vs internal errors.
// ============================================================

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../exceptions';
import { logger } from '../utils/logger';
import { config } from '../config/env.config';

export const globalErrorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction // must be declared even if unused
): void => {
  // Log every error server-side with full context
  logger.error({
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
  });

  // Operational errors (AppError subclasses) — safe to expose to client
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(config.isDev && { stack: err.stack }),
    });
    return;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    res.status(400).json({ success: false, message: err.message });
    return;
  }

  // Mongoose duplicate key (unique index violation)
  if ((err as any).code === 11000) {
    const field = Object.keys((err as any).keyValue || {})[0];
    res.status(409).json({ success: false, message: `Duplicate value for field: ${field}` });
    return;
  }

  // Unknown / programmer errors — hide internals from client
  res.status(500).json({
    success: false,
    message: 'An unexpected error occurred.',
    ...(config.isDev && { error: err.message, stack: err.stack }),
  });
};

// 404 handler — registered AFTER all routes
export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};
