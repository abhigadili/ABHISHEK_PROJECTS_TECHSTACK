import 'server-only';
import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';
import { isProd } from './env';

/**
 * The backend returns tokens in the JSON body (it sets no cookies). The Next.js server therefore becomes the cookie authority:
 * tokens live ONLY in HttpOnly cookies set by Server Actions / Route Handlers / the proxy, so browser JavaScript can never read them
 * and nothing sensitive is kept in localStorage.
 */
export const ACCESS_COOKIE = 'ems_at';
export const REFRESH_COOKIE = 'ems_rt';

const base: Partial<ResponseCookie> = { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/' };

export interface TokenPair { accessToken: string; refreshToken: string; expiresIn?: string }

/** '15m' | '3600s' | '2h' | '7d' → seconds (the backend reports its JWT lifetime like this). */
export function ttlSeconds(expiresIn: string | undefined, fallback = 900): number {
  const m = /^(\d+)\s*([smhd])?$/.exec(expiresIn ?? '');
  if (!m) return fallback;
  return Number(m[1]) * ({ s: 1, m: 60, h: 3600, d: 86400 }[m[2] ?? 's'] ?? 1);
}

/** Cookie definitions for a fresh token pair. The access cookie expires 60 s BEFORE the JWT so a render never starts with a token that is about to die. */
export function sessionCookies(t: TokenPair): { name: string; value: string; options: Partial<ResponseCookie> }[] {
  const access = Math.max(ttlSeconds(t.expiresIn) - 60, 30);
  return [
    { name: ACCESS_COOKIE, value: t.accessToken, options: { ...base, maxAge: access } },
    { name: REFRESH_COOKIE, value: t.refreshToken, options: { ...base, maxAge: 7 * 86400 } },
  ];
}
export const expiredCookies = () => [ACCESS_COOKIE, REFRESH_COOKIE].map((name) => ({ name, value: '', options: { ...base, maxAge: 0 } }));

/** Works with the object returned by `await cookies()` in Server Actions and Route Handlers. */
export function writeSession(store: { set: (name: string, value: string, opts?: Partial<ResponseCookie>) => unknown }, t: TokenPair) {
  for (const c of sessionCookies(t)) store.set(c.name, c.value, c.options);
}
export function clearSession(store: { set: (name: string, value: string, opts?: Partial<ResponseCookie>) => unknown }) {
  for (const c of expiredCookies()) store.set(c.name, c.value, c.options);
}
