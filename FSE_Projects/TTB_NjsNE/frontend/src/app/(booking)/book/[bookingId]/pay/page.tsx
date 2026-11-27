import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { PaymentForm } from '@/components/forms/PaymentForm';
import { getBooking } from '@/features/bookings/server';
import { BackendError } from '@/lib/server/backend';

export const metadata: Metadata = { title: 'Payment', robots: { index: false } };
/** Server-side gate: loads the booking (Express checks ownership), redirects confirmed bookings to their ticket, then hands off to the client form. */
export default async function PayPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params; if (!/^\d+$/.test(bookingId)) notFound();
  const booking = await getBooking(bookingId).catch((e) => { if (e instanceof BackendError && [403, 404].includes(e.status)) notFound(); throw e; });
  if (booking.status === 'CONFIRMED') redirect(`/account/bookings/${booking.id}`);
  return <PaymentForm booking={booking} />;
}
