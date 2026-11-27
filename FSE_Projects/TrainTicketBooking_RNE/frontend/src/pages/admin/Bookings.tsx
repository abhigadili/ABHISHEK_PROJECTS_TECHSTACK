import type { GridColDef } from '@mui/x-data-grid';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DataTable } from '@/components/DataTable';
import { StatusBadge } from '@/components/ui/Badge';
import { Input, Select } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/Feedback';
import { useDebounce, useDocumentTitle } from '@/hooks';
import { useAdminList } from '@/services/queries';
import { fmtDate, fmtDateTime, inr } from '@/utils/format';
import type { Booking } from '@/types';

const columns: GridColDef<Booking>[] = [
  { field: 'id', headerName: 'ID', width: 80, renderCell: (p) => <Link className="text-indigo-600" to={`/account/bookings/${p.row.id}`}>#{p.row.id}</Link> },
  { field: 'pnr', headerName: 'PNR', width: 130, valueGetter: (_v, r) => r.pnr?.pnr ?? '—' }, { field: 'user', headerName: 'Customer', flex: 1, minWidth: 180, valueGetter: (_v, r) => r.user ? `${r.user.name} (${r.user.email})` : '' },
  { field: 'train', headerName: 'Train', flex: 1, minWidth: 180, valueGetter: (_v, r) => `${r.train.name} #${r.train.number}` }, { field: 'route', headerName: 'Route', width: 120, valueGetter: (_v, r) => `${r.fromStation.code} → ${r.toStation.code}` },
  { field: 'journeyDate', headerName: 'Journey', width: 120, valueGetter: (_v, r) => fmtDate(r.journeyDate) }, { field: 'status', headerName: 'Status', width: 170, renderCell: (p) => <StatusBadge status={p.row.status} /> },
  { field: 'totalAmount', headerName: 'Amount', width: 110, align: 'right', headerAlign: 'right', valueGetter: (_v, r) => inr(r.totalAmount) }, { field: 'createdAt', headerName: 'Created', width: 170, valueGetter: (_v, r) => fmtDateTime(r.createdAt) },
];
export default function Bookings() {
  useDocumentTitle('Bookings'); const [page, setPage] = useState(0); const [status, setStatus] = useState(''); const [text, setText] = useState(''); const qd = useDebounce(text);
  const q = useAdminList<Booking>('bookings', '/bookings', { page, size: 10, status: status || undefined, q: qd || undefined });
  return (
    <div><PageHeader title="Bookings" subtitle="All bookings across passengers" actions={<div className="flex gap-2"><Input aria-label="Search bookings" placeholder="Search PNR / name / e-mail" className="w-64" value={text} onChange={(e) => { setText(e.target.value); setPage(0); }} /><Select aria-label="Status" className="w-48" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}><option value="">Any status</option>{['CONFIRMED', 'PENDING_PAYMENT', 'PARTIALLY_CANCELLED', 'CANCELLED', 'EXPIRED', 'FAILED'].map((s) => <option key={s} value={s}>{s.replace('_', ' ').toLowerCase()}</option>)}</Select></div>} />
      <DataTable rows={q.data?.data ?? []} columns={columns} meta={q.data?.meta} loading={q.isFetching} page={page} onPage={(m) => setPage(m.page)} /></div>
  );
}
