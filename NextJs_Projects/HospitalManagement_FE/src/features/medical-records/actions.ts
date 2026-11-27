'use server';
import { revalidatePath } from 'next/cache';
import { recordService } from '@/server/services/medical-record.service';
import { run } from '@/server/http/action';
import { AppError } from '@/server/utilities/errors';

export async function createRecordAction(values: unknown) { const r = await run((p) => recordService.create(p, values), 'Record saved'); if (r.ok) { revalidatePath('/doctor/patients/[id]', 'page'); revalidatePath('/patient/records'); } return { ok: r.ok, message: r.message, fieldErrors: r.fieldErrors, data: r.ok ? { id: r.data!.id } : undefined }; }
export async function uploadRecordDocumentAction(recordId: number, fd: FormData) { const r = await run(async (p) => { const f = fd.get('file'); if (!(f instanceof File) || !f.size) throw new AppError(400, 'BAD_REQUEST', 'Choose a file', { file: 'Required' }); return recordService.attach(p, recordId, f); }, 'Document uploaded'); if (r.ok) revalidatePath('/doctor/patients/[id]', 'page'); return { ok: r.ok, message: r.message, fieldErrors: r.fieldErrors }; }
export async function deleteRecordAction(id: number) { const r = await run((p) => recordService.remove(p, id), 'Record removed'); if (r.ok) revalidatePath('/doctor/patients/[id]', 'page'); return { ok: r.ok, message: r.message }; }
