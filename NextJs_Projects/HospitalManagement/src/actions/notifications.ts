'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { notificationService } from '@/services/backend/notifications';
import { authorize, failure, invalid, str, success, type ActionState } from '@/lib/actions/state';

import { readCookieName } from '@/lib/notifications/cookie';

/**
 * Notification status update. The backend keeps no read-flag, so the read state is stored in a small non-sensitive cookie
 * (list of notification ids) written by this Server Action - readable by Server Components (SSR) and the client bell alike.
 */
export async function markNotificationsReadAction(ids: number[]): Promise<ActionState<{ read: number[] }>> {
  const auth = await authorize(null);
  if ('denied' in auth) return auth.denied;
  const clean = ids.filter((n) => Number.isInteger(n) && n > 0).slice(0, 200);
  const jar = await cookies();
  const name = readCookieName(auth.session.userId);
  let current: number[] = [];
  try { current = JSON.parse(jar.get(name)?.value ?? '[]'); } catch { /* reset */ }
  const merged = [...new Set([...current, ...clean])].slice(-300);
  jar.set(name, JSON.stringify(merged), { path: '/', maxAge: 365 * 24 * 3600, sameSite: 'lax', httpOnly: false });
  revalidatePath('/notifications');
  return success('Marked as read', { read: merged });
}

export async function sendNotificationAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const auth = await authorize('notifications:admin');
  if ('denied' in auth) return auth.denied;
  const parsed = z.object({ recipientEmail: z.string().trim().email('Enter a valid e-mail'), subject: z.string().trim().min(1, 'Subject is required').max(150), message: z.string().trim().min(1, 'Message is required').max(2000) }).safeParse({ recipientEmail: str(fd, 'recipientEmail'), subject: str(fd, 'subject'), message: str(fd, 'message') });
  if (!parsed.success) return invalid(parsed.error);
  try { await notificationService.send(parsed.data); revalidatePath('/notifications'); return success('Notification sent'); } catch (e) { return failure(e); }
}
