import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BookingView } from '@/components/common/BookingView';
import { getBooking } from '@/features/bookings/server';
import { BackendError } from '@/lib/server/backend';

export const metadata: Metadata = { title: 'Ticket details', robots: { index: false, follow: false } };
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ booked?: string }> };
/** Full-page booking detail (hard navigation / refresh / shared link). Ownership is enforced by Express: another user's id returns 403/404. */
export default async function BookingPage({ params, searchParams }: Props) {
  const [{ id }, sp] = await Promise.all([params, searchParams]); if (!/^\d+$/.test(id)) notFound();
  const booking = await getBooking(id).catch((e) => { if (e instanceof BackendError && [403, 404].includes(e.status)) notFound(); throw e; });
  return <BookingView b={booking} justBooked={sp.booked === '1'} />;
}
