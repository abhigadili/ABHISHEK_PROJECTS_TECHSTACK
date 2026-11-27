'use server';
import { revalidatePath } from 'next/cache';
import { appointmentService } from '@/server/services/appointment.service';
import { run } from '@/server/http/action';

const refresh = () => { for (const p of ['/patient', '/patient/appointments', '/doctor', '/doctor/appointments', '/admin/appointments']) revalidatePath(p); };
/** Scenario 2: typed Server Action called from the booking wizard (RHF). */
export async function bookAppointmentAction(values: unknown) { const r = await run((p) => appointmentService.book(p, values), 'Appointment booked'); if (r.ok) refresh(); return r.ok ? { ...r, data: { id: r.data!.id, code: r.data!.confirmationCode } } : r; }
export async function cancelAppointmentAction(id: number, reason: string) { const r = await run((p) => appointmentService.setStatus(p, id, { status: 'CANCELLED', reason }), 'Appointment cancelled'); if (r.ok) refresh(); return { ok: r.ok, message: r.message, fieldErrors: r.fieldErrors }; }
export async function setAppointmentStatusAction(id: number, status: string) { const r = await run((p) => appointmentService.setStatus(p, id, { status }), 'Status updated'); if (r.ok) refresh(); return { ok: r.ok, message: r.message }; }
export async function rescheduleAppointmentAction(id: number, startsAt: string) { const r = await run((p) => appointmentService.reschedule(p, id, { startsAt }), 'Appointment rescheduled'); if (r.ok) refresh(); return { ok: r.ok, message: r.message, fieldErrors: r.fieldErrors }; }
