'use server';
import { revalidatePath } from 'next/cache';
import { backend } from '@/lib/server/backend';
import { failure, parse } from '@/lib/server/action-utils';
import { requireUser } from '@/lib/server/session';
import { userUpdateSchema } from '@/validations/user';
import type { ActionResult, User } from '@/types';

/** Form-state action for `useActionState`: receives (previousState, FormData). */
export async function updateProfileAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const me = await requireUser(); // authorisation first: the id always comes from the session, never from the form
  const v = parse(userUpdateSchema, { name: formData.get('name'), mobile: formData.get('mobile') }); if (!v.ok) return v.result;
  try { await backend<User>(`/users/${me.id}`, { method: 'PUT', body: v.data }); } catch (e) { return failure(e); }
  revalidatePath('/account', 'layout'); // header name, dashboard greeting, profile form
  return { ok: true, message: 'Profile updated' };
}
