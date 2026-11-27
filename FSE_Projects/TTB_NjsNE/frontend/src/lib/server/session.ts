import 'server-only';
import { cookies, headers } from 'next/headers';
import { forbidden, redirect } from 'next/navigation';
import { cache } from 'react';
import { AT_COOKIE, ROLE_COOKIE, RT_COOKIE } from '@/lib/constants';
import type { Envelope, RoleKey, User } from '@/types';
import { API_ORIGIN, jwtExp, type AuthResult } from './refresh';

const secure = process.env.NODE_ENV === 'production' && (process.env.NEXT_PUBLIC_SITE_URL ?? '').startsWith('https');
export interface CookieSink { set(name: string, value: string, opts: { httpOnly?: boolean; secure?: boolean; sameSite?: 'lax'; path?: string; maxAge?: number }): unknown; delete(name: string): unknown }

/** Write the session cookies (HttpOnly). Used by login/refresh in Server Actions, route handlers and proxy.ts. */
export function writeSession(store: CookieSink, a: Pick<AuthResult, 'accessToken' | 'refreshToken' | 'refreshMaxAge' | 'user'>) {
  const base = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/' };
  store.set(AT_COOKIE, a.accessToken, { ...base, maxAge: Math.max(30, jwtExp(a.accessToken) - Math.floor(Date.now() / 1000)) });
  store.set(RT_COOKIE, a.refreshToken, { ...base, maxAge: a.refreshMaxAge });
  store.set(ROLE_COOKIE, a.user.roles.join(','), { ...base, maxAge: a.refreshMaxAge }); // coarse hint for proxy.ts only
}
export function clearSession(store: CookieSink) { for (const n of [AT_COOKIE, RT_COOKIE, ROLE_COOKIE]) store.delete(n); }

export async function getAccessToken() { return (await cookies()).get(AT_COOKIE)?.value; }

/**
 * Current user (Server Components, layouts, actions). Memoised per request with React `cache`, so layout + page + actions share one /auth/me call.
 * Never cached across requests: it depends on the caller's cookie.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const at = await getAccessToken(); if (!at) return null;
  const res = await fetch(`${API_ORIGIN}/api/auth/me`, { headers: { authorization: `Bearer ${at}` }, cache: 'no-store' });
  if (!res.ok) return null;
  return ((await res.json()) as Envelope<User>).data;
});

/** Guard for protected layouts/pages: sign-in required, optional role list. Authorization is ALSO enforced by Express. */
export async function requireUser(roles?: readonly RoleKey[]): Promise<User> {
  const user = await getCurrentUser();
  if (!user) { const path = (await headers()).get('x-pathname') ?? '/account'; redirect(`/login?next=${encodeURIComponent(path)}`); }
  if (roles && !roles.some((r) => user.roles.includes(r))) forbidden();
  return user;
}
