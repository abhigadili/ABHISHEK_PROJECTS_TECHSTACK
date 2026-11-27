import type { GridColDef } from '@mui/x-data-grid';
import { useState } from 'react';
import { DataTable } from '@/components/DataTable';
import { StatusBadge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/Feedback';
import { useDocumentTitle } from '@/hooks';
import { useAdminList } from '@/services/queries';
import { fmtDateTime, inr } from '@/utils/format';
import type { Payment } from '@/types';

const columns: GridColDef<Payment>[] = [
  { field: 'reference', headerName: 'Reference', width: 190 }, { field: 'booking', headerName: 'Booking', width: 100, valueGetter: (_v, r) => `#${r.booking?.id ?? ''}` },
  { field: 'method', headerName: 'Method', width: 160, valueGetter: (_v, r) => `${r.method.replace('_', ' ').toLowerCase()}${r.cardLast4 ? ` ····${r.cardLast4}` : ''}` },
  { field: 'status', headerName: 'Status', width: 190, renderCell: (p) => <StatusBadge status={p.row.status} /> }, { field: 'amount', headerName: 'Amount', width: 130, align: 'right', headerAlign: 'right', valueGetter: (_v, r) => inr(r.amount) },
  { field: 'createdAt', headerName: 'Date', flex: 1, minWidth: 170, valueGetter: (_v, r) => fmtDateTime(r.createdAt) },
];
export default function Payments() {
  useDocumentTitle('Payments'); const [page, setPage] = useState(0); const [status, setStatus] = useState('');
  const q = useAdminList<Payment>('payments', '/payments', { page, size: 10, status: status || undefined });
  return (
    <div><PageHeader title="Payments" subtitle="All payment attempts" actions={<Select aria-label="Status" className="w-52" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}><option value="">Any status</option>{['INITIATED', 'SUCCEEDED', 'FAILED', 'PARTIALLY_REFUNDED', 'REFUNDED'].map((s) => <option key={s} value={s}>{s.replace('_', ' ').toLowerCase()}</option>)}</Select>} />
      <DataTable rows={q.data?.data ?? []} columns={columns} meta={q.data?.meta} loading={q.isFetching} page={page} onPage={(m) => setPage(m.page)} /></div>
  );
}
