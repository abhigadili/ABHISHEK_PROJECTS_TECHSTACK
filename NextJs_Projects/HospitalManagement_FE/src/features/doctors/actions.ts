'use server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { doctorService } from '@/server/services/doctor.service';
import { run } from '@/server/http/action';
import { TAGS } from '@/lib/constants/cache';

/** On-demand revalidation of the PUBLIC cached doctor directory after any doctor change. */
const bust = (id?: number) => { revalidateTag(TAGS.doctors, 'max'); revalidatePath('/doctors'); if (id) revalidatePath(`/doctors/${id}`); revalidatePath('/admin/doctors'); };
export async function registerDoctorAction(values: unknown) { const r = await run((p) => doctorService.register(p, values), 'Doctor registered'); if (r.ok) bust(); return { ok: r.ok, message: r.message, fieldErrors: r.fieldErrors, data: r.ok ? { id: r.data!.id } : undefined }; }
export async function updateDoctorProfileAction(id: number, values: unknown) { const r = await run((p) => doctorService.updateProfile(p, id, values), 'Profile updated'); if (r.ok) { bust(id); revalidatePath('/doctor/profile'); } return { ok: r.ok, message: r.message, fieldErrors: r.fieldErrors }; }
export async function saveAvailabilityAction(doctorId: number, values: unknown) { const r = await run((p) => doctorService.setAvailability(p, doctorId, values), 'Availability saved'); if (r.ok) { revalidatePath('/doctor/availability'); revalidatePath('/patient/book'); } return { ok: r.ok, message: r.message, fieldErrors: r.fieldErrors }; }
export async function addTimeOffAction(doctorId: number, values: unknown) { const r = await run((p) => doctorService.addTimeOff(p, doctorId, values), 'Day off added'); if (r.ok) revalidatePath('/doctor/availability'); return { ok: r.ok, message: r.message, fieldErrors: r.fieldErrors }; }
export async function removeTimeOffAction(doctorId: number, id: number) { const r = await run((p) => doctorService.removeTimeOff(p, doctorId, id), 'Day off removed'); if (r.ok) revalidatePath('/doctor/availability'); return { ok: r.ok, message: r.message }; }
export async function deactivateDoctorAction(id: number) { const r = await run((p) => doctorService.deactivate(p, id), 'Doctor deactivated'); if (r.ok) bust(id); return { ok: r.ok, message: r.message }; }
