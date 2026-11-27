'use client';
import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { saveHospitalAction } from '@/actions/hospitals';
import { Field, Input } from '@/components/ui/input';
import { SubmitButton } from '@/features/SubmitButton';
import { Alert } from '@/components/ui/empty-state';
import { emitToast } from '@/components/ui/toast';
import type { ActionState } from '@/lib/actions/state';
import type { Hospital } from '@/types';

/** Server Action bound with the hospital id (`.bind(null, id)`) - the "Server Action Arguments" pattern - plus useActionState. */
export function HospitalForm({ hospital }: { hospital?: Hospital }) {
  const router = useRouter();
  const [s, action] = useActionState<ActionState<Hospital>, FormData>(saveHospitalAction.bind(null, hospital?.id ?? null), { ok: false });
  useEffect(() => { if (s.ok && s.data) { emitToast({ kind: 'success', text: s.message! }); router.push(`/hospitals/${s.data.id}`); } }, [s, router]);
  const e = s.fieldErrors ?? {};
  const f = (n: string, l: string, v?: string | null, req = false) => <Field label={l} htmlFor={n} required={req} error={e[n]}><Input id={n} name={n} defaultValue={v ?? ''} aria-invalid={!!e[n]} /></Field>;
  return (
    <form action={action} className="max-w-xl space-y-3" noValidate>
      {s.message && !s.ok && !Object.keys(e).length && <Alert tone="danger">{s.message}</Alert>}
      {f('name', 'Name', hospital?.name, true)}{f('code', 'Code', hospital?.code, true)}{f('address', 'Address', hospital?.address)}{f('city', 'City', hospital?.city)}{f('phone', 'Phone', hospital?.phone)}{f('email', 'E-mail', hospital?.email)}
      <SubmitButton pendingText="Saving…">{hospital ? 'Save changes' : 'Create hospital'}</SubmitButton>
    </form>
  );
}
