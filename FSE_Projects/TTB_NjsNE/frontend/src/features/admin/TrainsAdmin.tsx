'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { GridColDef } from '@mui/x-data-grid';
import { CalendarX, Layers, Pencil, Plus, Power, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Select } from '@/components/ui/Field';
import { Tip } from '@/components/ui/Tip';
import { LazyDataTable } from '@/components/tables/LazyDataTable';
import { useAuth, useConfirm, useDebounce, useToast } from '@/hooks';
import { useAdminList } from '@/hooks/useAdminList';
import { toApiError } from '@/services/api-client';
import { trainApi } from '@/services/train-api';
import type { TrainLite } from '@/types';
import { label } from '@/utils/format';
import { trainStatuses } from '@/validations/catalog';
import { revalidateCatalogAction } from './actions';

function StatusDialog({ train, onClose }: { train: TrainLite; onClose: () => void }) {
  const toast = useToast(); const qc = useQueryClient(); const [status, setStatus] = useState(train.status ?? 'ACTIVE'); const [reason, setReason] = useState('');
  const m = useMutation({ mutationFn: () => trainApi.setStatus(train.id, { status, reason: reason || undefined }), onSuccess: async () => { await revalidateCatalogAction('trains', train.id); qc.invalidateQueries({ queryKey: ['admin', 'trains'] }); toast('success', 'Status updated'); onClose(); }, onError: (e) => toast('error', 'Failed', toApiError(e).message) });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={`Train status - ${train.name}`} description="Passengers with confirmed bookings are notified when a train is suspended or cancelled.">
      <div className="mt-3 space-y-3"><Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>{trainStatuses.map((x) => <option key={x} value={x}>{label(x)}</option>)}</Select><Input aria-label="Reason" placeholder="Reason (shown to passengers)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={m.isPending} onClick={() => m.mutate()}>Update</Button></div></div>
    </Dialog>
  );
}
function OverrideDialog({ train, onClose }: { train: TrainLite; onClose: () => void }) {
  const toast = useToast(); const [date, setDate] = useState(''); const [reason, setReason] = useState('');
  const m = useMutation({ mutationFn: () => trainApi.cancelRun(train.id, { date, cancelled: true, reason: reason || undefined }), onSuccess: () => { toast('success', 'Run cancelled for that date'); onClose(); }, onError: (e) => toast('error', 'Failed', toApiError(e).message) });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={`Cancel a run - ${train.name}`} description="The train will not operate on this date; affected bookings are cancelled and refunded in full.">
      <div className="mt-3 space-y-3"><Input aria-label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /><Input aria-label="Reason" placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Close</Button><Button variant="danger" disabled={!date} loading={m.isPending} onClick={() => m.mutate()}>Cancel this run</Button></div></div>
    </Dialog>
  );
}
type Dlg = { kind: 'status' | 'override'; train: TrainLite } | null;
export function TrainsAdmin() {
  const { isAdmin } = useAuth(); const [text, setText] = useState(''); const dq = useDebounce(text); const l = useAdminList<TrainLite>('trains', trainApi.list, { q: dq || undefined });
  const confirm = useConfirm(); const toast = useToast(); const qc = useQueryClient(); const [dlg, setDlg] = useState<Dlg>(null);
  const remove = useMutation({ mutationFn: (id: number) => trainApi.remove(id), onSuccess: async (_d, id) => { await revalidateCatalogAction('trains', id); qc.invalidateQueries({ queryKey: ['admin', 'trains'] }); toast('success', 'Train deleted'); }, onError: (e) => toast('error', 'Cannot delete', toApiError(e).message) });
  const columns: GridColDef<TrainLite>[] = [
    { field: 'number', headerName: 'Number', width: 100 }, { field: 'name', headerName: 'Name', flex: 1, minWidth: 200 }, { field: 'type', headerName: 'Type', width: 130, renderCell: (p) => <Badge tone="indigo">{label(p.row.type)}</Badge> },
    { field: 'status', headerName: 'Status', width: 130, renderCell: (p) => <StatusBadge status={p.row.status ?? 'ACTIVE'} /> },
    { field: 'actions', headerName: 'Actions', width: 250, sortable: false, renderCell: (p) => <div className="flex">
      {isAdmin && <Tip text="Edit train & route"><Button size="icon" variant="ghost" asChild aria-label={`Edit ${p.row.name}`}><Link href={`/admin/trains/${p.row.id}/edit`}><Pencil size={16} /></Link></Button></Tip>}
      <Tip text="Coaches & seats"><Button size="icon" variant="ghost" asChild aria-label={`Coaches of ${p.row.name}`}><Link href={`/admin/trains/${p.row.id}/coaches`}><Layers size={16} /></Link></Button></Tip>
      <Tip text="Status"><Button size="icon" variant="ghost" aria-label={`Status of ${p.row.name}`} onClick={() => setDlg({ kind: 'status', train: p.row })}><Power size={16} /></Button></Tip>
      <Tip text="Cancel a run"><Button size="icon" variant="ghost" aria-label={`Cancel a run of ${p.row.name}`} onClick={() => setDlg({ kind: 'override', train: p.row })}><CalendarX size={16} /></Button></Tip>
      {isAdmin && <Tip text="Delete"><Button size="icon" variant="ghost" aria-label={`Delete ${p.row.name}`} onClick={async () => { if (await confirm({ title: 'Delete train?', message: `${p.row.name} and its route, coaches and schedules will be removed. Trains with bookings cannot be deleted.`, danger: true, confirmText: 'Delete' })) remove.mutate(p.row.id); }}><Trash2 size={16} /></Button></Tip>}</div> },
  ];
  return (
    <>
      <div className="mb-4 flex flex-wrap justify-end gap-2"><Input aria-label="Search trains" placeholder="Search name / number" className="w-56" value={text} onChange={(e) => { setText(e.target.value); l.setPage(0); }} />{isAdmin && <Button asChild><Link href="/admin/trains/new"><Plus size={16} />Add train</Link></Button>}</div>
      <LazyDataTable rows={l.rows} columns={columns} meta={l.meta} loading={l.isFetching} page={l.page} onPage={(m) => l.setPage(m.page)} />
      {dlg?.kind === 'status' && <StatusDialog train={dlg.train} onClose={() => setDlg(null)} />}
      {dlg?.kind === 'override' && <OverrideDialog train={dlg.train} onClose={() => setDlg(null)} />}
    </>
  );
}
