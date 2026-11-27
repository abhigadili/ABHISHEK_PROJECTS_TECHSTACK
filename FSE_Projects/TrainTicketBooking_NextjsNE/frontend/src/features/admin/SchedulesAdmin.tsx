'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GridColDef } from '@mui/x-data-grid';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, FormError, Input, Select } from '@/components/ui/Field';
import { LazyDataTable } from '@/components/tables/LazyDataTable';
import { useAuth, useConfirm, useToast } from '@/hooks';
import { useAdminList } from '@/hooks/useAdminList';
import { toApiError } from '@/services/api-client';
import { scheduleApi, type Schedule } from '@/services/schedule-api';
import { trainApi } from '@/services/train-api';
import { applyServerErrors } from '@/utils/forms';
import { DAYS, fmtDate, todayIso } from '@/utils/format';
import { scheduleSchema } from '@/validations/catalog';
import { revalidateCatalogAction } from './actions';

type Values = z.input<typeof scheduleSchema>;
function ScheduleForm({ editing, onDone }: { editing: Schedule | null; onDone: () => void }) {
  const trains = useQuery({ queryKey: ['admin', 'train-options'], queryFn: () => trainApi.list({ size: 100 }) }); const qc = useQueryClient(); const toast = useToast(); const [err, setErr] = useState<string>();
  const save = useMutation({ mutationFn: (b: unknown) => (editing ? scheduleApi.update(editing.id, b) : scheduleApi.create(b)) });
  const { register, control, handleSubmit, setError, formState: { errors } } = useForm<Values>({ resolver: zodResolver(scheduleSchema) as never, defaultValues: { trainId: editing?.trainId ?? ('' as never), validFrom: editing ? editing.validFrom.slice(0, 10) : todayIso(), validTo: editing?.validTo?.slice(0, 10) ?? '', active: editing?.active ?? true, notes: editing?.notes ?? '', operatingDays: editing?.operatingDays.map((d) => d.dayOfWeek) ?? [0, 1, 2, 3, 4, 5, 6] } });
  return (
    <form noValidate className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={handleSubmit(async (v) => { try { await save.mutateAsync({ ...v, validTo: v.validTo || null }); await revalidateCatalogAction('trains', Number(v.trainId)); await qc.invalidateQueries({ queryKey: ['admin', 'schedules'] }); toast('success', 'Schedule saved'); onDone(); } catch (e) { setErr(applyServerErrors(e, setError)); } })}>
      <FormError>{err}</FormError>
      <Field className="sm:col-span-2" label="Train" error={errors.trainId?.message}><Select {...register('trainId')} disabled={!!editing}><option value="">Select…</option>{(trains.data?.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.name} #{t.number}</option>)}</Select></Field>
      <Field label="Valid from" error={errors.validFrom?.message}><Input type="date" {...register('validFrom')} /></Field><Field label="Valid to (optional)" error={errors.validTo?.message}><Input type="date" {...register('validTo')} /></Field>
      <Controller control={control} name="operatingDays" render={({ field }) => <fieldset className="sm:col-span-2"><legend className="mb-1 text-sm font-medium">Operating days</legend><div className="flex flex-wrap gap-2">{DAYS.map((d, i) => { const on = field.value.includes(i); return <button key={d} type="button" aria-pressed={on} onClick={() => field.onChange(on ? field.value.filter((x: number) => x !== i) : [...field.value, i])} className={`rounded-lg border px-3 py-1.5 text-sm ${on ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'}`}>{d}</button>; })}</div>{errors.operatingDays?.message && <p role="alert" className="mt-1 text-xs text-red-600">{errors.operatingDays.message}</p>}</fieldset>} />
      <Field className="sm:col-span-2" label="Notes"><Input {...register('notes')} /></Field>
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" {...register('active')} />Active</label>
      <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={onDone}>Cancel</Button><Button type="submit" loading={save.isPending}>Save</Button></div>
    </form>
  );
}
export function SchedulesAdmin() {
  const { hasRole } = useAuth(); const canEdit = hasRole('ADMIN', 'TRAIN_OPERATOR'); const l = useAdminList<Schedule>('schedules', scheduleApi.list); const confirm = useConfirm(); const toast = useToast(); const qc = useQueryClient(); const [dlg, setDlg] = useState<{ editing: Schedule | null } | null>(null);
  const remove = useMutation({ mutationFn: (s: Schedule) => scheduleApi.remove(s.id), onSuccess: async (_d, s) => { await revalidateCatalogAction('trains', s.trainId); qc.invalidateQueries({ queryKey: ['admin', 'schedules'] }); toast('success', 'Schedule deleted'); }, onError: (e) => toast('error', 'Cannot delete', toApiError(e).message) });
  const columns: GridColDef<Schedule>[] = [
    { field: 'train', headerName: 'Train', flex: 1, minWidth: 220, valueGetter: (_v, r) => `${r.train.name} #${r.train.number}` },
    { field: 'days', headerName: 'Runs on', width: 300, sortable: false, renderCell: (p) => <div className="flex flex-wrap gap-1 py-1">{DAYS.map((d, i) => <span key={d} className={`rounded px-1.5 py-0.5 text-xs ${p.row.operatingDays.some((x) => x.dayOfWeek === i) ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{d}</span>)}</div> },
    { field: 'validFrom', headerName: 'From', width: 120, valueGetter: (_v, r) => fmtDate(r.validFrom) }, { field: 'validTo', headerName: 'To', width: 120, valueGetter: (_v, r) => (r.validTo ? fmtDate(r.validTo) : 'Open-ended') },
    { field: 'active', headerName: 'Status', width: 110, renderCell: (p) => <Badge tone={p.row.active ? 'green' : 'slate'}>{p.row.active ? 'Active' : 'Inactive'}</Badge> },
    ...(canEdit ? [{ field: 'actions', headerName: '', width: 110, sortable: false, renderCell: (p: { row: Schedule }) => <div className="flex"><Button size="icon" variant="ghost" aria-label="Edit schedule" onClick={() => setDlg({ editing: p.row })}><Pencil size={16} /></Button>
      <Button size="icon" variant="ghost" aria-label="Delete schedule" onClick={async () => { if (await confirm({ title: 'Delete schedule?', message: 'The train will stop appearing in search for these days.', danger: true, confirmText: 'Delete' })) remove.mutate(p.row); }}><Trash2 size={16} /></Button></div> } as GridColDef<Schedule>] : []),
  ];
  return (
    <>
      {canEdit && <div className="mb-4 flex justify-end"><Button onClick={() => setDlg({ editing: null })}><Plus size={16} />Add schedule</Button></div>}
      <LazyDataTable rows={l.rows} columns={columns} meta={l.meta} loading={l.isFetching} page={l.page} onPage={(m) => l.setPage(m.page)} />
      <Dialog open={!!dlg} onOpenChange={(o) => !o && setDlg(null)} title={dlg?.editing ? 'Edit schedule' : 'New schedule'} wide>{dlg && <ScheduleForm key={dlg.editing?.id ?? 'new'} editing={dlg.editing} onDone={() => setDlg(null)} />}</Dialog>
    </>
  );
}
