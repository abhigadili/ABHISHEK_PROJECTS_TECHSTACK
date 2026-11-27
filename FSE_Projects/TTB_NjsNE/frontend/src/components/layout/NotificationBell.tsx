'use client';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Popover } from '@/components/ui/Popover';
import { useMarkAllReadMutation, useNotificationsQuery } from '@/store/api';
import { fmtDateTime } from '@/utils/format';

/** Notification bell powered by RTK Query (cache + tag invalidation), as a contrast to TanStack Query elsewhere. */
export function NotificationBell() {
  const { data, isLoading } = useNotificationsQuery(undefined, { pollingInterval: 60_000 }); const [markAll] = useMarkAllReadMutation();
  const list = data?.items ?? []; const unread = data?.unread ?? 0;
  return (
    <Popover trigger={<Button variant="ghost" size="icon" aria-label={`Notifications (${unread} unread)`} className="relative"><Bell size={20} />{unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] text-white">{unread}</span>}</Button>}>
      <div className="flex items-center justify-between border-b px-4 py-2"><span className="text-sm font-semibold">Notifications</span>{unread > 0 && <button className="text-xs text-indigo-600" onClick={() => markAll()}>Mark all read</button>}</div>
      <ul className="max-h-80 overflow-y-auto">
        {isLoading && <li className="p-4 text-sm text-slate-500">Loading…</li>}
        {!isLoading && list.length === 0 && <li className="p-4 text-sm text-slate-500">You&apos;re all caught up.</li>}
        {list.map((n) => <li key={n.id} className={`border-b px-4 py-2.5 text-sm last:border-0 ${n.readAt ? '' : 'bg-indigo-50/60 dark:bg-indigo-950/40'}`}><p className="font-medium">{n.title}</p><p className="text-slate-600 dark:text-slate-300">{n.message}</p><p className="mt-0.5 text-xs text-slate-400">{fmtDateTime(n.createdAt)}</p></li>)}
      </ul>
      <Link href="/account/notifications" className="block border-t px-4 py-2 text-center text-sm text-indigo-600">View all</Link>
    </Popover>
  );
}
