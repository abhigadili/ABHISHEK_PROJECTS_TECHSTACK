'use server';
import { revalidatePath } from 'next/cache';
import { backend } from '@/lib/server/backend';
import { failure } from '@/lib/server/action-utils';
import { requireUser } from '@/lib/server/session';
import type { ActionResult } from '@/types';

export async function markReadAction(id: number): Promise<ActionResult> {
  await requireUser();
  try { await backend(`/notifications/${id}/read`, { method: 'PATCH' }); revalidatePath('/account/notifications'); return { ok: true }; } catch (e) { return failure(e); }
}
export async function markAllReadAction(): Promise<ActionResult> {
  await requireUser();
  try { await backend('/notifications/read-all', { method: 'PATCH' }); revalidatePath('/account', 'layout'); return { ok: true }; } catch (e) { return failure(e); }
}
