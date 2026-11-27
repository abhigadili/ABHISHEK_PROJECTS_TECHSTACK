'use server';
import { revalidatePath, revalidateTag, updateTag } from 'next/cache';
import { hospitalService } from '@/services/backend/hospitals';
import { authorize, failure, str, success, type ActionState } from '@/lib/actions/state';
import { validateDepartment, validateHospital, type HospitalFormValues } from '@/schemas/hospital';
import { CACHE_TAGS } from '@/constants/cache';
import type { Hospital } from '@/types';

function bust(id?: number) {
  updateTag(CACHE_TAGS.hospitals); updateTag(CACHE_TAGS.departments);
  revalidateTag(CACHE_TAGS.hospitals, 'max'); revalidateTag(CACHE_TAGS.departments, 'max'); // ISR (public pages) entries
  revalidatePath('/hospitals'); revalidatePath('/public/hospitals');
  if (id) { revalidatePath(`/hospitals/${id}`); revalidatePath(`/public/hospitals/${id}`); }
}

export async function saveHospitalAction(id: number | null, _p: ActionState<Hospital>, fd: FormData): Promise<ActionState<Hospital>> {
  const auth = await authorize('hospitals:manage');
  if ('denied' in auth) return auth.denied;
  const v: HospitalFormValues = { name: str(fd, 'name'), code: str(fd, 'code'), address: str(fd, 'address'), city: str(fd, 'city'), phone: str(fd, 'phone'), email: str(fd, 'email') };
  const errors = validateHospital(v);
  if (Object.keys(errors).length) return { ok: false, message: 'Please fix the highlighted fields', fieldErrors: errors as Record<string, string> };
  try {
    const body = { name: v.name.trim(), code: v.code.trim(), address: v.address.trim() || undefined, city: v.city.trim() || undefined, phone: v.phone.trim() || undefined, email: v.email.trim() || undefined };
    const h = id ? await hospitalService.update(id, body) : await hospitalService.create(body);
    bust(h.id);
    return success(id ? 'Hospital updated' : 'Hospital created', h);
  } catch (e) { return failure(e); }
}

export async function createDepartmentAction(hospitalId: number, _p: ActionState, fd: FormData): Promise<ActionState> {
  const auth = await authorize('hospitals:manage');
  if ('denied' in auth) return auth.denied;
  const name = str(fd, 'name'), description = str(fd, 'description');
  const errors = validateDepartment(name, description);
  if (Object.keys(errors).length) return { ok: false, message: 'Please fix the highlighted fields', fieldErrors: errors as Record<string, string> };
  try { await hospitalService.createDepartment(hospitalId, { name: name.trim(), description: description.trim() || undefined }); bust(hospitalId); return success('Department added'); } catch (e) { return failure(e); }
}

export async function deleteDepartmentAction(hospitalId: number, id: number): Promise<ActionState> {
  const auth = await authorize('hospitals:manage');
  if ('denied' in auth) return auth.denied;
  try { await hospitalService.deleteDepartment(id); bust(hospitalId); return success('Department removed'); } catch (e) { return failure(e); }
}
