import rateLimit from 'express-rate-limit';
/** Router-level middleware protecting credential endpoints from brute force (in addition to per-account lockout). */
export const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 100, standardHeaders: 'draft-7', legacyHeaders: false, message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests, please slow down' } } });
