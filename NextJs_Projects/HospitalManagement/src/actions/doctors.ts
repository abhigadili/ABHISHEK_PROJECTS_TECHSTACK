'use server';
import { revalidatePath, revalidateTag, updateTag } from 'next/cache';
import { doctorService } from '@/services/backend/doctors';
import { authService } from '@/services/backend/auth';
import { authorize, failure, invalid, success, type ActionState } from '@/lib/actions/state';
import { doctorSchema, scheduleSchema, type DoctorFormValues } from '@/schemas/doctor';
import { CACHE_TAGS } from '@/constants/cache';
import { emptyToNull } from '@/lib/utilities/format';
import type { Doctor, ScheduleDay } from '@/types';

function bust(id?: number) {
  updateTag(CACHE_TAGS.doctors); // scenario 3: revalidate doctor information when updated
  revalidateTag(CACHE_TAGS.doctors, 'max'); // ... and mark the shared ISR entries (public directory) stale-while-revalidate
  if (id) updateTag(CACHE_TAGS.doctorSchedule(id));
  revalidatePath('/doctors');
  revalidatePath('/public/doctors');
  if (id) { revalidatePath(`/doctors/${id}`); revalidatePath(`/public/doctors/${id}`); }
}

/** Create/update a doctor (ADMIN). Optionally creates the doctor's login first (2 sequential backend calls). */
export async function saveDoctorAction(id: number | null, values: DoctorFormValues): Promise<ActionState<Doctor>> {
  const auth = await authorize('doctors:manage');
  if ('denied' in auth) return auth.denied;
  const parsed = doctorSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  try {
    let userId: number | null = null;
    if (!id && v.createLogin) {
      const u = await authService.createUser({ username: v.username, email: v.email, password: v.password, role: 'DOCTOR' });
      userId = u.id;
    }
    const payload = {
      firstName: v.firstName, lastName: v.lastName, email: v.email, phone: emptyToNull(v.phone), licenseNumber: v.licenseNumber, specialization: v.specialization,
      qualification: emptyToNull(v.qualification), experienceYears: v.experienceYears, consultationFee: v.consultationFee, hospitalId: v.hospitalId, departmentId: v.departmentId || null, userId,
    };
    const d = id ? await doctorService.update(id, payload) : await doctorService.create(payload);
    bust(d.id);
    return success(id ? 'Doctor updated' : 'Doctor created', d);
  } catch (e) { return failure(e); }
}

export async function saveScheduleAction(doctorId: number, values: unknown): Promise<ActionState> {
  const auth = await authorize('doctors:schedule');
  if ('denied' in auth) return auth.denied;
  const parsed = scheduleSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  try {
    await doctorService.putSchedule(doctorId, parsed.data.days.map((d) => ({ ...d, breakStart: d.breakStart || null, breakEnd: d.breakEnd || null })) as ScheduleDay[]);
    updateTag(CACHE_TAGS.availability(doctorId));
    bust(doctorId);
    return success('Weekly schedule saved');
  } catch (e) { return failure(e); }
}

export async function addDayOffAction(doctorId: number, date: string, reason: string): Promise<ActionState> {
  const auth = await authorize('doctors:schedule');
  if ('denied' in auth) return auth.denied;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, message: 'Select a date', fieldErrors: { date: 'Select a date' } };
  try { await doctorService.addUnavailability(doctorId, { date, reason: reason.trim() || undefined }); updateTag(CACHE_TAGS.availability(doctorId)); bust(doctorId); return success('Day off added'); } catch (e) { return failure(e); }
}
export async function removeDayOffAction(doctorId: number, uid: number): Promise<ActionState> {
  const auth = await authorize('doctors:schedule');
  if ('denied' in auth) return auth.denied;
  try { await doctorService.removeUnavailability(doctorId, uid); updateTag(CACHE_TAGS.availability(doctorId)); bust(doctorId); return success('Day off removed'); } catch (e) { return failure(e); }
}
