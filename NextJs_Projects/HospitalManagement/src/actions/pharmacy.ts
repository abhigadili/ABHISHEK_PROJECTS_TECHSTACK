'use server';
import { revalidatePath, updateTag } from 'next/cache';
import { pharmacyService } from '@/services/backend/pharmacy';
import { authorize, failure, str, success, type ActionState } from '@/lib/actions/state';
import { CACHE_TAGS } from '@/constants/cache';
import { medicineSchema } from '@/schemas/pharmacy';
import { invalid } from '@/lib/actions/state';

function bust() { updateTag(CACHE_TAGS.pharmacy); revalidatePath('/pharmacy'); revalidatePath('/pharmacy/orders'); }

export async function dispenseOrderAction(id: number): Promise<ActionState> {
  const auth = await authorize('pharmacy:manage');
  if ('denied' in auth) return auth.denied;
  try { await pharmacyService.dispense(id); bust(); updateTag(CACHE_TAGS.prescriptions); return success('Order dispensed'); } catch (e) { return failure(e); }
}
export async function rejectOrderAction(id: number, _p: ActionState, fd: FormData): Promise<ActionState> {
  const auth = await authorize('pharmacy:manage');
  if ('denied' in auth) return auth.denied;
  const reason = str(fd, 'reason').trim();
  if (reason.length < 3) return { ok: false, message: 'Please give a reason', fieldErrors: { reason: 'Enter a reason (min 3 characters)' } };
  try { await pharmacyService.reject(id, reason); bust(); return success('Order rejected'); } catch (e) { return failure(e); }
}
export async function restockAction(id: number, quantity: number): Promise<ActionState> {
  const auth = await authorize('pharmacy:manage');
  if ('denied' in auth) return auth.denied;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000) return { ok: false, message: 'Quantity must be a whole number between 1 and 100000' };
  try { await pharmacyService.restock(id, quantity); bust(); return success(`Restocked +${quantity}`); } catch (e) { return failure(e); }
}
export async function createMedicineAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const auth = await authorize('pharmacy:manage');
  if ('denied' in auth) return auth.denied;
  const parsed = medicineSchema.safeParse(Object.fromEntries(['sku', 'name', 'genericName', 'unitPrice', 'stockQuantity', 'reorderLevel'].map((k) => [k, str(fd, k)])));
  if (!parsed.success) return invalid(parsed.error);
  try { await pharmacyService.createMedicine({ ...parsed.data, genericName: parsed.data.genericName || null }); bust(); return success('Medicine added'); } catch (e) { return failure(e); }
}
