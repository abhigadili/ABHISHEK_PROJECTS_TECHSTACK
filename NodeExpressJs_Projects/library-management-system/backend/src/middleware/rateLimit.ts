import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

const make = (windowMs: number, limit: number, message: string) =>
  rateLimit({
    windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false,
    skip: () => !env.RATE_LIMIT_ENABLED,
    handler: (_req, res) => { res.status(429).json({ error: { code: 'RATE_LIMITED', message } }); },
  });

export const authLimiter = make(15 * 60_000, 30, 'Too many attempts, please try again later');
export const registerLimiter = make(60 * 60_000, 20, 'Too many registrations from this address');
export const resetLimiter = make(60 * 60_000, 10, 'Too many password reset requests');
export const apiLimiter = make(60_000, 600, 'Too many requests');
