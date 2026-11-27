'use server';
import { revalidatePath, updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { patientService } from '@/services/backend/patients';
import { authorize, failure, invalid, str, success, type ActionState } from '@/lib/actions/state';
import { contactSchema, personalSchema, patientFormSchema, type PatientFormValues } from '@/schemas/patient';
import { CACHE_TAGS } from '@/constants/cache';
import { emptyToNull } from '@/lib/utilities/format';
import type { Patient, PatientInput } from '@/types';

const toInput = (v: PatientFormValues): PatientInput => ({
  firstName: v.firstName, lastName: v.lastName, dateOfBirth: v.dateOfBirth, gender: v.gender, email: v.email, phone: v.phone,
  identityNumber: emptyToNull(v.identityNumber), bloodGroup: (emptyToNull(v.bloodGroup) as PatientInput['bloodGroup']) ?? null, address: emptyToNull(v.address),
  emergencyContactName: emptyToNull(v.emergencyContactName), emergencyContactPhone: emptyToNull(v.emergencyContactPhone), knownAllergies: emptyToNull(v.knownAllergies),
});

/** Scenario 1 - Patient Registration. Called from a React Hook Form (client) with a typed object; validated AGAIN with the same Zod schema. */
export async function registerPatientAction(values: PatientFormValues): Promise<ActionState<{ id: number }>> {
  const auth = await authorize('patients:create');
  if ('denied' in auth) return auth.denied;
  const parsed = patientFormSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const p = await patientService.create(toInput(parsed.data as PatientFormValues));
    updateTag(CACHE_TAGS.patients); // read-your-writes invalidation of anything tagged "patients"
    revalidatePath('/patients');
    revalidatePath('/dashboard');
    return success(`Patient ${p.firstName} ${p.lastName} registered`, { id: p.id });
  } catch (e) { return failure(e); }
}

/** Patient profile update: classic <form action={...}> + FormData + useActionState => works without JavaScript (progressive enhancement). */
export async function updatePatientAction(_prev: ActionState<Patient>, fd: FormData): Promise<ActionState<Patient>> {
  const auth = await authorize('patients:update');
  if ('denied' in auth) return auth.denied;
  const id = Number(str(fd, 'id'));
  const raw = Object.fromEntries(['firstName', 'lastName', 'dateOfBirth', 'gender', 'bloodGroup', 'identityNumber', 'email', 'phone', 'address', 'emergencyContactName', 'emergencyContactPhone', 'knownAllergies'].map((k) => [k, str(fd, k)]));
  const p1 = personalSchema.safeParse(raw);
  const p2 = contactSchema.safeParse(raw);
  if (!p1.success || !p2.success) {
    const e = { ...(p1.success ? {} : Object.fromEntries(p1.error.issues.map((i) => [i.path.join('.'), i.message]))), ...(p2.success ? {} : Object.fromEntries(p2.error.issues.map((i) => [i.path.join('.'), i.message]))) };
    return { ok: false, message: 'Please fix the highlighted fields', fieldErrors: e };
  }
  try {
    const p = await patientService.update(id, toInput({ ...p1.data, ...p2.data } as PatientFormValues));
    updateTag(CACHE_TAGS.patient(id));
    revalidatePath(`/patients/${id}`);
    revalidatePath('/patients');
    return success('Patient profile updated', p);
  } catch (e) { return failure(e); }
}

export async function deactivatePatientAction(id: number): Promise<ActionState> {
  const auth = await authorize('patients:deactivate');
  if ('denied' in auth) return auth.denied;
  try {
    await patientService.deactivate(id);
    updateTag(CACHE_TAGS.patients);
    revalidatePath('/patients');
  } catch (e) { return failure(e); }
  redirect('/patients');
}
