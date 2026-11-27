import { notFound } from 'next/navigation';
import { BookingView } from '@/components/common/BookingView';
import { RouteModal } from '@/components/common/RouteModal';
import { getBooking } from '@/features/bookings/server';
import { BackendError } from '@/lib/server/backend';

/** INTERCEPTING ROUTE: clicking a booking in the history list opens the detail in a dialog over the list; a refresh shows ./[id]/page.tsx. */
export default async function BookingModal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; if (!/^\d+$/.test(id)) notFound();
  const booking = await getBooking(id).catch((e) => { if (e instanceof BackendError && [403, 404].includes(e.status)) notFound(); throw e; });
  return <RouteModal title={`Booking #${booking.id}`} description={`${booking.train.name} · PNR ${booking.pnr?.pnr ?? 'pending'}`} wide><BookingView b={booking} compact /></RouteModal>;
}
