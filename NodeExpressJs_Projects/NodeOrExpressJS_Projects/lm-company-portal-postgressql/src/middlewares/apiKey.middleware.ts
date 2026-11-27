// ============================================================
// WHAT: API Key middleware for service-to-service authentication
// WHY:  Internal services (cron jobs, data pipelines) don't have
//       user accounts. API keys are a simple, stateless solution.
// HOW:  The caller includes the key in the X-API-Key header.
//       We compare against the configured key using constant-time
//       comparison to prevent timing attacks.
// Security Consideration: Rotate API keys regularly. Store them
//       in a secrets manager (Vault, AWS Secrets Manager) in production.
// ============================================================

import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env.config';
import { UnauthorizedError } from '../exceptions';

export const apiKeyMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  const key = req.headers['x-api-key'] as string;

  if (!key || key !== config.apiKey) {
    return next(new UnauthorizedError('Invalid or missing API key'));
  }

  next();
};
