'use client';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useActionState, useEffect, useOptimistic, useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/Feedback';
import { Field, FormError, Input, Select } from '@/components/ui/Field';
import { SubmitButton } from '@/components/forms/SubmitButton';
import { deletePassengerAction, savePassengerAction } from '@/features/passengers/actions';
import { useConfirm, useToast } from '@/hooks';
import type { ActionResult, SavedPassenger } from '@/types';

function PassengerForm({ editing, onDone }: { editing: SavedPassenger | null; onDone: () => void }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(savePassengerAction, null); const toast = useToast();
  useEffect(() => { if (state?.ok) { toast('success', state.message ?? 'Saved'); onDone(); } }, [state, toast, onDone]);
  const fe = state && !state.ok ? state.fieldErrors ?? {} : {};
  return (
    <form action={action} noValidate className="mt-4 grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="id" value={editing?.id ?? ''} />
      {state && !state.ok && !Object.keys(fe).length && <div className="sm:col-span-2"><FormError>{state.message}</FormError></div>}
      <Field className="sm:col-span-2" label="Full name" error={fe.name}><Input name="name" defaultValue={editing?.name} /></Field>
      <Field label="Age" error={fe.age}><Input name="age" type="number" defaultValue={editing?.age} /></Field>
      <Field label="Gender" error={fe.gender}><Select name="gender" defaultValue={editing?.gender ?? ''}><option value="">Select</option><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option></Select></Field>
      <Field className="sm:col-span-2" label="Mobile (optional)" error={fe.mobile}><Input name="mobile" maxLength={10} defaultValue={editing?.mobile ?? ''} /></Field>
      <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={onDone}>Cancel</Button><SubmitButton>Save</SubmitButton></div>
    </form>
  );
}
/** `initial` comes from a Server Component. useOptimistic removes a deleted passenger from the list instantly and rolls back if the action fails. */
export function SavedPassengersManager({ initial }: { initial: SavedPassenger[] }) {
  const [list, removeOptimistic] = useOptimistic(initial, (cur, id: number) => cur.filter((p) => p.id !== id));
  const [, start] = useTransition(); const confirm = useConfirm(); const toast = useToast(); const [dlg, setDlg] = useState<{ editing: SavedPassenger | null } | null>(null);
  const del = async (p: SavedPassenger) => {
    if (!(await confirm({ title: 'Delete passenger?', message: `${p.name} will be removed from your saved list. Past bookings are not affected.`, danger: true, confirmText: 'Delete' }))) return;
    start(async () => { removeOptimistic(p.id); const r = await deletePassengerAction(p.id); if (!r.ok) toast('error', 'Could not delete', r.message); });
  };
  return (
    <>
      <div className="mb-4 flex justify-end"><Button onClick={() => setDlg({ editing: null })}><Plus size={16} />Add passenger</Button></div>
      {list.length === 0 ? <EmptyState title="No saved passengers" hint="Add the people you travel with." /> : (
        <div className="grid gap-3 sm:grid-cols-2">{list.map((p) => <Card key={p.id}><CardBody className="flex items-center justify-between"><div><p className="font-semibold">{p.name}</p><p className="text-sm text-slate-500">{p.age} yrs · {p.gender.toLowerCase()}{p.mobile ? ` · ${p.mobile}` : ''}</p></div>
          <div className="flex gap-1"><Button size="icon" variant="ghost" aria-label={`Edit ${p.name}`} onClick={() => setDlg({ editing: p })}><Pencil size={16} /></Button><Button size="icon" variant="ghost" aria-label={`Delete ${p.name}`} onClick={() => del(p)}><Trash2 size={16} /></Button></div></CardBody></Card>)}</div>)}
      <Dialog open={!!dlg} onOpenChange={(o) => !o && setDlg(null)} title={dlg?.editing ? 'Edit passenger' : 'Add passenger'}>{dlg && <PassengerForm key={dlg.editing?.id ?? 'new'} editing={dlg.editing} onDone={() => setDlg(null)} />}</Dialog>
    </>
  );
}
