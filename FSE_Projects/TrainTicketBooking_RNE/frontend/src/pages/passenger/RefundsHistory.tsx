import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SimpleTable } from '@/components/SimpleTable';
import { StatusBadge } from '@/components/ui/Badge';
import { ErrorState, PageHeader, Skeleton } from '@/components/ui/Feedback';
import { Pagination } from '@/components/ui/Pagination';
import { useDocumentTitle } from '@/hooks';
import { useRefunds } from '@/services/queries';
import { fmtDateTime, inr } from '@/utils/format';

export default function RefundsHistory() {
  useDocumentTitle('Refunds'); const [page, setPage] = useState(0); const q = useRefunds({ page, size: 10 });
  return (
    <div><PageHeader title="Refunds" subtitle="Money returned after cancellations" />
      {q.isLoading ? <Skeleton className="h-40" /> : q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : (
        <SimpleTable rows={q.data!.data} empty="No refunds yet" cols={[
          { head: 'Reference', cell: (r) => <span className="font-mono text-xs">{r.reference}</span> }, { head: 'Booking', cell: (r) => <Link className="text-indigo-600" to={`/account/bookings/${r.bookingId}`}>#{r.bookingId}</Link> },
          { head: 'Date', cell: (r) => fmtDateTime(r.createdAt) }, { head: 'Status', cell: (r) => <StatusBadge status={r.status} /> }, { head: 'Amount', right: true, cell: (r) => inr(r.amount) }]} />)}
      <Pagination meta={q.data?.meta} onPage={setPage} />
    </div>
  );
}
