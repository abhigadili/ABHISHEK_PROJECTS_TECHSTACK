import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Role, TokenResponse, UserAccount } from '@/types';
import { AT_COOKIE, ROLE_COOKIE, RT_COOKIE, RT_MAX_AGE } from './constants';
import { decodeJwt, isExpired, roleFromClaims } from './jwt';
import { can, type Permission } from '@/constants/permissions';
import { serverEnv } from '@/lib/config/env';

export interface ServerSession {
  userId: number;
  username: string;
  email: string;
  role: Role;
  expiresAt: number;
  accessToken: string;
}

const cookieBase = { httpOnly: true, sameSite: 'lax' as const, secure: serverEnv.isProd && process.env.COOKIE_SECURE === 'true', path: '/' };

/** Persist the backend's token pair as HttpOnly cookies (Server Actions / Route Handlers only). */
export async function setSessionCookies(t: Pick<TokenResponse, 'accessToken' | 'refreshToken' | 'expiresInSeconds'> & { user?: UserAccount }) {
  const jar = await cookies();
  jar.set(AT_COOKIE, t.accessToken, { ...cookieBase, maxAge: t.expiresInSeconds + 120 }); // cookie outlives the JWT a bit so the proxy can still refresh
  jar.set(RT_COOKIE, t.refreshToken, { ...cookieBase, maxAge: RT_MAX_AGE });
  const role = t.user?.role ?? roleFromClaims(decodeJwt(t.accessToken));
  if (role) jar.set(ROLE_COOKIE, role, { ...cookieBase, httpOnly: false, maxAge: RT_MAX_AGE });
}

export async function clearSessionCookies() {
  const jar = await cookies();
  for (const n of [AT_COOKIE, RT_COOKIE, ROLE_COOKIE]) jar.delete(n);
}

/** Per-request memoised session read (React cache) - decoding is cheap, validation against the backend happens in getCurrentUser(). */
export const getSession = cache(async (): Promise<ServerSession | null> => {
  const jar = await cookies();
  const token = jar.get(AT_COOKIE)?.value;
  const claims = decodeJwt(token);
  if (!token || !claims || isExpired(claims)) return null;
  const role = roleFromClaims(claims);
  if (!role) return null;
  return { userId: Number(claims.sub), username: claims.preferred_username ?? '', email: claims.email ?? '', role, expiresAt: claims.exp * 1000, accessToken: token };
});

export async function getAccessToken() {
  return (await getSession())?.accessToken ?? null;
}

/** Server-side authentication check for pages/layouts. */
export async function requireSession(nextPath?: string): Promise<ServerSession> {
  const s = await getSession();
  if (!s) redirect(`/login${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ''}`);
  return s;
}

/** Server-side authorization check - the real security boundary (the proxy is only a convenience layer). */
export async function requirePermission(permission: Permission): Promise<ServerSession> {
  const s = await requireSession();
  if (!can(s.role, permission)) redirect('/access-denied');
  return s;
}
