'use server';
import { revalidatePath, updateTag } from 'next/cache';
import { labService } from '@/services/backend/laboratory';
import { authorize, failure, invalid, str, success, type ActionState } from '@/lib/actions/state';
import { labReportSchema, labRequestSchema } from '@/schemas/laboratory';
import { CACHE_TAGS } from '@/constants/cache';
import { emptyToNull } from '@/lib/utilities/format';
import type { LabRequest, LabStatus } from '@/types';

/** Scenario 4 - one backend request per selected test, executed in parallel with Promise.allSettled (partial success is reported). */
export async function createLabRequestsAction(values: unknown): Promise<ActionState<{ created: LabRequest[]; failed: string[] }>> {
  const auth = await authorize('lab:request');
  if ('denied' in auth) return auth.denied;
  const parsed = labRequestSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const results = await Promise.allSettled(v.tests.map((t) => labService.create({ patientId: v.patientId, doctorId: v.doctorId, appointmentId: v.appointmentId ?? null, testCode: t.testCode, priority: v.priority, clinicalNotes: emptyToNull(v.clinicalNotes) })));
  const created = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  const failed = results.flatMap((r, i) => (r.status === 'rejected' ? [`${v.tests[i].testCode}: ${r.reason instanceof Error ? r.reason.message : 'failed'}`] : []));
  updateTag(CACHE_TAGS.labReports); revalidatePath('/laboratory'); revalidatePath(`/patients/${v.patientId}/lab`);
  if (!created.length) return { ok: false, message: failed[0] ?? 'Could not create the requests' };
  return success(failed.length ? `${created.length} requested, ${failed.length} failed` : `${created.length} lab test${created.length > 1 ? 's' : ''} requested`, { created, failed });
}

export async function setLabStatusAction(id: number, status: LabStatus): Promise<ActionState<LabRequest>> {
  const auth = await authorize('lab:process');
  if ('denied' in auth) return auth.denied;
  try { const r = await labService.setStatus(id, status); updateTag(CACHE_TAGS.labReports); revalidatePath('/laboratory'); revalidatePath(`/laboratory/${id}`); return success(`Status set to ${status.replace(/_/g, ' ').toLowerCase()}`, r); } catch (e) { return failure(e); }
}

/** Report entry (FormData + useActionState). Revalidates lab reports so patients immediately see the completed report. */
export async function createLabReportAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const auth = await authorize('lab:process');
  if ('denied' in auth) return auth.denied;
  const id = Number(str(fd, 'requestId'));
  const parsed = labReportSchema.safeParse({ resultSummary: str(fd, 'resultSummary'), resultDetails: str(fd, 'resultDetails'), referenceRange: str(fd, 'referenceRange'), abnormal: fd.get('abnormal') === 'on' });
  if (!parsed.success) return invalid(parsed.error);
  try {
    await labService.createReport(id, { resultSummary: parsed.data.resultSummary, resultDetails: emptyToNull(parsed.data.resultDetails), referenceRange: emptyToNull(parsed.data.referenceRange), abnormal: parsed.data.abnormal });
    updateTag(CACHE_TAGS.labReports); updateTag(CACHE_TAGS.records);
    revalidatePath('/laboratory'); revalidatePath(`/laboratory/${id}`);
    return success('Report saved');
  } catch (e) { return failure(e); }
}

export async function cancelLabRequestAction(id: number): Promise<ActionState> {
  const auth = await authorize('lab:request');
  if ('denied' in auth) return auth.denied;
  try { await labService.cancel(id); updateTag(CACHE_TAGS.labReports); revalidatePath('/laboratory'); revalidatePath(`/laboratory/${id}`); return success('Request cancelled'); } catch (e) { return failure(e); }
}
