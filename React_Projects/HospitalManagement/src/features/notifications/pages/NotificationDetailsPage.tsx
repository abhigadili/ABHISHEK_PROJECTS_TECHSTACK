import { useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { useNotificationById } from '../hooks/useNotifications';
import { notificationCategory, useNotificationCenter } from '@/contexts/NotificationsContext';
import { PageHeader } from '@/components/common/PageHeader';
import { DetailList } from '@/components/common/DetailList';
import { EmptyState } from '@/components/common/EmptyState';
import { QueryBoundary } from '@/components/common/QueryBoundary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateTime } from '@/utils/format';
import type { AppNotification } from '@/types';

const LINKS: Record<string, (ref: string) => string> = { Appointment: (r) => `/appointments/${r}`, Lab: (r) => `/lab/requests/${r}`, Prescription: (r) => `/prescriptions/${r}`, Billing: (r) => `/billing/invoices/${r}` };

/** Details: ADMIN reads GET /notifications/{id}; other roles can only list their own messages, so the item comes from the router state / feed. */
export default function NotificationDetailsPage() {
  const id = Number(useParams().notificationId);
  const { role } = useAuth();
  const { items, markRead } = useNotificationCenter();
  const stateItem = (useLocation().state as { notification?: AppNotification } | null)?.notification;
  const local = stateItem?.id === id ? stateItem : items.find((n) => n.id === id);
  const admin = role === 'ADMIN';
  const query = useNotificationById(id, admin && !local);
  useEffect(() => { markRead(id); }, [id, markRead]);

  const view = (n: AppNotification) => {
    const cat = notificationCategory(n.eventType);
    const link = n.referenceId && LINKS[cat] && cat !== 'Billing' ? LINKS[cat]!(n.referenceId) : undefined;
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <PageHeader title={n.subject} subtitle={formatDateTime(n.createdAt)} icon={<Mail className="h-5 w-5" />} actions={<Badge variant={n.status === 'SENT' ? 'success' : n.status === 'FAILED' ? 'danger' : 'warning'}>{n.status.toLowerCase()}</Badge>} />
        <Card className="space-y-5 p-5"><p className="whitespace-pre-line text-sm">{n.message}</p>
          <DetailList columns={3} items={[{ label: 'Category', value: cat }, { label: 'Event', value: n.eventType }, { label: 'Channel', value: n.channel }, { label: 'Recipient', value: n.recipientEmail }, { label: 'Reference', value: n.referenceId }, { label: 'Delivered', value: formatDateTime(n.sentAt) }]} /></Card>
        <div className="flex gap-2">{link && <Button asChild><Link to={link}>Open related {cat.toLowerCase()}</Link></Button>}<Button variant="outline" asChild><Link to="/notifications">Back to notifications</Link></Button></div>
      </div>
    );
  };
  if (local) return view(local);
  if (admin) return <QueryBoundary query={query} isEmpty={() => false}>{view}</QueryBoundary>;
  return <EmptyState title="Notification not in your recent messages" description="Only your 50 most recent messages are kept in memory. Open it from the notification list." action={<Button asChild variant="outline"><Link to="/notifications">Back to notifications</Link></Button>} />;
}
