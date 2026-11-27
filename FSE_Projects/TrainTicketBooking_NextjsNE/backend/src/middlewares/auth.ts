import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../utils/tokens';
import { forbidden, unauthorized } from '../utils/errors';
import { permissionsOfRoles } from '../services/rbac.service';
import type { PermissionKey, RoleKey } from '../constants/rbac';

/** Authentication middleware: verifies the Bearer access token (signature, expiry, issuer, audience) and attaches req.user. */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const m = req.headers.authorization?.match(/^Bearer (.+)$/i);
  const claims = m ? verifyAccessToken(m[1]) : null;
  if (!claims) return next(unauthorized('Invalid or expired access token'));
  req.user = { id: Number(claims.sub), roles: claims.roles };
  next();
}
/** Authorization middleware: caller must hold at least ONE of the given permissions (resolved from role -> permission tables). */
export const authorize = (...perms: PermissionKey[]) => async (req: Request, _res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw unauthorized();
    const have = await permissionsOfRoles(req.user.roles);
    if (!perms.some((p) => have.has(p))) throw forbidden();
    next();
  } catch (e) { next(e); }
};
export const hasRole = (req: Request, ...roles: RoleKey[]) => !!req.user?.roles.some((r) => roles.includes(r));
export const can = async (req: Request, perm: PermissionKey) => !!req.user && (await permissionsOfRoles(req.user.roles)).has(perm);
