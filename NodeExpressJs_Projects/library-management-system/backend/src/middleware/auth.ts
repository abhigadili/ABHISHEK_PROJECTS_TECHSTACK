import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { queryOne } from '../lib/db';
import { forbidden, unauthorized } from '../lib/errors';
import { sha256 } from '../lib/password';

export type RoleName = 'admin' | 'librarian' | 'member';
export interface AuthUser { id: number; email: string; fullName: string; role: RoleName; status: string }

declare module 'express-serve-static-core' {
  interface Request { user?: AuthUser; sessionId?: string }
}

/** Resolves the session cookie to a user. Suspended/inactive accounts lose access immediately. */
export async function loadSession(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[env.SESSION_COOKIE_NAME];
    if (token && typeof token === 'string') {
      const id = sha256(token);
      const row = await queryOne<any>(
        `SELECT u.id, u.email, u.full_name, u.status, r.name AS role
           FROM sessions s JOIN users u ON u.id = s.user_id JOIN roles r ON r.id = u.role_id
          WHERE s.id = ? AND s.expires_at > UTC_TIMESTAMP()`, [id]);
      if (row && ['active', 'pending'].includes(row.status)) {
        req.user = { id: row.id, email: row.email, fullName: row.full_name, role: row.role, status: row.status };
        req.sessionId = id;
      }
    }
    next();
  } catch (e) { next(e); }
}

export const requireAuth = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) return next(unauthorized());
  next();
};

/** Active accounts only (pending members may sign in and read but not transact). */
export const requireActive = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) return next(unauthorized());
  if (req.user.status !== 'active') return next(forbidden('Your account is awaiting activation'));
  next();
};

export const requireRole = (...roles: RoleName[]) => (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) return next(unauthorized());
  if (!roles.includes(req.user.role)) return next(forbidden());
  next();
};
export const staffOnly = requireRole('admin', 'librarian');
export const adminOnly = requireRole('admin');
export const isStaff = (u?: AuthUser) => !!u && (u.role === 'admin' || u.role === 'librarian');

/** Simple CSRF defence on top of SameSite=Lax + strict CORS: mutating calls must carry a custom header. */
export function requireCsrfHeader(req: Request, _res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('x-lms-client') !== 'web') return next(forbidden('Missing client header'));
  next();
}
