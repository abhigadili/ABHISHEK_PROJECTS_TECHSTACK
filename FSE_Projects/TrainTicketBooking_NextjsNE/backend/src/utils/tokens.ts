import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import type { RoleKey } from '../constants/rbac';
export interface AccessClaims { sub: string; roles: RoleKey[] }
/** Short-lived access token (HS256). Verified with issuer + audience on every protected request. */
export const signAccessToken = (userId: number, roles: RoleKey[]) => jwt.sign({ roles }, env.JWT_ACCESS_SECRET, { subject: String(userId), expiresIn: env.ACCESS_TOKEN_EXPIRY as jwt.SignOptions['expiresIn'], issuer: 'ttb-api', audience: 'ttb-web', algorithm: 'HS256' });
export function verifyAccessToken(token: string): AccessClaims | null {
  try { return jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: 'ttb-api', audience: 'ttb-web', algorithms: ['HS256'] }) as unknown as AccessClaims; } catch { return null; }
}
