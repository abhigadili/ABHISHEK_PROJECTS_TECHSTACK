import type { Metadata } from 'next';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { requireSession } from '@/lib/auth/session';
import { notificationService } from '@/services/backend/notifications';
import { load } from '@/lib/api/guards';
import { getReadIds } from '@/lib/notifications/readState';
import { readCookieName } from '@/lib/notifications/cookie';
import { PageHeader } from '@/components/common/PageHeader';
import { NotificationList } from '@/features/notifications/NotificationList';
import { SendNotificationForm } from '@/features/notifications/NotificationActions';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { can } from '@/constants/permissions';

export const metadata: Metadata = { title: 'Notifications', robots: { index: false } };
export default async function NotificationsPage({ searchParams }: PageProps<'/notifications'>) {
  const s = await requireSession();
  const page = Math.max(0, Number((await searchParams).page ?? 0) || 0);
  const mine = await load(notificationService.my({ page, size: 15 }));
  const read = await getReadIds(s.userId);

  /** INLINE Server Action (defined inside a Server Component): "mark everything on this page as read". Closes over `ids`, runs on the server. */
  const ids = mine.content.map((n) => n.id);
  async function markPageRead() {
    'use server';
    const jar = await cookies();
    const name = readCookieName(s.userId);
    let cur: number[] = []; try { cur = JSON.parse(jar.get(name)?.value ?? '[]'); } catch { /* reset */ }
    jar.set(name, JSON.stringify([...new Set([...cur, ...ids])].slice(-300)), { path: '/', maxAge: 365 * 24 * 3600, sameSite: 'lax' });
    revalidatePath('/notifications');
  }
  const unread = mine.content.filter((n) => !read.has(n.id)).length;
  return (
    <>
      <PageHeader title="Notifications" description={`${unread} unread on this page · messages sent to ${s.email || 'your e-mail'}.`} actions={<><Button asChild variant="outline"><Link href="/notifications/unread">Unread only</Link></Button><form action={markPageRead}><Button type="submit" variant="outline" size="md">Mark page as read</Button></form></>} />
      {can(s.role, 'notifications:admin') && <div className="mb-6"><SendNotificationForm /></div>}
      {mine.content.length === 0 ? <EmptyState title="No notifications yet" description="Booking, billing, laboratory and prescription events arrive here." /> : <NotificationList items={mine.content} read={read} />}
      <Pagination page={mine.page} totalPages={mine.totalPages} total={mine.totalElements} basePath="/notifications" />
    </>
  );
}
