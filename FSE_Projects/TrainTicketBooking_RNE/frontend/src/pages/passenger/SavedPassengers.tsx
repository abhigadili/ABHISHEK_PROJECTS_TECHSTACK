import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { passengerSchema } from '@shared/validations/booking';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui/Feedback';
import { Field, FormError, Input, Select } from '@/components/ui/Field';
import { useConfirm, useDocumentTitle, useToast } from '@/hooks';
import { useDeletePassenger, useSavedPassengers, useSavePassenger } from '@/services/queries';
import { applyServerErrors } from '@/utils/forms';
import type { SavedPassenger } from '@/types';

type Values = z.input<typeof passengerSchema>;
function PassengerForm({ editing, onDone }: { editing: SavedPassenger | null; onDone: () => void }) {
  const save = useSavePassenger(); const toast = useToast(); const [err, setErr] = useState<string>();
  const { register, handleSubmit, setError, formState: { errors } } = useForm<Values>({ resolver: zodResolver(passengerSchema), defaultValues: { name: editing?.name ?? '', age: editing?.age ?? ('' as never), gender: editing?.gender ?? ('' as never), mobile: editing?.mobile ?? '' } });
  return (
    <form noValidate className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={handleSubmit(async (v) => { try { await save.mutateAsync({ id: editing?.id, body: v }); toast('success', editing ? 'Passenger updated' : 'Passenger saved'); onDone(); } catch (e) { setErr(applyServerErrors(e, setError)); } })}>
      <FormError>{err}</FormError>
      <Field className="sm:col-span-2" label="Full name" error={errors.name?.message}><Input {...register('name')} /></Field>
      <Field label="Age" error={errors.age?.message}><Input type="number" {...register('age')} /></Field>
      <Field label="Gender" error={errors.gender?.message}><Select {...register('gender')}><option value="">Select</option><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option></Select></Field>
      <Field className="sm:col-span-2" label="Mobile (optional)" error={errors.mobile?.message}><Input inputMode="numeric" maxLength={10} {...register('mobile')} /></Field>
      <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={onDone}>Cancel</Button><Button type="submit" loading={save.isPending}>Save</Button></div>
    </form>
  );
}
export default function SavedPassengers() {
  useDocumentTitle('Saved passengers'); const q = useSavedPassengers(); const del = useDeletePassenger(); const confirm = useConfirm(); const [dlg, setDlg] = useState<{ editing: SavedPassenger | null } | null>(null);
  return (
    <div><PageHeader title="Saved passengers" subtitle="Reuse traveller details at checkout" actions={<Button onClick={() => setDlg({ editing: null })}><Plus size={16} />Add passenger</Button>} />
      {q.isLoading ? <Skeleton className="h-24" /> : q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : q.data!.length === 0 ? <EmptyState title="No saved passengers" hint="Add the people you travel with." /> : (
        <div className="grid gap-3 sm:grid-cols-2">{q.data!.map((p) => <Card key={p.id}><CardBody className="flex items-center justify-between"><div><p className="font-semibold">{p.name}</p><p className="text-sm text-slate-500">{p.age} yrs · {p.gender.toLowerCase()}{p.mobile ? ` · ${p.mobile}` : ''}</p></div>
          <div className="flex gap-1"><Button size="icon" variant="ghost" aria-label={`Edit ${p.name}`} onClick={() => setDlg({ editing: p })}><Pencil size={16} /></Button><Button size="icon" variant="ghost" aria-label={`Delete ${p.name}`} onClick={async () => { if (await confirm({ title: 'Delete passenger?', message: `${p.name} will be removed from your saved list. Past bookings are not affected.`, danger: true, confirmText: 'Delete' })) del.mutate(p.id); }}><Trash2 size={16} /></Button></div></CardBody></Card>)}</div>)}
      <Dialog open={!!dlg} onOpenChange={(o) => !o && setDlg(null)} title={dlg?.editing ? 'Edit passenger' : 'Add passenger'}>{dlg && <PassengerForm key={dlg.editing?.id ?? 'new'} editing={dlg.editing} onDone={() => setDlg(null)} />}</Dialog>
    </div>
  );
}
