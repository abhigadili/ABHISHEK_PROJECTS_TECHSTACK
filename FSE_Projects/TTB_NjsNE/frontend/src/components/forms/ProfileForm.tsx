'use client';
import { useActionState, useEffect } from 'react';
import { Field, FormError, Input } from '@/components/ui/Field';
import { updateProfileAction } from '@/features/users/actions';
import { useToast } from '@/hooks';
import type { ActionResult, User } from '@/types';
import { SubmitButton } from './SubmitButton';

/**
 * Native <form action> + useActionState: the Server Action receives FormData, validates with Zod on the server and returns a structured
 * ActionResult (discriminated union) that this component narrows on. Works before hydration too (progressive enhancement).
 */
export function ProfileForm({ user }: { user: User }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(updateProfileAction, null); const toast = useToast();
  useEffect(() => { if (state?.ok) toast('success', state.message ?? 'Saved'); }, [state, toast]);
  const fe = state && !state.ok ? state.fieldErrors ?? {} : {};
  return (
    <form action={action} noValidate className="grid gap-4 sm:grid-cols-2">
      {state && !state.ok && !Object.keys(fe).length && <div className="sm:col-span-2"><FormError>{state.message}</FormError></div>}
      <Field label="Full name" error={fe.name}><Input name="name" defaultValue={user.name} autoComplete="name" /></Field>
      <Field label="Mobile" error={fe.mobile}><Input name="mobile" defaultValue={user.mobile} maxLength={10} inputMode="numeric" /></Field>
      <Field label="E-mail" hint="E-mail cannot be changed"><Input value={user.email} disabled readOnly /></Field>
      <div className="flex items-end"><SubmitButton>Save changes</SubmitButton></div>
    </form>
  );
}
