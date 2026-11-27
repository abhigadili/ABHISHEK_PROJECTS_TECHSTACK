import { requireSession } from '@/lib/auth/session';
import { notificationService } from '@/services/backend/notifications';
import { load } from '@/lib/api/guards';
import { getReadIds } from '@/lib/notifications/readState';
import { PageHeader } from '@/components/common/PageHeader';
import { NotificationList } from '@/features/notifications/NotificationList';
import { MarkReadButton } from '@/features/notifications/NotificationActions';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata = { title: 'Unread notifications', robots: { index: false } };
export default async function Unread() {
  const s = await requireSession();
  const [all, read] = await Promise.all([load(notificationService.my({ size: 100 })), getReadIds(s.userId)]);
  const items = all.content.filter((n) => !read.has(n.id));
  return <><PageHeader title="Unread notifications" description={`${items.length} unread of the latest ${all.content.length}.`} actions={items.length > 0 && <MarkReadButton all ids={items.map((n) => n.id)} label="Mark all as read" />} />{items.length === 0 ? <EmptyState title="You are all caught up" /> : <NotificationList items={items} read={read} />}</>;
}
