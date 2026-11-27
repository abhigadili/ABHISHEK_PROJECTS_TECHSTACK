'use server';
import { redirect } from 'next/navigation';
import { revalidatePath, updateTag } from 'next/cache';
import * as dep from '@/lib/server/departments';
import { departmentSchemaForm, designationSchemaForm } from '@/schemas/forms';
import { fail, formString, formStrings, secured, zodErrors, type ActionState } from './_shared';

const toId = (s: string) => (/^\d+$/.test(s) ? Number(s) : null);

/** `updateTag` = read-your-own-writes: the cached `departments` list expires immediately, so the redirect target shows the new row. */
export async function saveDepartmentAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const raw = formStrings(fd, ['id', 'code', 'name', 'description', 'headEmployeeId']);
  raw.code = raw.code.toUpperCase(); // normalise BEFORE validating: "ops" is accepted as OPS instead of failing the A-Z rule
  return secured('department:manage', async () => {
    const parsed = departmentSchemaForm.safeParse(raw);
    if (!parsed.success) return fail('Please fix the highlighted fields.', zodErrors(parsed.error.issues), raw);
    const body = { code: parsed.data.code, name: parsed.data.name, description: parsed.data.description || undefined, headEmployeeId: toId(parsed.data.headEmployeeId) };
    const saved = raw.id ? await dep.updateDepartment(Number(raw.id), body) : await dep.createDepartment({ ...body, headEmployeeId: body.headEmployeeId ?? undefined });
    updateTag('departments');
    revalidatePath('/departments');
    redirect(`/departments/${saved.id}`);
  }, raw);
}

export async function setDepartmentStatusAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return secured('department:manage', async () => {
    const active = formString(fd, 'active') === 'true';
    await dep.setDepartmentActive(Number(formString(fd, 'id')), active);
    updateTag('departments');
    revalidatePath('/departments');
    return { ok: true, message: active ? 'Department activated' : 'Department deactivated' };
  });
}

export async function saveDesignationAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const raw = formStrings(fd, ['id', 'name', 'description', 'jobLevel']);
  return secured('designation:manage', async () => {
    const parsed = designationSchemaForm.safeParse(raw);
    if (!parsed.success) return fail('Please fix the highlighted fields.', zodErrors(parsed.error.issues), raw);
    const body = { name: parsed.data.name, description: parsed.data.description || undefined, jobLevel: Number(parsed.data.jobLevel) };
    if (raw.id) await dep.updateDesignation(Number(raw.id), body); else await dep.createDesignation(body);
    updateTag('designations');
    revalidatePath('/designations');
    return { ok: true, message: raw.id ? 'Designation updated' : 'Designation created' };
  }, raw);
}

export async function setDesignationActiveAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return secured('designation:manage', async () => {
    await dep.updateDesignation(Number(formString(fd, 'id')), { isActive: formString(fd, 'active') === 'true' });
    updateTag('designations');
    revalidatePath('/designations');
    return { ok: true, message: 'Designation updated' };
  });
}
