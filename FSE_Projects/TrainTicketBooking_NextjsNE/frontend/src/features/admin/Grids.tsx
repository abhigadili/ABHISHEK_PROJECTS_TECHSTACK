'use client';
import type { GridColDef } from '@mui/x-data-grid';
import Link from 'next/link';
import { useState } from 'react';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Select } from '@/components/ui/Field';
import { LazyDataTable } from '@/components/tables/LazyDataTable';
import { useAuth, useConfirm, useDebounce, useToast } from '@/hooks';
import { useAdminList } from '@/hooks/useAdminList';
import { adminApi, bookingApi, paymentApi, refundApi } from '@/services/booking-api';
import { get, toApiError } from '@/services/api-client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Booking, Payment, Refund, RoleKey, User } from '@/types';
import { fmtDate, fmtDateTime, inr, label } from '@/utils/format';

const Toolbar = ({ children }: { children: React.ReactNode }) => <div className="mb-4 flex flex-wrap items-center justify-end gap-2">{children}</div>;
const BOOKING_STATUSES = ['CONFIRMED', 'PENDING_PAYMENT', 'PARTIALLY_CANCELLED', 'CANCELLED', 'EXPIRED', 'FAILED'];

export function BookingsGrid() {
  const [status, setStatus] = useState(''); const [text, setText] = useState(''); const q = useDebounce(text);
  const l = useAdminList<Booking>('bookings', bookingApi.list, { status: status || undefined, q: q || undefined });
  const columns: GridColDef<Booking>[] = [
    { field: 'id', headerName: 'ID', width: 80, renderCell: (p) => <Link className="text-indigo-600" href={`/account/bookings/${p.row.id}`}>#{p.row.id}</Link> },
    { field: 'pnr', headerName: 'PNR', width: 130, valueGetter: (_v, r) => r.pnr?.pnr ?? '—' }, { field: 'user', headerName: 'Customer', flex: 1, minWidth: 200, valueGetter: (_v, r) => (r.user ? `${r.user.name} (${r.user.email})` : '') },
    { field: 'train', headerName: 'Train', flex: 1, minWidth: 180, valueGetter: (_v, r) => `${r.train.name} #${r.train.number}` }, { field: 'route', headerName: 'Route', width: 120, valueGetter: (_v, r) => `${r.fromStation.code} → ${r.toStation.code}` },
    { field: 'journeyDate', headerName: 'Journey', width: 120, valueGetter: (_v, r) => fmtDate(r.journeyDate) }, { field: 'status', headerName: 'Status', width: 170, renderCell: (p) => <StatusBadge status={p.row.status} /> },
    { field: 'totalAmount', headerName: 'Amount', width: 110, align: 'right', headerAlign: 'right', valueGetter: (_v, r) => inr(r.totalAmount) },
  ];
  return <><Toolbar><Input aria-label="Search bookings" placeholder="Search PNR / name / e-mail" className="w-64" value={text} onChange={(e) => { setText(e.target.value); l.setPage(0); }} /><Select aria-label="Status" className="w-48" value={status} onChange={(e) => { setStatus(e.target.value); l.setPage(0); }}><option value="">Any status</option>{BOOKING_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select></Toolbar>
    <LazyDataTable rows={l.rows} columns={columns} meta={l.meta} loading={l.isFetching} page={l.page} onPage={(m) => l.setPage(m.page)} /></>;
}
export function PaymentsGrid() {
  const [status, setStatus] = useState(''); const l = useAdminList<Payment>('payments', paymentApi.list, { status: status || undefined });
  const columns: GridColDef<Payment>[] = [
    { field: 'reference', headerName: 'Reference', width: 190 }, { field: 'booking', headerName: 'Booking', width: 100, valueGetter: (_v, r) => `#${r.booking?.id ?? ''}` },
    { field: 'method', headerName: 'Method', width: 170, valueGetter: (_v, r) => `${label(r.method)}${r.cardLast4 ? ` ····${r.cardLast4}` : ''}` }, { field: 'status', headerName: 'Status', width: 190, renderCell: (p) => <StatusBadge status={p.row.status} /> },
    { field: 'amount', headerName: 'Amount', width: 130, align: 'right', headerAlign: 'right', valueGetter: (_v, r) => inr(r.amount) }, { field: 'createdAt', headerName: 'Date', flex: 1, minWidth: 170, valueGetter: (_v, r) => fmtDateTime(r.createdAt) },
  ];
  return <><Toolbar><Select aria-label="Status" className="w-52" value={status} onChange={(e) => { setStatus(e.target.value); l.setPage(0); }}><option value="">Any status</option>{['INITIATED', 'SUCCEEDED', 'FAILED', 'PARTIALLY_REFUNDED', 'REFUNDED'].map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select></Toolbar>
    <LazyDataTable rows={l.rows} columns={columns} meta={l.meta} loading={l.isFetching} page={l.page} onPage={(m) => l.setPage(m.page)} /></>;
}
export function RefundsGrid() {
  const l = useAdminList<Refund>('refunds', refundApi.list);
  const columns: GridColDef<Refund>[] = [
    { field: 'reference', headerName: 'Reference', width: 200 }, { field: 'bookingId', headerName: 'Booking', width: 110, valueGetter: (_v, r) => `#${r.bookingId}` }, { field: 'paymentId', headerName: 'Payment', width: 110, valueGetter: (_v, r) => `#${r.paymentId}` },
    { field: 'status', headerName: 'Status', width: 150, renderCell: (p) => <StatusBadge status={p.row.status} /> }, { field: 'amount', headerName: 'Amount', width: 130, align: 'right', headerAlign: 'right', valueGetter: (_v, r) => inr(r.amount) }, { field: 'createdAt', headerName: 'Date', flex: 1, minWidth: 170, valueGetter: (_v, r) => fmtDateTime(r.createdAt) },
  ];
  return <LazyDataTable rows={l.rows} columns={columns} meta={l.meta} loading={l.isFetching} page={l.page} onPage={(m) => l.setPage(m.page)} />;
}
interface CancelRow { id: number; bookingId: number; hoursBefore: number; chargePercent: string; grossFare: string; chargeAmount: string; refundAmount: string; reason?: string; createdAt: string }
export function CancellationsGrid() {
  const l = useAdminList<CancelRow>('cancellations', async (p) => { const r = await get<CancelRow[]>('/cancellations', p as Record<string, string | number>); return { data: r.data, meta: r.meta! }; });
  const columns: GridColDef<CancelRow>[] = [
    { field: 'bookingId', headerName: 'Booking', width: 100, renderCell: (p) => <Link className="text-indigo-600" href={`/account/bookings/${p.row.bookingId}`}>#{p.row.bookingId}</Link> }, { field: 'hoursBefore', headerName: 'Hours before', width: 120 },
    { field: 'chargePercent', headerName: 'Charge %', width: 100 }, { field: 'grossFare', headerName: 'Fare', width: 110, valueGetter: (_v, r) => inr(r.grossFare) }, { field: 'chargeAmount', headerName: 'Charge', width: 110, valueGetter: (_v, r) => inr(r.chargeAmount) },
    { field: 'refundAmount', headerName: 'Refund', width: 110, valueGetter: (_v, r) => inr(r.refundAmount) }, { field: 'reason', headerName: 'Reason', flex: 1, minWidth: 160 }, { field: 'createdAt', headerName: 'Date', width: 170, valueGetter: (_v, r) => fmtDateTime(r.createdAt) },
  ];
  return <LazyDataTable rows={l.rows} columns={columns} meta={l.meta} loading={l.isFetching} page={l.page} onPage={(m) => l.setPage(m.page)} />;
}
const ROLES: RoleKey[] = ['PASSENGER', 'ADMIN', 'BOOKING_STAFF', 'TRAIN_OPERATOR'];
export function UsersGrid() {
  const { user: me } = useAuth(); const [text, setText] = useState(''); const [role, setRole] = useState(''); const q = useDebounce(text); const toast = useToast(); const confirm = useConfirm(); const qc = useQueryClient();
  const l = useAdminList<User>('users', adminApi.users, { q: q || undefined, role: role || undefined });
  const [edit, setEdit] = useState<User | null>(null); const [roles, setRoles] = useState<RoleKey[]>([]);
  const mut = useMutation({ mutationFn: (fn: () => Promise<unknown>) => fn(), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }), onError: (e) => toast('error', 'Action failed', toApiError(e).message) });
  const columns: GridColDef<User>[] = [
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 160 }, { field: 'email', headerName: 'E-mail', flex: 1, minWidth: 220 }, { field: 'mobile', headerName: 'Mobile', width: 130 },
    { field: 'roles', headerName: 'Roles', width: 260, sortable: false, renderCell: (p) => <div className="flex flex-wrap gap-1 py-1">{p.row.roles.map((r) => <Badge key={r} tone="indigo">{label(r)}</Badge>)}</div> },
    { field: 'status', headerName: 'Status', width: 120, renderCell: (p) => <StatusBadge status={p.row.status} /> },
    { field: 'actions', headerName: '', width: 230, sortable: false, renderCell: (p) => <div className="flex gap-1 py-1"><Button size="sm" variant="outline" onClick={() => { setEdit(p.row); setRoles(p.row.roles); }}>Roles</Button>
      {p.row.id !== me?.id && <Button size="sm" variant={p.row.status === 'ACTIVE' ? 'danger' : 'success'} onClick={async () => { const next = p.row.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'; if (await confirm({ title: `${next === 'SUSPENDED' ? 'Suspend' : 'Reactivate'} ${p.row.name}?`, message: next === 'SUSPENDED' ? 'They will be signed out and cannot log in until reactivated.' : 'They will be able to log in again.', danger: next === 'SUSPENDED', confirmText: next === 'SUSPENDED' ? 'Suspend' : 'Reactivate' })) mut.mutate(() => adminApi.setUserStatus(p.row.id, next)); }}>{p.row.status === 'ACTIVE' ? 'Suspend' : 'Activate'}</Button>}</div> },
  ];
  return (
    <>
      <Toolbar><Input aria-label="Search users" placeholder="Search name / e-mail / mobile" className="w-64" value={text} onChange={(e) => { setText(e.target.value); l.setPage(0); }} /><Select aria-label="Role" className="w-48" value={role} onChange={(e) => { setRole(e.target.value); l.setPage(0); }}><option value="">All roles</option>{ROLES.map((r) => <option key={r} value={r}>{label(r)}</option>)}</Select></Toolbar>
      <LazyDataTable rows={l.rows} columns={columns} meta={l.meta} loading={l.isFetching} page={l.page} onPage={(m) => l.setPage(m.page)} />
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)} title={`Roles for ${edit?.name ?? ''}`} description="Permissions come from the role → permission tables.">
        <div className="mt-3 space-y-2">{ROLES.map((r) => <label key={r} className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={roles.includes(r)} onChange={() => setRoles((s) => (s.includes(r) ? s.filter((x) => x !== r) : [...s, r]))} />{label(r)}</label>)}
          <div className="flex justify-end gap-2 pt-3"><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button disabled={roles.length === 0} loading={mut.isPending} onClick={() => mut.mutate(() => adminApi.setUserRoles(edit!.id, roles), { onSuccess: () => { toast('success', 'Roles updated'); setEdit(null); } })}>Save roles</Button></div></div>
      </Dialog>
    </>
  );
}
