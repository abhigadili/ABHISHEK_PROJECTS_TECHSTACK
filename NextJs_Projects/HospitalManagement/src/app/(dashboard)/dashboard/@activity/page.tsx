import Link from 'next/link';
import { Bell, CalendarDays, ReceiptText } from 'lucide-react';
import { requireSession } from '@/lib/auth/session';
import { getRecentActivity, getUnreadPreview } from '@/lib/dashboard/metrics';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDateTime } from '@/lib/utilities/format';

const icon = { notification: Bell, bill: ReceiptText, appointment: CalendarDays };
export default async function Activity() {
  const s = await requireSession();
  const items = s.role === 'PATIENT' ? [] : await getRecentActivity(s.role);
  const mine = s.role === 'PATIENT' ? await getUnreadPreview() : null;
  const rows = s.role === 'PATIENT' ? (mine?.content ?? []).map((n) => ({ id: `n${n.id}`, at: n.createdAt, kind: 'notification' as const, title: n.subject, detail: n.eventType.replace(/_/g, ' ').toLowerCase(), href: `/notifications/${n.id}` })) : items;
  return (
    <Card><CardHeader><CardTitle>{s.role === 'PATIENT' ? 'Latest notifications' : 'Recent activity'}</CardTitle><Link href="/notifications" className="text-sm text-primary hover:underline">Notifications</Link></CardHeader>
      <CardBody>{rows.length === 0 ? <EmptyState title="Nothing yet" description="Activity appears here as appointments, bills and notifications are created." /> : (
        <ul className="divide-y divide-line">{rows.map((r) => { const I = icon[r.kind]; return <li key={r.id} className="flex gap-3 py-3"><I className="mt-0.5 size-4 shrink-0 text-primary" /><div className="min-w-0 flex-1"><Link href={r.href ?? '#'} className="block truncate text-sm font-medium hover:underline">{r.title}</Link><p className="truncate text-xs text-muted">{r.detail}</p></div><time className="num text-xs whitespace-nowrap text-muted">{formatDateTime(r.at)}</time></li>; })}</ul>
      )}</CardBody></Card>
  );
}
