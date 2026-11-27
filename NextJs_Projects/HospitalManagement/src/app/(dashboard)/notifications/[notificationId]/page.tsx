import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth/session';
import { notificationService } from '@/services/backend/notifications';
import { load, parseId } from '@/lib/api/guards';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { MarkReadOnView } from '@/features/notifications/NotificationActions';
import { can } from '@/constants/permissions';
import { formatDateTime } from '@/lib/utilities/format';

export const metadata = { title: 'Notification', robots: { index: false } };
/** ADMIN may read any message by id; everyone else can only open messages addressed to them (found in their own list - the backend exposes no by-id route for them). */
export default async function NotificationPage({ params }: PageProps<'/notifications/[notificationId]'>) {
  const s = await requireSession();
  const id = parseId((await params).notificationId);
  const n = can(s.role, 'notifications:admin') ? await load(notificationService.get(id)) : (await load(notificationService.my({ size: 100 }))).content.find((x) => x.id === id);
  if (!n) notFound();
  return <><PageHeader title={n.subject} actions={<Link className="text-sm text-primary hover:underline" href="/notifications">← All notifications</Link>} /><MarkReadOnView id={n.id} /><Card className="max-w-2xl"><CardHeader><CardTitle>{n.eventType.replace(/_/g, ' ').toLowerCase()}</CardTitle><StatusBadge status={n.status} /></CardHeader><CardBody className="space-y-3 text-sm"><p className="whitespace-pre-wrap">{n.message}</p><p className="text-muted">To {n.recipientEmail} via {n.channel.toLowerCase()} · created {formatDateTime(n.createdAt)}{n.sentAt ? ` · sent ${formatDateTime(n.sentAt)}` : ''}</p></CardBody></Card></>;
}
