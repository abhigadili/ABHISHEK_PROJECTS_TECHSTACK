'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { REFRESH_COOKIE, clearSession, writeSession } from '@/lib/server/cookies';
import * as authApi from '@/lib/server/auth';
import { checkFile, fail, formString, formStrings, fromApiError, zodErrors, type ActionState } from './_shared';
import { changePasswordSchema, forgotSchema, loginSchema, registerSchema, resetSchema } from '@/schemas/forms';
import { safeNext } from '@/lib/utils/safe-redirect';
import { getSession } from '@/lib/server/session';
import { unstable_rethrow } from 'next/navigation';

/**
 * LOGIN — a Server Action used as a <form action>: works before JavaScript loads (progressive enhancement), validates on the server,
 * calls Express, stores the tokens in HttpOnly cookies and redirects. The password is never echoed back in `values`.
 */
export async function loginAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const raw = formStrings(fd, ['identifier']);
  const parsed = loginSchema.safeParse({ ...raw, password: String(fd.get('password') ?? '') });
  if (!parsed.success) return fail('Please fix the highlighted fields.', zodErrors(parsed.error.issues), raw);
  try {
    const res = await authApi.login(parsed.data.identifier, parsed.data.password);
    writeSession(await cookies(), res);
  } catch (e) {
    unstable_rethrow(e);
    const s = fromApiError(e, raw);
    return { ...s, fieldErrors: undefined }; // 401 → one generic message (never says which half was wrong)
  }
  redirect(safeNext(formString(fd, 'next')));
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  const rt = store.get(REFRESH_COOKIE)?.value;
  if (rt) await authApi.revokeRefreshToken(rt); // revoke server-side; local cleanup never depends on it
  clearSession(store);
  redirect('/login');
}

export async function registerAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const keys = ['firstName', 'lastName', 'username', 'email', 'mobile', 'dateOfBirth', 'gender', 'address', 'departmentId', 'designationId'];
  const raw = formStrings(fd, keys);
  const parsed = registerSchema.safeParse({ ...raw, password: String(fd.get('password') ?? ''), confirmPassword: String(fd.get('confirmPassword') ?? '') });
  const pic = checkFile(fd.get('file'), ['image/jpeg', 'image/png', 'image/webp']);
  if (!parsed.success || pic.error) {
    const errs = parsed.success ? {} : zodErrors(parsed.error.issues);
    if (pic.error) errs.file = pic.error;
    return fail('Please fix the highlighted fields.', errs, raw);
  }
  const body = new FormData(); // the backend contract: confirmPassword is NOT sent
  for (const k of [...keys, 'password']) {
    const v = k === 'password' ? parsed.data.password : (raw[k] as string);
    if (v !== '') body.append(k, v);
  }
  if (pic.file) body.append('file', pic.file, pic.file.name);
  try {
    const r = await authApi.register(body);
    redirect(`/login?registered=${encodeURIComponent(r.username)}`);
  } catch (e) {
    unstable_rethrow(e);
    return fromApiError(e, raw);
  }
}

export async function forgotPasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const raw = formStrings(fd, ['email']);
  const parsed = forgotSchema.safeParse(raw);
  if (!parsed.success) return fail('Enter a valid email address.', zodErrors(parsed.error.issues), raw);
  try {
    const res = await authApi.forgotPassword(parsed.data.email);
    // the backend always answers generically; a token only comes back when it runs with EXPOSE_RESET_TOKEN (dev/test)
    return { ok: true, message: 'If the account exists, reset instructions have been issued.', data: res?.resetToken ? { resetToken: res.resetToken } : undefined };
  } catch (e) {
    unstable_rethrow(e);
    return fromApiError(e, raw);
  }
}

export async function resetPasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const raw = formStrings(fd, ['token']);
  const parsed = resetSchema.safeParse({ ...raw, newPassword: String(fd.get('newPassword') ?? ''), confirmPassword: String(fd.get('confirmPassword') ?? '') });
  if (!parsed.success) return fail('Please fix the highlighted fields.', zodErrors(parsed.error.issues), raw);
  try {
    await authApi.resetPassword(parsed.data.token, parsed.data.newPassword);
  } catch (e) {
    unstable_rethrow(e);
    return fromApiError(e, raw);
  }
  redirect('/login?reset=1');
}

/** The backend revokes EVERY session on a password change, so we also clear our cookies and send the user to sign in again. */
export async function changePasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  if (!(await getSession())) return fail('You are not signed in');
  const parsed = changePasswordSchema.safeParse({ currentPassword: String(fd.get('currentPassword') ?? ''), newPassword: String(fd.get('newPassword') ?? ''), confirmPassword: String(fd.get('confirmPassword') ?? '') });
  if (!parsed.success) return fail('Please fix the highlighted fields.', zodErrors(parsed.error.issues));
  try {
    await authApi.changePassword(parsed.data.currentPassword, parsed.data.newPassword);
  } catch (e) {
    unstable_rethrow(e);
    return fromApiError(e);
  }
  clearSession(await cookies());
  redirect('/login?changed=1');
}

