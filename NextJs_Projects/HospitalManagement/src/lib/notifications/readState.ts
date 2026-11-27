import 'server-only';
import { cookies } from 'next/headers';
import { readCookieName } from '@/lib/notifications/cookie';

/** Server-side read of the notification read-state cookie that markNotificationsReadAction writes. */
export async function getReadIds(userId: number): Promise<Set<number>> {
  try { return new Set<number>(JSON.parse((await cookies()).get(readCookieName(userId))?.value ?? '[]')); } catch { return new Set(); }
}
