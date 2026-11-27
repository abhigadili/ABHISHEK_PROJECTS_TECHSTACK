import type { AccessTokenClaims } from '@/types';

/**
 * Decodes (does NOT verify) a JWT payload. Used only to read `exp` for proactive renewal and UX decisions;
 * the backend remains the only authority on whether a token is valid.
 */
export function decodeJwt(token: string): AccessTokenClaims | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '='));
    return JSON.parse(json) as AccessTokenClaims;
  } catch {
    return null;
  }
}
