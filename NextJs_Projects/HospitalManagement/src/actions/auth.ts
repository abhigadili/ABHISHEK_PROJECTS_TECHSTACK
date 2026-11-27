'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authService } from '@/services/backend/auth';
import { clearSessionCookies, setSessionCookies } from '@/lib/auth/session';
import { accountSchema, loginSchema } from '@/schemas/auth';
import { failure, invalid, type ActionState } from '@/lib/actions/state';
import { RT_COOKIE } from '@/lib/auth/constants';

/** Only same-origin relative paths may be used for "redirect after login" (open-redirect protection). */
const safeNext = (n: string) => (n.startsWith('/') && !n.startsWith('//') && !n.startsWith('/login') ? n : '/dashboard');

/** Login: Server Action used with useActionState; JWT pair is stored in HttpOnly cookies, never returned to the client. */
export async function loginAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({ username: fd.get('username'), password: fd.get('password') });
  if (!parsed.success) return invalid(parsed.error);
  try {
    const t = await authService.login(parsed.data);
    await setSessionCookies(t);
  } catch (e) { return failure(e); }
  redirect(safeNext(String(fd.get('next') ?? '')));
}

/** Account registration (PATIENT role) -> auto sign-in -> continue with the patient profile wizard. */
export async function registerAccountAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = accountSchema.safeParse({ username: fd.get('username'), email: fd.get('email'), password: fd.get('password'), confirmPassword: fd.get('confirmPassword') });
  if (!parsed.success) return invalid(parsed.error);
  try {
    await authService.register({ username: parsed.data.username, email: parsed.data.email, password: parsed.data.password });
    await setSessionCookies(await authService.login({ username: parsed.data.username, password: parsed.data.password }));
  } catch (e) { return failure(e); }
  redirect('/patients/register');
}

export async function logoutAction(): Promise<void> {
  const rt = (await cookies()).get(RT_COOKIE)?.value;
  if (rt) await authService.logout(rt).catch(() => undefined); // revoke the refresh-token family on the backend
  await clearSessionCookies();
  redirect('/login');
}
