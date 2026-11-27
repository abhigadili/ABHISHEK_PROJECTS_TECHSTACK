import type { AccessTokenClaims, Role } from '@/types';

/** Decode (NOT verify) a JWT payload. The backend verifies the signature on every call; we only read exp/roles for UX + routing. */
export function decodeJwt(token: string | undefined | null): AccessTokenClaims | null {
  if (!token) return null;
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decodeURIComponent(escape(json))) as AccessTokenClaims;
  } catch {
    return null;
  }
}

export function roleFromClaims(c: AccessTokenClaims | null): Role | undefined {
  if (!c?.roles) return undefined;
  const r = Array.isArray(c.roles) ? c.roles[0] : c.roles;
  return r?.replace(/^ROLE_/, '') as Role | undefined;
}

export const isExpired = (c: AccessTokenClaims | null, skewSeconds = 0) => !c || c.exp * 1000 <= Date.now() + skewSeconds * 1000;
