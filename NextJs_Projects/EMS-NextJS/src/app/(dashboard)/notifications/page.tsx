import { Suspense } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { listNotifications } from '@/lib/server/notifications';
import { Pagination } from '@/components/common/Pagination';
import { Card, EmptyState, PageHeader, Skeleton, buttonClass } from '@/components/common/ui';
import { MarkRead } from '@/features/notifications/MarkRead';
import { formatDateTime } from '@/lib/utils/format';
import { int, one, type RawSearchParams } from '@/lib/utils/search-params';

export const metadata: Metadata = { title: 'Notifications' };
async function Body({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const sp = await searchParams;
  const unreadOnly = one(sp.filter) === 'unread';
  const { items, meta } = await listNotifications({ page: int(sp.page, 1), limit: 15, unread: unreadOnly || undefined });
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2"><Link href="/notifications" className={buttonClass(unreadOnly ? 'secondary' : 'primary')}>All</Link><Link href="/notifications?filter=unread" className={buttonClass(unreadOnly ? 'primary' : 'secondary')}>Unread</Link><MarkRead label="Mark all as read" /></div>
      {items.length === 0 ? <EmptyState title={unreadOnly ? 'No unread notifications' : 'No notifications yet'} /> : (
        <><ul className="space-y-2">{items.map((n) => <li key={n.id}><Card className={n.isRead ? 'opacity-70' : 'border-primary/40'}><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{n.title}{!n.isRead && <span className="ml-2 rounded bg-primary px-1.5 py-0.5 text-[10px] text-white">NEW</span>}</p><p className="text-sm">{n.message}</p><p className="text-xs text-muted">{formatDateTime(n.createdAt)}</p></div>{!n.isRead && <MarkRead id={n.id} label="Mark read" />}</div></Card></li>)}</ul>
          <Pagination base="/notifications" meta={meta} params={sp} /></>)}
    </>
  );
}
export default function Page({ searchParams }: PageProps<'/notifications'>) { return <><PageHeader title="Notifications" /><Suspense fallback={<Skeleton className="h-64" />}><Body searchParams={searchParams} /></Suspense></>; }
