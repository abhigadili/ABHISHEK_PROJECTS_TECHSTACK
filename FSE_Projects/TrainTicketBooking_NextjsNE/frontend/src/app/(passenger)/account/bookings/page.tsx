import type { Metadata } from 'next';
import { BookingCard } from '@/components/common/BookingCard';
import { BookingFilters } from '@/components/common/BookingFilters';
import { LinkPagination } from '@/components/common/LinkPagination';
import { EmptyState, PageHeader } from '@/components/ui/Feedback';
import { getBookings } from '@/features/bookings/server';

export const metadata: Metadata = { title: 'My bookings', robots: { index: false } };
type Props = { searchParams: Promise<{ page?: string; scope?: string; status?: string }> };
/** Booking history: server-side pagination + filtering driven by the URL. Always fresh and private (no-store). */
export default async function BookingsPage({ searchParams }: Props) {
  const sp = await searchParams; const scope = sp.scope ?? 'upcoming'; const page = Math.max(0, Number(sp.page) || 0);
  const { data, meta } = await getBookings({ page, size: 8, scope: scope === 'all' ? undefined : scope, status: sp.status });
  return (
    <div><PageHeader title="My bookings" subtitle="Upcoming trips and travel history" />
      <BookingFilters />
      <div className="mt-4 space-y-3">{data.length === 0 ? <EmptyState title="No bookings here" hint="Nothing matches these filters." /> : data.map((b) => <BookingCard key={b.id} b={b} />)}</div>
      <LinkPagination meta={meta} basePath="/account/bookings" params={{ scope: sp.scope, status: sp.status }} />
    </div>
  );
}
