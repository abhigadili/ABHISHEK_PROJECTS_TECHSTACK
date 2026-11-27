import { Bell, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui/Feedback';
import { useDocumentTitle } from '@/hooks';
import { useMarkRead, useNotificationFeed } from '@/services/queries';
import { fmtDateTime } from '@/utils/format';

/** Infinite query ("Load more") + optimistic "mark as read" */
export default function Notifications() {
  useDocumentTitle('Notifications'); const q = useNotificationFeed(); const mark = useMarkRead();
  const items = q.data?.pages.flatMap((p) => p.data) ?? [];
  return (
    <div><PageHeader title="Notifications" subtitle="Booking, payment, refund and schedule updates" />
      {q.isLoading ? <Skeleton className="h-32" /> : q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : items.length === 0 ? <EmptyState title="Nothing yet" hint="Updates about your trips will show up here." /> : (
        <Card className="divide-y divide-slate-100">{items.map((n) => (
          <div key={n.id} className={`flex items-start gap-3 p-4 ${n.readAt ? '' : 'bg-indigo-50/50'}`}><Bell size={18} className={n.readAt ? 'text-slate-400' : 'text-indigo-600'} />
            <div className="min-w-0 flex-1"><p className="font-medium">{n.title}</p><p className="text-sm text-slate-600">{n.message}</p><p className="mt-1 text-xs text-slate-400">{fmtDateTime(n.createdAt)}</p></div>
            {!n.readAt && <Button size="sm" variant="ghost" onClick={() => mark.mutate(n.id)}><Check size={14} />Mark read</Button>}</div>))}</Card>)}
      {q.hasNextPage && <div className="mt-4 text-center"><Button variant="outline" loading={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>Load more</Button></div>}
    </div>
  );
}
