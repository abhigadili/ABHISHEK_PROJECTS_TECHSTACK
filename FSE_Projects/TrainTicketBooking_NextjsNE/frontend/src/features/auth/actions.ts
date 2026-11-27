'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { API_ORIGIN, readRefreshCookie } from '@/lib/server/refresh';
import { clearSession, getCurrentUser, writeSession } from '@/lib/server/session';
import { backend, BackendError } from '@/lib/server/backend';
import { failure, parse } from '@/lib/server/action-utils';
import { AT_COOKIE, RT_COOKIE } from '@/lib/constants';
import { changePasswordSchema, forgotSchema, loginSchema, registerSchema, resetSchema } from '@/validations/auth';
import type { ActionResult, Envelope, User } from '@/types';

/** Only same-site relative paths may be used as post-login targets (prevents open redirects). */
const safeNext = (n?: string) => (n && n.startsWith('/') && !n.startsWith('//') ? n : '/account');

/** Server Action: log in against Express, then keep the tokens in HttpOnly cookies owned by Next. */
export async function loginAction(input: { email: string; password: string; next?: string }): Promise<ActionResult> {
  const v = parse(loginSchema, input); if (!v.ok) return v.result;
  let target = '/account';
  try {
    const res = await fetch(`${API_ORIGIN}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(v.data), cache: 'no-store' });
    const json = (await res.json().catch(() => null)) as (Envelope<{ user: User; accessToken: string }> & { error?: { message: string; fields?: Record<string, string> } }) | null;
    if (!res.ok || !json?.success) throw new BackendError(json?.error?.message ?? 'Login failed', res.status, 'LOGIN', json?.error?.fields);
    const rt = readRefreshCookie(res); if (!rt) throw new BackendError('The server did not issue a session.', 502);
    writeSession(await cookies(), { user: json.data.user, accessToken: json.data.accessToken, refreshToken: rt.token, refreshMaxAge: rt.maxAge });
    target = safeNext(input.next);
    if (target === '/account' && json.data.user.roles.some((r) => r !== 'PASSENGER') && !json.data.user.roles.includes('PASSENGER')) target = '/admin';
  } catch (e) { return failure(e); }
  redirect(target);
}

export async function registerAction(input: unknown): Promise<ActionResult> {
  const v = parse(registerSchema, input); if (!v.ok) return v.result;
  try { await backend('/auth/register', { method: 'POST', body: v.data, auth: false }); } catch (e) { return failure(e); }
  redirect('/login?registered=1');
}

export async function logoutAction(): Promise<void> {
  const jar = await cookies(); const rt = jar.get(RT_COOKIE)?.value;
  if (rt) await fetch(`${API_ORIGIN}/api/auth/logout`, { method: 'POST', headers: { cookie: `${RT_COOKIE}=${encodeURIComponent(rt)}` }, cache: 'no-store' }).catch(() => undefined);
  clearSession(jar); revalidatePath('/', 'layout'); redirect('/');
}

export async function forgotPasswordAction(input: unknown): Promise<ActionResult> {
  const v = parse(forgotSchema, input); if (!v.ok) return v.result;
  try { await backend('/auth/forgot-password', { method: 'POST', body: v.data, auth: false }); return { ok: true, message: 'If that e-mail is registered, a reset link is on its way.' }; } catch (e) { return failure(e); }
}
export async function resetPasswordAction(input: unknown): Promise<ActionResult> {
  const v = parse(resetSchema, input); if (!v.ok) return v.result;
  try { await backend('/auth/reset-password', { method: 'POST', body: v.data, auth: false }); } catch (e) { return failure(e); }
  redirect('/login?reset=1');
}
export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  if (!(await getCurrentUser())) redirect('/login');
  const v = parse(changePasswordSchema, input); if (!v.ok) return v.result;
  try {
    const rt = (await cookies()).get(RT_COOKIE)?.value;
    const res = await fetch(`${API_ORIGIN}/api/auth/change-password`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${(await cookies()).get(AT_COOKIE)?.value}`, cookie: rt ? `${RT_COOKIE}=${encodeURIComponent(rt)}` : '' }, body: JSON.stringify(v.data), cache: 'no-store' });
    const json = (await res.json().catch(() => null)) as { success?: boolean; error?: { message: string; fields?: Record<string, string> } } | null;
    if (!res.ok || !json?.success) throw new BackendError(json?.error?.message ?? 'Could not change password', res.status, 'CHANGE', json?.error?.fields);
    return { ok: true, message: 'Password changed. Other devices have been signed out.' };
  } catch (e) { return failure(e); }
}
