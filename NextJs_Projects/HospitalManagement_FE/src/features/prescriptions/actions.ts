'use server';
import { revalidatePath } from 'next/cache';
import { prescriptionService } from '@/server/services/prescription.service';
import { run } from '@/server/http/action';
const bust = () => { for (const p of ['/patient/prescriptions', '/pharmacy/queue', '/doctor/patients/[id]']) revalidatePath(p, p.includes('[') ? 'page' : undefined); };
/** Scenario 5 (doctor side): Formik form -> typed Server Action -> Zod re-validation -> transaction -> notification. */
export async function createPrescriptionAction(values: unknown) { const r = await run((p) => prescriptionService.create(p, values), 'Prescription saved'); if (r.ok) bust(); return { ok: r.ok, message: r.message, fieldErrors: r.fieldErrors, data: r.ok ? { id: r.data!.id } : undefined }; }
export async function updatePrescriptionAction(id: number, values: unknown) { const r = await run((p) => prescriptionService.update(p, id, values), 'Prescription updated'); if (r.ok) bust(); return { ok: r.ok, message: r.message, fieldErrors: r.fieldErrors }; }
export async function cancelPrescriptionAction(id: number) { const r = await run((p) => prescriptionService.cancel(p, id), 'Prescription cancelled'); if (r.ok) bust(); return { ok: r.ok, message: r.message }; }
