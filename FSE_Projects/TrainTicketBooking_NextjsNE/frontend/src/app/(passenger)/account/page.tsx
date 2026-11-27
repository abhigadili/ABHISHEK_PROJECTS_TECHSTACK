import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { BookingCard } from '@/components/common/BookingCard';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState, PageHeader, Skeleton } from '@/components/ui/Feedback';
import { getBookings, getNotifications, getPayments } from '@/features/bookings/server';
import { requireUser } from '@/lib/server/session';
import { inr } from '@/utils/format';

export const metadata: Metadata = { title: 'My account', robots: { index: false } };
async function Upcoming() {
  const { data } = await getBookings({ scope: 'upcoming', size: 3 });
  return data.length ? <div className="space-y-3">{data.map((b) => <BookingCard key={b.id} b={b} />)}</div> : <EmptyState title="No upcoming trips" hint="Search for a train to plan your next journey." />;
}
async function Stats() {
  // PARALLEL data fetching: both requests start together instead of one after the other.
  const [pay, notes] = await Promise.all([getPayments({ size: 100 }), getNotifications(0, 1)]);
  const spent = pay.data.filter((p) => ['SUCCEEDED', 'PARTIALLY_REFUNDED'].includes(p.status)).reduce((s, p) => s + Number(p.amount), 0);
  return <div className="grid gap-4 sm:grid-cols-3">{[['Payments made', String(pay.meta?.total ?? 0)], ['Paid (recent)', inr(spent)], ['Unread notifications', String(notes.unread)]].map(([l, v]) => <Card key={l}><CardBody><p className="text-sm text-slate-500">{l}</p><p className="mt-1 text-2xl font-bold">{v}</p></CardBody></Card>)}</div>;
}
/** AUTHENTICATED DYNAMIC rendering: per-user data, never cached. Sections stream independently behind their own Suspense boundaries. */
export default async function AccountPage() {
  const user = await requireUser();
  return (
    <div className="space-y-6">
      <PageHeader title={`Hello, ${user.name.split(' ')[0]}`} subtitle="Your trips at a glance" actions={<Button asChild><Link href="/">Book a ticket</Link></Button>} />
      <Suspense fallback={<Skeleton className="h-24" />}><Stats /></Suspense>
      <Card><CardHeader><CardTitle>Upcoming journeys</CardTitle><Link className="text-sm text-indigo-600" href="/account/bookings">View all</Link></CardHeader><CardBody><Suspense fallback={<Skeleton className="h-20" />}><Upcoming /></Suspense></CardBody></Card>
    </div>
  );
}
