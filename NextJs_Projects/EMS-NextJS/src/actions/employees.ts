'use server';
import { redirect } from 'next/navigation';
import { revalidatePath, updateTag } from 'next/cache';
import * as emp from '@/lib/server/employees';
import { employeeFormSchema, jobChangeSchema } from '@/schemas/forms';
import { toEmployeePayload } from '@/lib/utils/employee-payload';
import { can } from '@/constants/roles';
import { checkFile, fail, formString, formStrings, secured, zodErrors, type ActionState } from './_shared';

/** After any employee change: department headcounts are part of a CACHED list (tag `departments`), so that tag is expired too. */
function invalidate(id?: number) {
  updateTag('departments');
  revalidatePath('/employees');
  revalidatePath('/dashboard');
  if (id) revalidatePath(`/employees/${id}`, 'layout');
}

/**
 * Called programmatically by the React Hook Form client component with the form values (JSON), because the form has dynamic field
 * arrays. The Server Action re-validates EVERYTHING with the same zod schema — client validation is only UX.
 */
export async function saveEmployeeAction(mode: 'create' | 'edit', id: number | null, valuesJson: string): Promise<ActionState> {
  return secured('employee:manage', async (user) => {
    let json: unknown;
    try { json = JSON.parse(valuesJson); } catch { return fail('Malformed request'); }
    const parsed = employeeFormSchema.safeParse(json);
    if (!parsed.success) return fail('Please fix the highlighted fields.', zodErrors(parsed.error.issues));
    const body = toEmployeePayload(parsed.data, mode, can(user.role, 'employee:view-compensation'));
    const saved = mode === 'create' ? await emp.createEmployee(body) : await emp.updateEmployee(id!, body);
    invalidate(saved.id);
    return { ok: true, message: mode === 'create' ? 'Employee created' : 'Employee updated', data: { id: saved.id } };
  });
}

/** Form action: <form action={toggleEmployeeStatusAction}> with hidden `id` + `active`. */
export async function toggleEmployeeStatusAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return secured('employee:manage', async () => {
    const id = Number(formString(fd, 'id'));
    if (formString(fd, 'active') === 'true') await emp.reactivateEmployee(id); else await emp.deactivateEmployee(id, 'Deactivated from EMS');
    invalidate(id);
    return { ok: true, message: formString(fd, 'active') === 'true' ? 'Employee reactivated' : 'Employee deactivated' };
  });
}

export async function jobChangeAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const raw = formStrings(fd, ['id', 'changeType', 'effectiveDate', 'designationId', 'departmentId', 'managerId', 'jobTitle', 'notes']);
  return secured('employee:manage', async () => {
    const parsed = jobChangeSchema.safeParse(raw);
    if (!parsed.success) return fail('Please fix the highlighted fields.', zodErrors(parsed.error.issues), raw);
    const v = parsed.data; const n = (s: string) => (s ? Number(s) : undefined);
    await emp.updateEmployee(Number(raw.id), { changeType: v.changeType, effectiveDate: v.effectiveDate, notes: v.notes || undefined, designationId: n(v.designationId), departmentId: n(v.departmentId), managerId: n(v.managerId), jobTitle: v.jobTitle || undefined });
    invalidate(Number(raw.id));
    return { ok: true, message: 'Job change recorded' };
  }, raw);
}

export async function uploadPictureAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return secured(undefined, async (user) => {
    const id = Number(formString(fd, 'id'));
    const { file, error } = checkFile(fd.get('file'), ['image/jpeg', 'image/png', 'image/webp']);
    if (error || !file) return fail(error ?? 'Choose an image first');
    const body = new FormData(); body.append('file', file, file.name);
    if (id === user.employeeId) await emp.putMyPicture(body); // self-service endpoint
    else if (can(user.role, 'employee:manage')) await emp.putPicture(id, body);
    else return fail('You do not have permission to change this picture');
    revalidatePath(`/employees/${id}`, 'layout');
    return { ok: true, message: 'Profile picture updated' };
  });
}

export async function createEmployeeAndRedirect(valuesJson: string): Promise<ActionState> {
  const r = await saveEmployeeAction('create', null, valuesJson);
  if (r.ok && r.data?.id) redirect(`/employees/${r.data.id}`);
  return r;
}
