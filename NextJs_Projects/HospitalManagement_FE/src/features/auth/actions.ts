'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { authService } from '@/server/services/auth.service';
import { mfaService } from '@/server/auth/mfa';
import { getPrincipal } from '@/server/auth/session';
import { run, runPublic, type ActionState } from '@/server/http/action';
import { zodFields } from '@/server/http/api';
import { changePasswordSchema, forgotSchema, loginSchema, mfaVerifySchema, registerPatientSchema, resetSchema } from '@/lib/validations/auth';
import { notificationPrefSchema } from '@/lib/validations/admin';
import { notificationService } from '@/server/services/notification.service';
import { AppError } from '@/server/utilities/errors';

/** Only same-origin relative paths are allowed for "redirect after login" (open-redirect protection). */
const safeNext = (n: string | null | undefined, fallback: string) => (n && n.startsWith('/') && !n.startsWith('//') && !n.startsWith('/login') ? n : fallback);

/** Login: form action used with useActionState (works before hydration). Branches to /mfa when a TOTP challenge is required. */
export async function loginAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({ email: fd.get('email'), password: fd.get('password') });
  if (!parsed.success) return { ok: false, message: 'Enter your e-mail and password', fieldErrors: zodFields(parsed.error) };
  const r = await runPublic(() => authService.login(parsed.data.email, parsed.data.password));
  if (!r.ok) return r;
  const next = String(fd.get('next') ?? '');
  if (r.data!.status === 'mfa') redirect(`/mfa${next ? `?next=${encodeURIComponent(next)}` : ''}`);
  redirect(safeNext(next, (r.data as { home: string }).home));
}
export async function mfaLoginAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = mfaVerifySchema.safeParse({ code: fd.get('code') });
  if (!parsed.success) return { ok: false, fieldErrors: { code: parsed.error.issues[0].message } };
  const r = await runPublic(() => authService.completeMfa(parsed.data.code));
  if (!r.ok) return r;
  redirect(safeNext(String(fd.get('next') ?? ''), r.data!.home));
}
/** Scenario 1: typed object from React Hook Form (client Zod) validated AGAIN here, then redirect to the patient dashboard. */
export async function registerPatientAction(values: unknown): Promise<ActionState> {
  const r = await runPublic(async () => authService.registerPatient(registerPatientSchema.parse(values)));
  if (!r.ok) return r;
  redirect('/patient?welcome=1');
}
export async function logoutAction(): Promise<void> { await authService.logout(); redirect('/login'); }
export async function forgotPasswordAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = forgotSchema.safeParse({ email: fd.get('email') }); if (!parsed.success) return { ok: false, fieldErrors: { email: parsed.error.issues[0].message } };
  await authService.forgotPassword(parsed.data.email).catch(() => undefined);
  return { ok: true, message: 'If that e-mail is registered, a reset link has been sent.' };
}
export async function resetPasswordAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = resetSchema.safeParse({ token: fd.get('token'), password: fd.get('password'), confirmPassword: fd.get('confirmPassword') });
  if (!parsed.success) return { ok: false, message: 'Please fix the highlighted fields', fieldErrors: zodFields(parsed.error) };
  const r = await runPublic(() => authService.resetPassword(parsed.data.token, parsed.data.password), 'Password updated - you can sign in now.');
  return r;
}
export async function changePasswordAction(values: unknown): Promise<ActionState> { return run(async (p) => { const d = changePasswordSchema.parse(values); await authService.changePassword(p.userId, d.currentPassword, d.newPassword); }, 'Password changed. Other devices were signed out.'); }
/** MFA management (TOTP). */
export async function beginMfaAction() { return run((p) => mfaService.beginEnrollment(p.userId, p.email)); }
export async function confirmMfaAction(code: string) { return run(async (p) => ({ recoveryCodes: await mfaService.confirmEnrollment(p.userId, z.string().min(6).parse(code)) }), 'Two-factor authentication is on.'); }
export async function disableMfaAction() { const r = await run((p) => mfaService.disable(p.userId), 'Two-factor authentication is off.'); revalidatePath('/account'); return r; }
export async function savePreferencesAction(values: unknown) { return run((p) => notificationService.setPreferences(p, notificationPrefSchema.parse(values)), 'Preferences saved'); }
export const currentUserHome = async () => (await getPrincipal()) ?? (() => { throw new AppError(401, 'UNAUTHORIZED', 'Sign in'); })();
