import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { GridColDef } from '@mui/x-data-grid';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { scheduleSchema } from '@shared/validations/catalog';
import { z } from 'zod';
import { DataTable } from '@/components/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, FormError, Input, Select } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/Feedback';
import { useAuth, useConfirm, useDocumentTitle, useToast } from '@/hooks';
import { toApiError } from '@/services/api';
import { useAdminList, useAdminMutation } from '@/services/queries';
import { applyServerErrors } from '@/utils/forms';
import { DAYS, fmtDate, todayIso } from '@/utils/format';
import type { TrainLite } from '@/types';

interface Schedule { id: number; trainId: number; validFrom: string; validTo: string | null; active: boolean; notes?: string | null; operatingDays: { dayOfWeek: number }[]; train: TrainLite }
type Values = z.input<typeof scheduleSchema>;
function ScheduleForm({ editing, onDone }: { editing: Schedule | null; onDone: () => void }) {
  const trains = useAdminList<TrainLite>('trains-all', '/trains', { size: 100 }); const m = useAdminMutation('schedules'); const toast = useToast(); const [err, setErr] = useState<string>();
  const { register, control, handleSubmit, setError, formState: { errors } } = useForm<Values>({ resolver: zodResolver(scheduleSchema) as never, defaultValues: { trainId: editing?.trainId ?? ('' as never), validFrom: editing ? editing.validFrom.slice(0, 10) : todayIso(), validTo: editing?.validTo?.slice(0, 10) ?? '', active: editing?.active ?? true, notes: editing?.notes ?? '', operatingDays: editing?.operatingDays.map((d) => d.dayOfWeek) ?? [0, 1, 2, 3, 4, 5, 6] } });
  return (
    <form noValidate className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={handleSubmit(async (v) => { try { await m.mutateAsync({ method: editing ? 'put' : 'post', url: editing ? `/schedules/${editing.id}` : '/schedules', body: { ...v, validTo: v.validTo || null } }); toast('success', 'Schedule saved'); onDone(); } catch (e) { setErr(applyServerErrors(e, setError)); } })}>
      <FormError>{err}</FormError>
      <Field className="sm:col-span-2" label="Train" error={errors.trainId?.message}><Select {...register('trainId')} disabled={!!editing}><option value="">Select…</option>{(trains.data?.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.name} #{t.number}</option>)}</Select></Field>
      <Field label="Valid from" error={errors.validFrom?.message}><Input type="date" {...register('validFrom')} /></Field><Field label="Valid to (optional)" error={errors.validTo?.message}><Input type="date" {...register('validTo')} /></Field>
      <Controller control={control} name="operatingDays" render={({ field }) => <fieldset className="sm:col-span-2"><legend className="mb-1 text-sm font-medium">Operating days</legend><div className="flex flex-wrap gap-2">{DAYS.map((d, i) => { const on = field.value.includes(i); return <button key={d} type="button" aria-pressed={on} onClick={() => field.onChange(on ? field.value.filter((x: number) => x !== i) : [...field.value, i])} className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm ${on ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'}`}>{d}</button>; })}</div>{errors.operatingDays?.message && <p role="alert" className="mt-1 text-xs text-red-600">{errors.operatingDays.message}</p>}</fieldset>} />
      <Field className="sm:col-span-2" label="Notes"><Input {...register('notes')} /></Field>
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" {...register('active')} />Active</label>
      <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={onDone}>Cancel</Button><Button type="submit" loading={m.isPending}>Save</Button></div>
    </form>
  );
}
export default function Schedules() {
  useDocumentTitle('Schedules'); const { hasRole } = useAuth(); const canEdit = hasRole('ADMIN', 'TRAIN_OPERATOR'); const [page, setPage] = useState(0);
  const q = useAdminList<Schedule>('schedules', '/schedules', { page, size: 10 }); const m = useAdminMutation('schedules'); const confirm = useConfirm(); const toast = useToast(); const [dlg, setDlg] = useState<{ editing: Schedule | null } | null>(null);
  const columns: GridColDef<Schedule>[] = [
    { field: 'train', headerName: 'Train', flex: 1, minWidth: 220, valueGetter: (_v, r) => `${r.train.name} #${r.train.number}` },
    { field: 'days', headerName: 'Runs on', width: 300, sortable: false, renderCell: (p) => <div className="flex flex-wrap gap-1 py-1">{DAYS.map((d, i) => <span key={d} className={`rounded px-1.5 py-0.5 text-xs ${p.row.operatingDays.some((x) => x.dayOfWeek === i) ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{d}</span>)}</div> },
    { field: 'validFrom', headerName: 'From', width: 120, valueGetter: (_v, r) => fmtDate(r.validFrom) }, { field: 'validTo', headerName: 'To', width: 120, valueGetter: (_v, r) => (r.validTo ? fmtDate(r.validTo) : 'Open-ended') },
    { field: 'active', headerName: 'Status', width: 110, renderCell: (p) => <Badge tone={p.row.active ? 'green' : 'slate'}>{p.row.active ? 'Active' : 'Inactive'}</Badge> },
    ...(canEdit ? [{ field: 'actions', headerName: '', width: 110, sortable: false, renderCell: (p: { row: Schedule }) => <div className="flex"><Button size="icon" variant="ghost" aria-label="Edit schedule" onClick={() => setDlg({ editing: p.row })}><Pencil size={16} /></Button>
      <Button size="icon" variant="ghost" aria-label="Delete schedule" onClick={async () => { if (!(await confirm({ title: 'Delete schedule?', message: 'The train will stop appearing in search for these days.', danger: true, confirmText: 'Delete' }))) return; try { await m.mutateAsync({ method: 'delete', url: `/schedules/${p.row.id}` }); toast('success', 'Schedule deleted'); } catch (e) { toast('error', 'Cannot delete', toApiError(e).message); } }}><Trash2 size={16} /></Button></div> } as GridColDef<Schedule>] : []),
  ];
  return (
    <div><PageHeader title="Schedules" subtitle="Which days each train runs" actions={canEdit && <Button onClick={() => setDlg({ editing: null })}><Plus size={16} />Add schedule</Button>} />
      <DataTable rows={q.data?.data ?? []} columns={columns} meta={q.data?.meta} loading={q.isFetching} page={page} onPage={(mm) => setPage(mm.page)} />
      <Dialog open={!!dlg} onOpenChange={(o) => !o && setDlg(null)} title={dlg?.editing ? 'Edit schedule' : 'New schedule'} wide>{dlg && <ScheduleForm key={dlg.editing?.id ?? 'new'} editing={dlg.editing} onDone={() => setDlg(null)} />}</Dialog>
    </div>
  );
}
