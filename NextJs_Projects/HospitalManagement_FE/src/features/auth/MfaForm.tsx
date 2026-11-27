'use client';
import { useActionState } from 'react';
import { mfaLoginAction } from './actions';
import { Field, Input } from '@/components/ui/input';
import { SubmitButton } from '@/components/common/SubmitButton';
import { Alert } from '@/components/ui/empty-state';
import type { ActionState } from '@/server/http/action';
export function MfaForm({ next }: { next: string }) {
  const [s, action] = useActionState<ActionState, FormData>(mfaLoginAction, { ok: false });
  return <form action={action} className="space-y-4" noValidate>{s.message && !s.ok && !s.fieldErrors && <Alert tone="danger">{s.message}</Alert>}<input type="hidden" name="next" value={next} /><Field label="6-digit code or recovery code" htmlFor="code" error={s.fieldErrors?.code}><Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" autoFocus aria-invalid={!!s.fieldErrors?.code} /></Field><SubmitButton className="w-full" pendingText="Verifying…">Verify</SubmitButton></form>;
}
