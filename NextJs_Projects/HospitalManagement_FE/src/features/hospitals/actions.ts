'use server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { hospitalService } from '@/server/services/hospital.service';
import { run } from '@/server/http/action';
import { TAGS } from '@/lib/constants/cache';

const bust = () => { revalidateTag(TAGS.hospitals, 'max'); revalidateTag(TAGS.departments, 'max'); revalidatePath('/hospitals'); revalidatePath('/hospitals/[slug]', 'page'); revalidatePath('/departments'); revalidatePath('/admin/hospital'); revalidatePath('/superadmin/hospitals'); };
export async function saveHospitalAction(id: number | null, values: unknown) { const r = await run((p) => (id ? hospitalService.update(p, id, values) : hospitalService.create(p, values)), id ? 'Hospital updated' : 'Hospital created'); if (r.ok) bust(); return { ok: r.ok, message: r.message, fieldErrors: r.fieldErrors }; }
export async function addDepartmentAction(hospitalId: number, values: unknown) { const r = await run((p) => hospitalService.addDepartment(p, hospitalId, values), 'Department added'); if (r.ok) bust(); return { ok: r.ok, message: r.message, fieldErrors: r.fieldErrors }; }
export async function removeDepartmentAction(id: number) { const r = await run((p) => hospitalService.removeDepartment(p, id), 'Department removed'); if (r.ok) bust(); return { ok: r.ok, message: r.message }; }
export async function deleteHospitalAction(id: number) { const r = await run((p) => hospitalService.remove(p, id), 'Hospital removed'); if (r.ok) bust(); return { ok: r.ok, message: r.message }; }
