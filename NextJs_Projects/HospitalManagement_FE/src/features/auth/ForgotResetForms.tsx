'use client';
import { useActionState } from 'react';
import Link from 'next/link';
import { forgotPasswordAction, resetPasswordAction } from './actions';
import { Field, Input } from '@/components/ui/input';
import { SubmitButton } from '@/components/common/SubmitButton';
import { Alert } from '@/components/ui/empty-state';
import type { ActionState } from '@/server/http/action';
export function ForgotForm() {
  const [s, action] = useActionState<ActionState, FormData>(forgotPasswordAction, { ok: false });
  return <form action={action} className="space-y-4" noValidate>{s.ok && <Alert tone="ok">{s.message}</Alert>}<Field label="E-mail" htmlFor="email" error={s.fieldErrors?.email}><Input id="email" name="email" type="email" autoFocus /></Field><SubmitButton className="w-full" pendingText="Sending…">Send reset link</SubmitButton><p className="text-center text-sm"><Link className="text-primary hover:underline" href="/login">Back to sign in</Link></p></form>;
}
export function ResetForm({ token }: { token: string }) {
  const [s, action] = useActionState<ActionState, FormData>(resetPasswordAction, { ok: false }); const e = s.fieldErrors ?? {};
  if (s.ok) return <div className="space-y-3"><Alert tone="ok">{s.message}</Alert><Link className="text-primary hover:underline" href="/login">Go to sign in</Link></div>;
  return <form action={action} className="space-y-4" noValidate>{s.message && <Alert tone="danger">{s.message}</Alert>}<input type="hidden" name="token" value={token} /><Field label="New password" htmlFor="pw" error={e.password} hint="10+ characters with upper, lower case and a digit"><Input id="pw" name="password" type="password" autoComplete="new-password" /></Field><Field label="Confirm password" htmlFor="cpw" error={e.confirmPassword}><Input id="cpw" name="confirmPassword" type="password" autoComplete="new-password" /></Field><SubmitButton className="w-full" pendingText="Saving…">Set new password</SubmitButton></form>;
}
