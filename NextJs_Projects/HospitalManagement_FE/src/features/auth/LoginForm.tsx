'use client';
import { useActionState } from 'react';
import Link from 'next/link';
import { loginAction } from './actions';
import { Field, Input } from '@/components/ui/input';
import { SubmitButton } from '@/components/common/SubmitButton';
import { Alert } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import type { ActionState } from '@/server/http/action';
/** useActionState + Server Action form (works before hydration). Field errors come back from server-side Zod validation. */
export function LoginForm({ next, error, googleEnabled }: { next: string; error?: string; googleEnabled: boolean }) {
  const [s, action] = useActionState<ActionState, FormData>(loginAction, { ok: false });
  const e = s.fieldErrors ?? {};
  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4" noValidate>
        {error && <Alert tone="danger">{error}</Alert>}{s.message && !s.ok && <Alert tone="danger">{s.message}</Alert>}
        <input type="hidden" name="next" value={next} />
        <Field label="E-mail" htmlFor="email" error={e.email}><Input id="email" name="email" type="email" autoComplete="email" autoFocus aria-invalid={!!e.email} /></Field>
        <Field label="Password" htmlFor="password" error={e.password}><Input id="password" name="password" type="password" autoComplete="current-password" aria-invalid={!!e.password} /></Field>
        <SubmitButton className="w-full" pendingText="Signing in…">Sign in</SubmitButton>
        <p className="flex justify-between text-sm"><Link className="text-primary hover:underline" href="/forgot-password">Forgot password?</Link><Link className="text-primary hover:underline" href="/register">Create account</Link></p>
      </form>
      {googleEnabled ? <Button asChild variant="outline" className="w-full"><a href="/api/v1/auth/oauth/google">Continue with Google</a></Button> : <p className="text-center text-xs text-muted">Google sign-in is disabled (set OAUTH_GOOGLE_* in the environment to enable it).</p>}
    </div>
  );
}
