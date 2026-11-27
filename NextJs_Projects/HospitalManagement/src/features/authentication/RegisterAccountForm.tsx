'use client';
import { useActionState } from 'react';
import Link from 'next/link';
import { registerAccountAction } from '@/actions/auth';
import { Field, Input } from '@/components/ui/input';
import { SubmitButton } from '@/features/SubmitButton';
import { Alert } from '@/components/ui/empty-state';
import type { ActionState } from '@/lib/actions/state';

const initial: ActionState = { ok: false };
export function RegisterAccountForm() {
  const [s, action] = useActionState(registerAccountAction, initial);
  const e = s.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      {s.message && <Alert tone="danger">{s.message}</Alert>}
      <Field label="Username" htmlFor="username" required error={e.username} hint="4-60 letters, digits, . _ -"><Input id="username" name="username" autoComplete="username" aria-invalid={!!e.username} /></Field>
      <Field label="E-mail" htmlFor="email" required error={e.email}><Input id="email" name="email" type="email" autoComplete="email" aria-invalid={!!e.email} /></Field>
      <Field label="Password" htmlFor="password" required error={e.password} hint="8+ characters with upper, lower case and a digit"><Input id="password" name="password" type="password" autoComplete="new-password" aria-invalid={!!e.password} /></Field>
      <Field label="Confirm password" htmlFor="confirmPassword" required error={e.confirmPassword}><Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" aria-invalid={!!e.confirmPassword} /></Field>
      <SubmitButton className="w-full" pendingText="Creating account…">Create account & continue</SubmitButton>
      <p className="text-center text-sm text-muted">Already registered? <Link className="font-medium text-primary hover:underline" href="/login">Sign in</Link></p>
    </form>
  );
}
