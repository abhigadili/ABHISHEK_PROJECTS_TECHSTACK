import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SimpleTable } from '@/components/SimpleTable';
import { StatusBadge } from '@/components/ui/Badge';
import { ErrorState, PageHeader, Skeleton } from '@/components/ui/Feedback';
import { Pagination } from '@/components/ui/Pagination';
import { useDocumentTitle } from '@/hooks';
import { usePayments } from '@/services/queries';
import { fmtDateTime, inr } from '@/utils/format';

export default function PaymentsHistory() {
  useDocumentTitle('Payments'); const [page, setPage] = useState(0); const q = usePayments({ page, size: 10 });
  return (
    <div><PageHeader title="Payments" subtitle="Every payment attempt on your bookings" />
      {q.isLoading ? <Skeleton className="h-40" /> : q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : (
        <SimpleTable rows={q.data!.data} empty="No payments yet" cols={[
          { head: 'Reference', cell: (p) => <span className="font-mono text-xs">{p.reference}</span> }, { head: 'Booking', cell: (p) => <Link className="text-indigo-600" to={`/account/bookings/${p.booking?.id}`}>#{p.booking?.id}</Link> },
          { head: 'Method', cell: (p) => `${p.method.replace('_', ' ').toLowerCase()}${p.cardLast4 ? ` ····${p.cardLast4}` : ''}` }, { head: 'Date', cell: (p) => fmtDateTime(p.createdAt) },
          { head: 'Status', cell: (p) => <StatusBadge status={p.status} /> }, { head: 'Amount', right: true, cell: (p) => inr(p.amount) }]} />)}
      <Pagination meta={q.data?.meta} onPage={setPage} />
    </div>
  );
}
