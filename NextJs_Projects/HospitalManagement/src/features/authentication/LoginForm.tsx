'use client';
import { useActionState } from 'react';
import Link from 'next/link';
import { loginAction } from '@/actions/auth';
import { Field, Input } from '@/components/ui/input';
import { SubmitButton } from '@/features/SubmitButton';
import { Alert } from '@/components/ui/empty-state';
import type { ActionState } from '@/lib/actions/state';

const initial: ActionState = { ok: false };
/** useActionState + Server Action form: works before hydration too (progressive enhancement). Server-side Zod errors come back as fieldErrors. */
export function LoginForm({ next, reason }: { next: string; reason?: string }) {
  const [state, action] = useActionState(loginAction, initial);
  return (
    <form action={action} className="space-y-4" noValidate>
      {reason === 'expired' && <Alert tone="warn">Your session expired. Please sign in again.</Alert>}
      {state.message && !state.fieldErrors?.username && !state.fieldErrors?.password && <Alert tone="danger">{state.message}</Alert>}
      <input type="hidden" name="next" value={next} />
      <Field label="Username" htmlFor="username" error={state.fieldErrors?.username}><Input id="username" name="username" autoComplete="username" autoFocus aria-invalid={!!state.fieldErrors?.username} /></Field>
      <Field label="Password" htmlFor="password" error={state.fieldErrors?.password}><Input id="password" name="password" type="password" autoComplete="current-password" aria-invalid={!!state.fieldErrors?.password} /></Field>
      <SubmitButton className="w-full" pendingText="Signing in…">Sign in</SubmitButton>
      <p className="text-center text-sm text-muted">New patient? <Link className="font-medium text-primary hover:underline" href="/register">Create an account</Link></p>
    </form>
  );
}
