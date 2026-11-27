'use server';
import { revalidatePath } from 'next/cache';
import { labService } from '@/server/services/laboratory.service';
import { run, type ActionState } from '@/server/http/action';
const bust = () => { for (const p of ['/lab/requests', '/lab', '/lab/reports', '/patient/lab', '/doctor/lab']) revalidatePath(p); };
export async function requestLabTestsAction(values: unknown) { const r = await run((p) => labService.request(p, values), 'Laboratory request created'); if (r.ok) bust(); return { ok: r.ok, message: r.message, fieldErrors: r.fieldErrors }; }
export async function setLabStatusAction(id: number, status: string) { const r = await run((p) => labService.setStatus(p, id, { status }), 'Status updated'); if (r.ok) bust(); return { ok: r.ok, message: r.message }; }
export async function scheduleLabAction(id: number, at: string) { const r = await run((p) => labService.schedule(p, id, new Date(at).toISOString()), 'Scheduled'); if (r.ok) bust(); return { ok: r.ok, message: r.message }; }
/** Report entry with optional file upload (multipart FormData through a form action). */
export async function enterReportAction(id: number, _p: ActionState, fd: FormData): Promise<ActionState> {
  const f = fd.get('file');
  const r = await run((p) => labService.enterReport(p, id, { resultSummary: fd.get('resultSummary') ?? '', resultDetails: fd.get('resultDetails') ?? '', referenceRange: fd.get('referenceRange') ?? '', abnormal: fd.get('abnormal') === 'on', publish: fd.get('publish') === 'on' }, f instanceof File ? f : null), 'Report saved');
  if (r.ok) bust(); return { ok: r.ok, message: r.message, fieldErrors: r.fieldErrors };
}
export async function createLabTestAction(values: unknown) { const r = await run((p) => labService.createTest(p, values), 'Test added to the catalogue'); if (r.ok) revalidatePath('/lab/catalog'); return { ok: r.ok, message: r.message, fieldErrors: r.fieldErrors }; }
