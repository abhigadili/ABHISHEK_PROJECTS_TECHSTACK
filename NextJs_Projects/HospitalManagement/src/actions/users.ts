'use server';
import { revalidatePath } from 'next/cache';
import { authService } from '@/services/backend/auth';
import { authorize, failure, success, type ActionState } from '@/lib/actions/state';

export async function setUserEnabledAction(id: number, enabled: boolean): Promise<ActionState> {
  const auth = await authorize('users:manage');
  if ('denied' in auth) return auth.denied;
  if (auth.session.userId === id) return { ok: false, message: 'You cannot disable your own account' };
  try { await authService.setEnabled(id, enabled); revalidatePath('/admin/users'); return success(enabled ? 'Account enabled' : 'Account disabled'); } catch (e) { return failure(e); }
}
