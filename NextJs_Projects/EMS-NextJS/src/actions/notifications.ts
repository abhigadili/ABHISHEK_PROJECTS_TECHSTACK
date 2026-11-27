'use server';
import { revalidatePath } from 'next/cache';
import * as n from '@/lib/server/notifications';
import { formString, secured, type ActionState } from './_shared';

/** Mark one notification (hidden `id`) or ALL (no id) as read. */
export async function markReadAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return secured(undefined, async () => {
    const id = Number(formString(fd, 'id'));
    await n.markRead(Number.isInteger(id) && id > 0 ? [id] : undefined);
    revalidatePath('/notifications');
    return { ok: true, message: id ? 'Marked as read' : 'All notifications marked as read' };
  });
}
