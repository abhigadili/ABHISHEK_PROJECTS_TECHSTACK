import Link from 'next/link';
import { Bell } from 'lucide-react';
import { requireUser } from '@/server/auth/guard';
import { notificationService } from '@/server/services/notification.service';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { MarkAllRead, MarkRead } from './NotificationButtons';
import { fmtDateTime } from '@/lib/utilities/format';
import { cn } from '@/lib/utilities/cn';
/** Server Component shared by every role's notifications page (history, read/unread, preferences link). */
export async function NotificationsView({ searchParams, basePath }: { searchParams: Record<string, string | string[] | undefined>; basePath: string }) {
  const p = await requireUser(); const page = Math.max(0, Number(searchParams.page ?? 0) || 0); const unreadOnly = searchParams.filter === 'unread';
  const r = await notificationService.list(p, { unread: unreadOnly, page, size: 15 });
  return (<>
    <PageHeader title="Notifications" description={`${r.unread} unread · history of your in-app notifications.`} actions={<><Link className="rounded-lg border border-line px-3 py-2 text-sm hover:bg-surface2" href={unreadOnly ? basePath : `${basePath}?filter=unread`}>{unreadOnly ? 'Show all' : 'Unread only'}</Link><MarkAllRead /><Link className="rounded-lg border border-line px-3 py-2 text-sm hover:bg-surface2" href="/account#preferences">Preferences</Link></>} />
    {r.items.length === 0 ? <EmptyState title="No notifications" /> : <ul className="space-y-2">{r.items.map((n) => <li key={n.id}><Card className={cn(!n.readAt && 'border-primary/50 bg-primary/5')}><CardBody className="flex items-start gap-3 py-3"><Bell className="mt-0.5 size-4 text-primary" /><div className="min-w-0 flex-1"><p className={cn('text-sm', !n.readAt && 'font-semibold')}>{n.link ? <Link className="hover:underline" href={n.link}>{n.title}</Link> : n.title}</p><p className="text-sm text-muted">{n.message}</p><time className="num text-xs text-muted">{fmtDateTime(n.createdAt)}{n.emailSent ? ' · e-mailed' : ''}</time></div>{!n.readAt && <MarkRead id={n.id} />}</CardBody></Card></li>)}</ul>}
    <Pagination page={page} size={15} total={r.total} basePath={basePath} params={{ filter: unreadOnly ? 'unread' : undefined }} />
  </>);
}
