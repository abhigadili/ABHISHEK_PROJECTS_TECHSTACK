'use server';
import { revalidatePath, updateTag } from 'next/cache';
import { z } from 'zod';
import { appointmentService } from '@/services/backend/appointments';
import { authorize, failure, invalid, str, success, type ActionState } from '@/lib/actions/state';
import { CACHE_TAGS } from '@/constants/cache';
import type { Appointment } from '@/types';

const bookSchema = z.object({
  patientId: z.number().int().positive('Select a patient'),
  doctorId: z.number().int().positive('Select a doctor'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Select a date'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Select a time slot'),
  reason: z.string().trim().max(255, 'At most 255 characters').optional(),
});
export type BookInput = z.input<typeof bookSchema>;

function refresh(doctorId?: number) {
  updateTag(CACHE_TAGS.appointments);
  if (doctorId) updateTag(CACHE_TAGS.availability(doctorId));
  revalidatePath('/appointments');
  revalidatePath('/dashboard');
  revalidatePath('/patients/[patientId]', 'layout');
}

/** Scenario 2 - Appointment booking (React Hook Form -> typed Server Action). The backend prevents double-booking (409). */
export async function bookAppointmentAction(input: BookInput): Promise<ActionState<Appointment>> {
  const auth = await authorize('appointments:book');
  if ('denied' in auth) return auth.denied;
  const parsed = bookSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const a = await appointmentService.book({ ...parsed.data, reason: parsed.data.reason || null });
    refresh(a.doctorId);
    return success(`Appointment booked for ${a.date} at ${a.startTime}`, a);
  } catch (e) { return failure(e); }
}

export async function cancelAppointmentAction(id: number, reason?: string): Promise<ActionState<Appointment>> {
  const auth = await authorize('appointments:manage');
  if ('denied' in auth) return auth.denied;
  try {
    const a = await appointmentService.cancel(id, reason?.trim() || undefined);
    refresh(a.doctorId);
    revalidatePath(`/appointments/${id}`);
    return success('Appointment cancelled', a);
  } catch (e) { return failure(e); }
}

export async function rescheduleAppointmentAction(_p: ActionState<Appointment>, fd: FormData): Promise<ActionState<Appointment>> {
  const auth = await authorize('appointments:manage');
  if ('denied' in auth) return auth.denied;
  const id = Number(str(fd, 'id'));
  const parsed = z.object({ date: bookSchema.shape.date, startTime: bookSchema.shape.startTime }).safeParse({ date: str(fd, 'date'), startTime: str(fd, 'startTime') });
  if (!parsed.success) return invalid(parsed.error);
  try {
    const a = await appointmentService.reschedule(id, parsed.data);
    refresh(a.doctorId);
    revalidatePath(`/appointments/${id}`);
    return success(`Rescheduled to ${a.date} ${a.startTime}`, a);
  } catch (e) { return failure(e); }
}

export async function completeAppointmentAction(_p: ActionState<Appointment>, fd: FormData): Promise<ActionState<Appointment>> {
  const auth = await authorize('appointments:complete');
  if ('denied' in auth) return auth.denied;
  const id = Number(str(fd, 'id'));
  try {
    const a = await appointmentService.complete(id, str(fd, 'notes').trim() || undefined);
    refresh(a.doctorId);
    revalidatePath(`/appointments/${id}`);
    return success('Appointment marked as completed', a);
  } catch (e) { return failure(e); }
}
