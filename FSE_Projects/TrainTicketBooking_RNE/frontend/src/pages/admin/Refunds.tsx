import type { GridColDef } from '@mui/x-data-grid';
import { useState } from 'react';
import { DataTable } from '@/components/DataTable';
import { StatusBadge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/Feedback';
import { useDocumentTitle } from '@/hooks';
import { useAdminList } from '@/services/queries';
import { fmtDateTime, inr } from '@/utils/format';
import type { Refund } from '@/types';

const columns: GridColDef<Refund>[] = [
  { field: 'reference', headerName: 'Reference', width: 200 }, { field: 'bookingId', headerName: 'Booking', width: 110, valueGetter: (_v, r) => `#${r.bookingId}` }, { field: 'paymentId', headerName: 'Payment', width: 110, valueGetter: (_v, r) => `#${r.paymentId}` },
  { field: 'status', headerName: 'Status', width: 150, renderCell: (p) => <StatusBadge status={p.row.status} /> }, { field: 'amount', headerName: 'Amount', width: 130, align: 'right', headerAlign: 'right', valueGetter: (_v, r) => inr(r.amount) },
  { field: 'createdAt', headerName: 'Date', flex: 1, minWidth: 170, valueGetter: (_v, r) => fmtDateTime(r.createdAt) },
];
export default function Refunds() {
  useDocumentTitle('Refunds'); const [page, setPage] = useState(0); const q = useAdminList<Refund>('refunds', '/refunds', { page, size: 10 });
  return <div><PageHeader title="Refunds" subtitle="Refunds issued after cancellations" /><DataTable rows={q.data?.data ?? []} columns={columns} meta={q.data?.meta} loading={q.isFetching} page={page} onPage={(m) => setPage(m.page)} /></div>;
}
