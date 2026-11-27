'use server';
import { revalidatePath, updateTag } from 'next/cache';
import { prescriptionService } from '@/services/backend/prescriptions';
import { authorize, failure, invalid, success, type ActionState } from '@/lib/actions/state';
import { prescriptionSchema } from '@/schemas/prescription';
import { CACHE_TAGS } from '@/constants/cache';
import { emptyToNull } from '@/lib/utilities/format';
import type { Prescription } from '@/types';

/** Scenario 5 - Prescription generation (Formik form on the client; Zod re-validation here, including the duplicate-medicine rule). */
export async function createPrescriptionAction(values: unknown): Promise<ActionState<Prescription>> {
  const auth = await authorize('prescriptions:create');
  if ('denied' in auth) return auth.denied;
  const parsed = prescriptionSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  try {
    const rx = await prescriptionService.create({
      patientId: v.patientId, doctorId: v.doctorId, appointmentId: v.appointmentId ?? null, diagnosis: emptyToNull(v.diagnosis), notes: emptyToNull(v.notes), validDays: v.validDays,
      items: v.items.map((i) => ({ ...i, instructions: emptyToNull(i.instructions) })),
    });
    updateTag(CACHE_TAGS.prescriptions); updateTag(CACHE_TAGS.pharmacy);
    revalidatePath('/prescriptions'); revalidatePath(`/patients/${v.patientId}/prescriptions`);
    return success(`Prescription #${rx.id} generated`, rx);
  } catch (e) { return failure(e); }
}

export async function cancelPrescriptionAction(id: number): Promise<ActionState> {
  const auth = await authorize('prescriptions:create');
  if ('denied' in auth) return auth.denied;
  try { await prescriptionService.cancel(id); updateTag(CACHE_TAGS.prescriptions); revalidatePath(`/prescriptions/${id}`); revalidatePath('/prescriptions'); return success('Prescription cancelled'); } catch (e) { return failure(e); }
}
