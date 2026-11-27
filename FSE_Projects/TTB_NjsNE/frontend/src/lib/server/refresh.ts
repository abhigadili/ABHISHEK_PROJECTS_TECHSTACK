import { RT_COOKIE } from '@/lib/constants';
import type { Envelope, User } from '@/types';

/** Origin of the Express API. Read on the server only; the browser talks to Next, never to Express. */
export const API_ORIGIN = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

export interface AuthResult { user: User; accessToken: string; refreshToken: string; refreshMaxAge: number }

/** Pull the rotated refresh token (and its lifetime) out of the backend's Set-Cookie header. */
export function readRefreshCookie(res: Response): { token: string; maxAge: number } | null {
  for (const line of res.headers.getSetCookie()) {
    const m = new RegExp(`^${RT_COOKIE}=([^;]*)`).exec(line);
    if (m && m[1]) { const age = /Max-Age=(\d+)/i.exec(line); return { token: decodeURIComponent(m[1]), maxAge: age ? Number(age[1]) : 7 * 86400 }; }
  }
  return null;
}
/** Exp (seconds since epoch) of a JWT, without verifying it - only used to schedule refreshes / cookie lifetimes. */
export function jwtExp(token: string): number {
  try { return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).exp as number; } catch { return 0; }
}

type Flight = { at: number; promise: Promise<AuthResult | null> };
const g = globalThis as unknown as { __ttbRefresh?: Map<string, Flight> };
const flights = (g.__ttbRefresh ??= new Map<string, Flight>());

/**
 * Single-flight refresh. The backend rotates refresh tokens and treats re-use of an old one as theft (it revokes the whole
 * family). Parallel requests that carry the same expired session therefore MUST share one backend call: the first caller
 * starts it, everyone else awaits the same promise, and the result is remembered for 30 s for late arrivals that still carry the old cookie.
 * Lives on globalThis so proxy.ts, route handlers and Server Components in the same Node process share it.
 */
export function refreshOnce(oldRefreshToken: string): Promise<AuthResult | null> {
  const now = Date.now();
  for (const [k, f] of flights) if (now - f.at > 30_000) flights.delete(k);
  const hit = flights.get(oldRefreshToken); if (hit) return hit.promise;
  const promise = (async () => {
    try {
      const res = await fetch(`${API_ORIGIN}/api/auth/refresh`, { method: 'POST', headers: { cookie: `${RT_COOKIE}=${encodeURIComponent(oldRefreshToken)}` }, cache: 'no-store' });
      if (!res.ok) return null;
      const body = (await res.json()) as Envelope<{ user: User; accessToken: string }>; const rt = readRefreshCookie(res);
      return rt ? { user: body.data.user, accessToken: body.data.accessToken, refreshToken: rt.token, refreshMaxAge: rt.maxAge } : null;
    } catch { return null; }
  })();
  flights.set(oldRefreshToken, { at: now, promise });
  return promise;
}
