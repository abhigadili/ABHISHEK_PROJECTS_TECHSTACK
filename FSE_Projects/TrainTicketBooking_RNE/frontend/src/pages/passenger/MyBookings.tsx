import { useState } from 'react';
import { BookingCard } from '@/components/BookingCard';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Field';
import { EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui/Feedback';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { useDocumentTitle } from '@/hooks';
import { useBookings } from '@/services/queries';

export default function MyBookings() {
  useDocumentTitle('My bookings'); const [scope, setScope] = useState('upcoming'); const [status, setStatus] = useState(''); const [pageNo, setPageNo] = useState(0);
  const q = useBookings({ scope: scope === 'all' ? undefined : scope, status: status || undefined, page: pageNo, size: 8 });
  return (
    <div>
      <PageHeader title="My bookings" subtitle="Upcoming trips and travel history" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Tabs value={scope} onValueChange={(v) => { setScope(v); setPageNo(0); }}><TabsList><TabsTrigger value="upcoming">Upcoming</TabsTrigger><TabsTrigger value="past">Past</TabsTrigger><TabsTrigger value="all">All</TabsTrigger></TabsList></Tabs>
        <Select aria-label="Filter by status" className="w-52" value={status} onChange={(e) => { setStatus(e.target.value); setPageNo(0); }}><option value="">Any status</option>{['CONFIRMED', 'PENDING_PAYMENT', 'PARTIALLY_CANCELLED', 'CANCELLED', 'EXPIRED', 'FAILED'].map((s) => <option key={s} value={s}>{s.replace('_', ' ').toLowerCase()}</option>)}</Select>
      </div>
      <div className={`space-y-3 ${q.isPlaceholderData ? 'opacity-60' : ''}`}>
        {q.isLoading ? <Skeleton className="h-24" /> : q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : q.data!.data.length === 0 ? <EmptyState title="No bookings here" hint="Nothing matches these filters." /> : q.data!.data.map((b) => <BookingCard key={b.id} b={b} />)}
      </div>
      <Pagination meta={q.data?.meta} onPage={setPageNo} />
    </div>
  );
}
