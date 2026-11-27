import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { CalendarX, Layers, Pencil, Plus, Power, Trash2 } from 'lucide-react';
import type { GridColDef } from '@mui/x-data-grid';
import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { trainSchema, trainTypes, trainStatuses } from '@shared/validations/catalog';
import { z } from 'zod';
import { DataTable } from '@/components/DataTable';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, FormError, Input, Select } from '@/components/ui/Field';
import { Skeleton, PageHeader } from '@/components/ui/Feedback';
import { Tip } from '@/components/ui/Tip';
import { useAuth, useConfirm, useDebounce, useDocumentTitle, useToast } from '@/hooks';
import { get, toApiError } from '@/services/api';
import { useAdminList, useAdminMutation, useStationOptions } from '@/services/queries';
import { useCoachTypesQuery } from '@/store/api';
import { applyServerErrors } from '@/utils/forms';
import { label } from '@/utils/format';
import type { TrainLite } from '@/types';

type Values = z.input<typeof trainSchema>;
interface TrainFull extends TrainLite { route?: { stops: { stationId: number; arrivalTime: string | null; departureTime: string | null; dayOffset: number; distanceKm: number }[] } }
const emptyStop = { stationId: '' as never, arrivalTime: '', departureTime: '', dayOffset: 0, distanceKm: 0 };

function TrainForm({ id, onDone }: { id: number | null; onDone: () => void }) {
  const existing = useQuery({ queryKey: ['train-edit', id], enabled: !!id, queryFn: async () => (await get<TrainFull>(`/trains/${id}`)).data, staleTime: 0 });
  if (id && existing.isLoading) return <Skeleton className="mt-4 h-40" />;
  return <TrainFormInner id={id} t={existing.data} onDone={onDone} />;
}
function TrainFormInner({ id, t, onDone }: { id: number | null; t?: TrainFull; onDone: () => void }) {
  const { isAdmin } = useAuth(); const stations = useStationOptions(); const coachTypes = useCoachTypesQuery(); const m = useAdminMutation('trains'); const toast = useToast(); const [err, setErr] = useState<string>();
  const { register, control, handleSubmit, setError, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(trainSchema) as never,
    defaultValues: id && t ? { number: t.number, name: t.name, type: t.type as never, status: (t.status ?? 'ACTIVE') as never, route: { name: `${t.name} route`, stops: (t.route?.stops ?? []).map((s) => ({ ...s, arrivalTime: s.arrivalTime ?? '', departureTime: s.departureTime ?? '' })) as never } }
      : { number: '', name: '', type: 'EXPRESS', status: 'ACTIVE', route: { name: '', stops: [{ ...emptyStop }, { ...emptyStop }] }, coaches: [{ coachTypeId: 1, count: 2 }], operatingDays: [0, 1, 2, 3, 4, 5, 6] },
  });
  const stops = useFieldArray({ control, name: 'route.stops' }); const coaches = useFieldArray({ control, name: 'coaches' });
  const clean = (v: Values) => ({ ...v, route: v.route && { ...v.route, name: v.route.name || `${v.name} route`, stops: v.route.stops.map((s, i, a) => ({ ...s, arrivalTime: i === 0 ? null : s.arrivalTime || null, departureTime: i === a.length - 1 ? null : s.departureTime || null })) } });
  return (
    <form noValidate className="mt-4 space-y-4" onSubmit={handleSubmit(async (v) => { try { const body = clean(v); if (id) { const { number: _n, coaches: _c, operatingDays: _o, ...rest } = body; await m.mutateAsync({ method: 'put', url: `/trains/${id}`, body: rest }); } else await m.mutateAsync({ method: 'post', url: '/trains', body }); toast('success', id ? 'Train updated' : 'Train created'); onDone(); } catch (e) { setErr(applyServerErrors(e, setError)); } })}>
      <FormError>{err}</FormError>
      <div className="grid gap-3 sm:grid-cols-4"><Field label="Number" error={errors.number?.message}><Input {...register('number')} disabled={!!id} /></Field><Field className="sm:col-span-2" label="Name" error={errors.name?.message}><Input {...register('name')} /></Field>
        <Field label="Type" error={errors.type?.message}><Select {...register('type')}>{trainTypes.map((x) => <option key={x} value={x}>{label(x)}</option>)}</Select></Field></div>
      {id && <Field label="Status"><Select {...register('status')}>{trainStatuses.map((x) => <option key={x} value={x}>{label(x)}</option>)}</Select></Field>}
      <div><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold">Route stops</h3><Button type="button" size="sm" variant="outline" onClick={() => stops.append({ ...emptyStop })}><Plus size={14} />Add stop</Button></div>
        {errors.route?.stops?.root?.message && <FormError>{errors.route.stops.root.message}</FormError>}
        <div className="space-y-2">{stops.fields.map((f, i) => (
          <div key={f.id} className="grid items-start gap-2 rounded-lg border border-slate-200 p-2 sm:grid-cols-[2fr_1fr_1fr_70px_90px_36px]">
            <Field label={i === 0 ? 'Station' : ' '} error={errors.route?.stops?.[i]?.stationId?.message}><Select {...register(`route.stops.${i}.stationId`)}><option value="">Select…</option>{(stations.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}</Select></Field>
            <Field label={i === 0 ? 'Arrives' : ' '} error={errors.route?.stops?.[i]?.arrivalTime?.message}><Input type="time" disabled={i === 0} {...register(`route.stops.${i}.arrivalTime`)} /></Field>
            <Field label={i === 0 ? 'Departs' : ' '} error={errors.route?.stops?.[i]?.departureTime?.message}><Input type="time" disabled={i === stops.fields.length - 1} {...register(`route.stops.${i}.departureTime`)} /></Field>
            <Field label={i === 0 ? 'Day +' : ' '}><Input type="number" min={0} max={5} {...register(`route.stops.${i}.dayOffset`)} /></Field>
            <Field label={i === 0 ? 'Km' : ' '} error={errors.route?.stops?.[i]?.distanceKm?.message}><Input type="number" min={0} {...register(`route.stops.${i}.distanceKm`)} /></Field>
            <Button type="button" variant="ghost" size="icon" className="mt-[26px]" aria-label={`Remove stop ${i + 1}`} disabled={stops.fields.length <= 2} onClick={() => stops.remove(i)}><Trash2 size={16} /></Button></div>))}</div></div>
      {!id && <div><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold">Coaches</h3><Button type="button" size="sm" variant="outline" onClick={() => coaches.append({ coachTypeId: 1, count: 1 })}><Plus size={14} />Add</Button></div>
        <div className="space-y-2">{coaches.fields.map((f, i) => <div key={f.id} className="flex gap-2"><Select aria-label="Coach type" {...register(`coaches.${i}.coachTypeId`)}>{(coachTypes.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code}) · {c.seatsPerCoach} seats</option>)}</Select><Input aria-label="Number of coaches" className="w-24" type="number" min={1} max={20} {...register(`coaches.${i}.count`)} /><Button type="button" variant="ghost" size="icon" aria-label="Remove coach row" onClick={() => coaches.remove(i)}><Trash2 size={16} /></Button></div>)}</div></div>}
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onDone}>Cancel</Button><Button type="submit" loading={m.isPending}>{isAdmin ? 'Save train' : 'Save'}</Button></div>
    </form>
  );
}
function CoachesDialog({ train, onClose }: { train: TrainLite; onClose: () => void }) {
  const coachTypes = useCoachTypesQuery(); const toast = useToast(); const confirm = useConfirm(); const m = useAdminMutation('trains');
  const q = useQuery({ queryKey: ['train-coaches', train.id], queryFn: async () => (await get<{ id: number; number: string; coachType: { code: string; name: string } }[]>(`/trains/${train.id}/coaches`)).data });
  const [num, setNum] = useState(''); const [ct, setCt] = useState('1');
  const run = async (p: Parameters<typeof m.mutateAsync>[0], ok: string) => { try { await m.mutateAsync(p); toast('success', ok); await q.refetch(); } catch (e) { toast('error', 'Action failed', toApiError(e).message); } };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={`Coaches - ${train.name}`} description="Add or remove coaches. A coach with live bookings cannot be removed." wide>
      <ul className="mt-3 max-h-60 space-y-1 overflow-y-auto">{q.isLoading ? <li>Loading…</li> : (q.data ?? []).map((c) => <li key={c.id} className="flex items-center justify-between rounded border px-3 py-1.5 text-sm"><span><strong>{c.number}</strong> · {c.coachType.name}</span><Button size="icon" variant="ghost" aria-label={`Remove coach ${c.number}`} onClick={async () => { if (await confirm({ title: `Remove coach ${c.number}?`, message: 'Its seats are removed too.', danger: true, confirmText: 'Remove' })) run({ method: 'delete', url: `/coaches/${c.id}` }, 'Coach removed'); }}><Trash2 size={14} /></Button></li>)}</ul>
      <div className="mt-4 flex gap-2"><Select aria-label="Coach type" value={ct} onChange={(e) => setCt(e.target.value)}>{(coachTypes.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}</Select><Input aria-label="Coach number" className="w-28" placeholder="e.g. S4" value={num} onChange={(e) => setNum(e.target.value.toUpperCase())} /><Button disabled={!/^[A-Z]\d{1,2}$/.test(num)} onClick={async () => { await run({ method: 'post', url: `/trains/${train.id}/coaches`, body: { coachTypeId: Number(ct), number: num } }, 'Coach added'); setNum(''); }}>Add</Button></div>
    </Dialog>
  );
}
function StatusDialog({ train, onClose }: { train: TrainLite; onClose: () => void }) {
  const m = useAdminMutation('trains'); const toast = useToast(); const [status, setStatus] = useState(train.status ?? 'ACTIVE'); const [reason, setReason] = useState('');
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={`Train status - ${train.name}`} description="Passengers with confirmed bookings are notified when a train is suspended or cancelled.">
      <div className="mt-3 space-y-3"><Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>{trainStatuses.map((x) => <option key={x} value={x}>{label(x)}</option>)}</Select><Input aria-label="Reason" placeholder="Reason (shown to passengers)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={m.isPending} onClick={async () => { try { await m.mutateAsync({ method: 'patch', url: `/trains/${train.id}/status`, body: { status, reason: reason || undefined } }); toast('success', 'Status updated'); onClose(); } catch (e) { toast('error', 'Failed', toApiError(e).message); } }}>Update</Button></div></div>
    </Dialog>
  );
}
function OverrideDialog({ train, onClose }: { train: TrainLite; onClose: () => void }) {
  const m = useAdminMutation('trains'); const toast = useToast(); const [date, setDate] = useState(''); const [reason, setReason] = useState('');
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={`Cancel a run - ${train.name}`} description="The train will not operate on this date; affected bookings are cancelled and refunded in full.">
      <div className="mt-3 space-y-3"><Input aria-label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /><Input aria-label="Reason" placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Close</Button><Button variant="danger" disabled={!date} loading={m.isPending} onClick={async () => { try { await m.mutateAsync({ method: 'post', url: `/trains/${train.id}/date-overrides`, body: { date, cancelled: true, reason: reason || undefined } }); toast('success', 'Run cancelled for that date'); onClose(); } catch (e) { toast('error', 'Failed', toApiError(e).message); } }}>Cancel this run</Button></div></div>
    </Dialog>
  );
}
type Dlg = { kind: 'form'; id: number | null } | { kind: 'coaches' | 'status' | 'override'; train: TrainLite } | null;
export default function Trains() {
  useDocumentTitle('Trains'); const { isAdmin } = useAuth(); const [page, setPage] = useState(0); const [text, setText] = useState(''); const dq = useDebounce(text);
  const q = useAdminList<TrainLite>('trains', '/trains', { page, size: 10, q: dq || undefined }); const m = useAdminMutation('trains'); const confirm = useConfirm(); const toast = useToast(); const [dlg, setDlg] = useState<Dlg>(null);
  const columns: GridColDef<TrainLite>[] = [
    { field: 'number', headerName: 'Number', width: 100 }, { field: 'name', headerName: 'Name', flex: 1, minWidth: 200 }, { field: 'type', headerName: 'Type', width: 130, renderCell: (p) => <Badge tone="indigo">{label(p.row.type)}</Badge> },
    { field: 'status', headerName: 'Status', width: 130, renderCell: (p) => <StatusBadge status={p.row.status ?? 'ACTIVE'} /> },
    { field: 'actions', headerName: 'Actions', width: 240, sortable: false, renderCell: (p) => <div className="flex">
      {isAdmin && <Tip text="Edit train & route"><Button size="icon" variant="ghost" aria-label={`Edit ${p.row.name}`} onClick={() => setDlg({ kind: 'form', id: p.row.id })}><Pencil size={16} /></Button></Tip>}
      <Tip text="Coaches"><Button size="icon" variant="ghost" aria-label={`Coaches of ${p.row.name}`} onClick={() => setDlg({ kind: 'coaches', train: p.row })}><Layers size={16} /></Button></Tip>
      <Tip text="Status"><Button size="icon" variant="ghost" aria-label={`Status of ${p.row.name}`} onClick={() => setDlg({ kind: 'status', train: p.row })}><Power size={16} /></Button></Tip>
      <Tip text="Cancel a run"><Button size="icon" variant="ghost" aria-label={`Cancel a run of ${p.row.name}`} onClick={() => setDlg({ kind: 'override', train: p.row })}><CalendarX size={16} /></Button></Tip>
      {isAdmin && <Tip text="Delete"><Button size="icon" variant="ghost" aria-label={`Delete ${p.row.name}`} onClick={async () => { if (!(await confirm({ title: 'Delete train?', message: `${p.row.name} and its route, coaches and schedules will be removed. Trains with bookings cannot be deleted.`, danger: true, confirmText: 'Delete' }))) return; try { await m.mutateAsync({ method: 'delete', url: `/trains/${p.row.id}` }); toast('success', 'Train deleted'); } catch (e) { toast('error', 'Cannot delete', toApiError(e).message); } }}><Trash2 size={16} /></Button></Tip>}</div> },
  ];
  return (
    <div><PageHeader title="Trains" subtitle="Fleet, routes, coaches and operating status" actions={<div className="flex gap-2"><Input aria-label="Search trains" placeholder="Search name / number" className="w-56" value={text} onChange={(e) => { setText(e.target.value); setPage(0); }} />{isAdmin && <Button onClick={() => setDlg({ kind: 'form', id: null })}><Plus size={16} />Add train</Button>}</div>} />
      <DataTable rows={q.data?.data ?? []} columns={columns} meta={q.data?.meta} loading={q.isFetching} page={page} onPage={(mm) => setPage(mm.page)} />
      {dlg?.kind === 'form' && <Dialog open onOpenChange={(o) => !o && setDlg(null)} title={dlg.id ? 'Edit train' : 'New train'} description="Define the route, timings and coaches." wide><TrainForm key={dlg.id ?? 'new'} id={dlg.id} onDone={() => setDlg(null)} /></Dialog>}
      {dlg?.kind === 'coaches' && <CoachesDialog train={dlg.train} onClose={() => setDlg(null)} />}
      {dlg?.kind === 'status' && <StatusDialog train={dlg.train} onClose={() => setDlg(null)} />}
      {dlg?.kind === 'override' && <OverrideDialog train={dlg.train} onClose={() => setDlg(null)} />}
    </div>
  );
}
