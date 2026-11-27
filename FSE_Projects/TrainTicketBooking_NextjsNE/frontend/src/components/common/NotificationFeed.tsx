'use client';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Bell, Check } from 'lucide-react';
import { useOptimistic, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState } from '@/components/ui/Feedback';
import { markAllReadAction, markReadAction } from '@/features/notifications/actions';
import { notificationApi } from '@/services/booking-api';
import type { NotificationItem, Paged } from '@/types';
import { fmtDateTime } from '@/utils/format';
import { useQueryClient } from '@tanstack/react-query';
import { useAppDispatch } from '@/store';
import { catalogApi } from '@/store/api';

/**
 * Page 0 is rendered on the server and handed in as `initial` (instant first paint, no client waterfall);
 * "Load more" continues with an INFINITE QUERY through the BFF. Marking as read is optimistic (`useOptimistic`) and runs a Server Action.
 */
export function NotificationFeed({ initial }: { initial: Paged<NotificationItem> }) {
  const q = useInfiniteQuery({ queryKey: ['notifications'], initialPageParam: 0, initialData: { pages: [initial], pageParams: [0] }, staleTime: 30_000,
    queryFn: ({ pageParam, signal }) => notificationApi.feed(pageParam, 10, signal), getNextPageParam: (last) => (last.meta.page + 1 < last.meta.totalPages ? last.meta.page + 1 : undefined) });
  const items = q.data.pages.flatMap((p) => p.data);
  const [view, markOptimistic] = useOptimistic(items, (cur, id: number | 'all') => cur.map((n) => (id === 'all' || n.id === id ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n)));
  const [, start] = useTransition(); const qc = useQueryClient(); const dispatch = useAppDispatch();
  const mark = (id: number | 'all') => start(async () => { markOptimistic(id); await (id === 'all' ? markAllReadAction() : markReadAction(id)); await qc.invalidateQueries({ queryKey: ['notifications'] }); dispatch(catalogApi.util.invalidateTags(['Notification'])); });
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!view.length) return <EmptyState title="Nothing yet" hint="Updates about your trips will show up here." />;
  const unread = view.some((n) => !n.readAt);
  return (
    <div className="space-y-3">
      {unread && <div className="flex justify-end"><Button size="sm" variant="outline" onClick={() => mark('all')}>Mark all as read</Button></div>}
      <Card className="divide-y divide-slate-100 dark:divide-slate-800">{view.map((n) => (
        <div key={n.id} className={`flex items-start gap-3 p-4 ${n.readAt ? '' : 'bg-indigo-50/50 dark:bg-indigo-950/30'}`}><Bell size={18} className={n.readAt ? 'text-slate-400' : 'text-indigo-600'} />
          <div className="min-w-0 flex-1"><p className="font-medium">{n.title}</p><p className="text-sm text-slate-600 dark:text-slate-300">{n.message}</p><p className="mt-1 text-xs text-slate-400">{fmtDateTime(n.createdAt)}</p></div>
          {!n.readAt && <Button size="sm" variant="ghost" onClick={() => mark(n.id)}><Check size={14} />Mark read</Button>}</div>))}</Card>
      {q.hasNextPage && <div className="text-center"><Button variant="outline" loading={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>Load more</Button></div>}
    </div>
  );
}
