'use server';
import { revalidatePath } from 'next/cache';
import { patientService } from '@/server/services/patient.service';
import { run, type ActionState } from '@/server/http/action';

const fd2obj = (fd: FormData, keys: string[]) => Object.fromEntries(keys.map((k) => [k, (fd.get(k) ?? '').toString()]));
/** Profile update: plain <form action> + FormData + useActionState (progressive enhancement). */
export async function updatePatientProfileAction(id: number, _p: ActionState, fd: FormData): Promise<ActionState> {
  const r = await run((p) => patientService.update(p, id, fd2obj(fd, ['firstName', 'lastName', 'phone', 'dateOfBirth', 'gender', 'bloodGroup', 'address', 'city', 'emergencyContactName', 'emergencyContactPhone', 'medicalHistory'])), 'Profile updated');
  if (r.ok) { revalidatePath('/patient/profile'); revalidatePath('/admin/patients'); }
  return { ok: r.ok, message: r.message, fieldErrors: r.fieldErrors };
}
export async function deletePatientAction(id: number) { const r = await run((p) => patientService.remove(p, id), 'Patient removed'); if (r.ok) revalidatePath('/admin/patients'); return { ok: r.ok, message: r.message }; }
