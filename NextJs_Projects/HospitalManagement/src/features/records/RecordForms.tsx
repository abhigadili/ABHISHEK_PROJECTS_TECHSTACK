'use client';
import { useActionState, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { createRecordEntryAction, saveConditionsAction } from '@/actions/records';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { SubmitButton } from '@/features/SubmitButton';
import { emitToast } from '@/components/ui/toast';
import { Alert } from '@/components/ui/empty-state';
import { RECORD_ENTRY_TYPES } from '@/types';
import { humanize } from '@/lib/utilities/format';
import type { ActionState } from '@/lib/actions/state';

const init: ActionState = { ok: false };
export function AddRecordEntry({ patientId }: { patientId: number }) {
  const [open, setOpen] = useState(false);
  const [s, action] = useActionState(async (prev: ActionState, fd: FormData) => { const r = await createRecordEntryAction(patientId, prev, fd); if (r.ok) { emitToast({ kind: 'success', text: r.message! }); setOpen(false); } return r; }, init);
  const e = s.fieldErrors ?? {};
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="size-4" />Add entry</Button></DialogTrigger>
      <DialogContent title="Add medical record entry" description="Manual entries can be edited later; entries created from lab or prescription events are read-only.">
        <form action={action} className="space-y-3" noValidate>
          {s.message && !s.ok && !Object.keys(e).length && <Alert tone="danger">{s.message}</Alert>}
          <Field label="Type" htmlFor="entryType" error={e.entryType}><Select id="entryType" name="entryType" defaultValue="NOTE">{RECORD_ENTRY_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}</Select></Field>
          <Field label="Title" htmlFor="title" required error={e.title}><Input id="title" name="title" aria-invalid={!!e.title} /></Field>
          <Field label="Details" htmlFor="details" error={e.details}><Textarea id="details" name="details" rows={4} /></Field>
          <div className="flex justify-end"><SubmitButton pendingText="Saving…">Save entry</SubmitButton></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ConditionsForm({ patientId, value, canEdit }: { patientId: number; value: string; canEdit: boolean }) {
  const [s, action] = useActionState(saveConditionsAction.bind(null, patientId), init);
  useEffect(() => { if (s.ok) emitToast({ kind: 'success', text: s.message! }); }, [s]);
  if (!canEdit) return <p className="text-sm">{value || 'None recorded.'}</p>;
  return (
    <form action={action} className="max-w-xl space-y-3">
      <Field label="Chronic conditions" htmlFor="chronicConditions" error={s.fieldErrors?.chronicConditions}><Textarea id="chronicConditions" name="chronicConditions" defaultValue={value} rows={4} /></Field>
      <SubmitButton size="sm" pendingText="Saving…">Save</SubmitButton>
    </form>
  );
}
