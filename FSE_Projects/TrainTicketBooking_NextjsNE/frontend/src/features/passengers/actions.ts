'use server';
import { revalidatePath } from 'next/cache';
import { backend } from '@/lib/server/backend';
import { failure, parse } from '@/lib/server/action-utils';
import { requireUser } from '@/lib/server/session';
import { passengerSchema } from '@/validations/booking';
import type { ActionResult } from '@/types';

export async function savePassengerAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = Number(fd.get('id') || 0);
  const v = parse(passengerSchema, { name: fd.get('name'), age: fd.get('age'), gender: fd.get('gender'), mobile: fd.get('mobile') || '' }); if (!v.ok) return v.result;
  try { await backend(id ? `/passengers/${id}` : '/passengers', { method: id ? 'PUT' : 'POST', body: v.data }); } catch (e) { return failure(e); }
  revalidatePath('/account/passengers'); return { ok: true, message: id ? 'Passenger updated' : 'Passenger saved' };
}
export async function deletePassengerAction(id: number): Promise<ActionResult> {
  await requireUser();
  try { await backend(`/passengers/${id}`, { method: 'DELETE' }); revalidatePath('/account/passengers'); return { ok: true }; } catch (e) { return failure(e); }
}
