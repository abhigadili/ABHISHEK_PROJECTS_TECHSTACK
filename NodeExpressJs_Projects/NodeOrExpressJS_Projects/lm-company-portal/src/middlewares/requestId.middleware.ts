// ============================================================
// WHAT: Assigns a unique ID to every incoming request
// WHY:  In production, thousands of requests are interleaved in logs.
//       A request ID lets you correlate all log lines for one request.
//       Also useful for distributed tracing across microservices.
// HOW:  Uses uuid v4 (universally unique). The ID is added to the
//       response header so clients can include it in bug reports.
// ============================================================

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuthRequest } from '../types';

export const requestIdMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();
  req.requestId = requestId;
  // Echo the ID back so the client can reference it for support
  res.setHeader('x-request-id', requestId);
  next();
};
