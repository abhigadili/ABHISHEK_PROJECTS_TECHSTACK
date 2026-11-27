'use server';
import { revalidatePath } from 'next/cache';
import { backend } from '@/lib/server/backend';
import { failure, parse } from '@/lib/server/action-utils';
import { requireUser } from '@/lib/server/session';
import { cancelBookingSchema, createBookingSchema } from '@/validations/booking';
import type { ActionResult, Booking } from '@/types';
import { z } from 'zod';

/** Booking request. Express validates availability, allocates seats, prices the fare and holds the seats for payment. */
export async function createBookingAction(input: unknown): Promise<ActionResult<{ id: number }>> {
  await requireUser(['PASSENGER', 'ADMIN', 'BOOKING_STAFF']);
  const v = parse(createBookingSchema, input); if (!v.ok) return v.result;
  try { const { data } = await backend<Booking>('/bookings', { method: 'POST', body: v.data }); revalidatePath('/account/bookings'); return { ok: true, data: { id: data.id } }; } catch (e) { return failure(e); }
}
export async function cancelBookingAction(input: { id: number; passengerIds?: number[]; reason?: string }): Promise<ActionResult<Booking>> {
  await requireUser();
  const v = parse(z.object({ id: z.number().int().positive() }).and(cancelBookingSchema), input); if (!v.ok) return v.result;
  try {
    const { data } = await backend<Booking>(`/bookings/${v.data.id}/cancel`, { method: 'POST', body: { passengerIds: v.data.passengerIds, reason: v.data.reason ?? 'Cancelled by passenger' } });
    revalidatePath('/account', 'layout'); // history, detail, refunds, payments and the dashboard all change
    return { ok: true, data, message: 'Cancellation processed - refund initiated.' };
  } catch (e) { return failure(e); }
}
