import { memo, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellRing, CalendarClock, CheckCheck, FileText, FlaskConical, Mail, Receipt, Send } from 'lucide-react';
import { useNotificationPage } from '../hooks/useNotifications';
import { SendNotificationDialog } from '../components/SendNotificationDialog';
import { notificationCategory, useNotificationCenter } from '@/contexts/NotificationsContext';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { QueryBoundary } from '@/components/common/QueryBoundary';
import { Pagination } from '@/components/common/Pagination';
import { Notice } from '@/components/common/Notice';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/utils/cn';
import { useUrlState } from '@/hooks/useUrlState';
import { useCan } from '@/contexts/AuthContext';
import { formatDateTime } from '@/utils/format';
import type { AppNotification } from '@/types';

const CATS = ['All', 'Appointment', 'Lab', 'Billing', 'Prescription', 'Other'] as const;
const ICON = { Appointment: CalendarClock, Lab: FlaskConical, Billing: Receipt, Prescription: FileText, Other: Mail } as const;

/** Memoised notification row: re-renders only when its notification or read state changes. */
const Row = memo(function Row({ n, read, onOpen }: { n: AppNotification; read: boolean; onOpen: (n: AppNotification) => void }) {
  const Icon = ICON[notificationCategory(n.eventType)];
  return (
    <li>
      <button type="button" onClick={() => onOpen(n)} className={cn('flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-black/[0.03] dark:hover:bg-white/5', !read && 'bg-brand-50/60 dark:bg-brand-900/10')}>
        <span className={cn('mt-0.5 rounded-full p-2', read ? 'bg-surface-alt text-muted' : 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300')}><Icon className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1"><span className={cn('block truncate text-sm', !read && 'font-semibold')}>{n.subject}</span><span className="line-clamp-2 text-sm text-muted">{n.message}</span><span className="mt-0.5 block text-xs text-muted">{formatDateTime(n.createdAt)} · {n.channel.toLowerCase()} · {n.status.toLowerCase()}</span></span>
        {!read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-label="Unread" />}
      </button>
    </li>
  );
});

/**
 * Notification list / history / unread view (Tailwind). The page query is server-paged; the read/unread state comes from the
 * NotificationsContext (the backend has no read flag, see Notice). `unreadOnly` renders the "Unread notifications" page.
 */
export default function NotificationListPage({ unreadOnly = false }: { unreadOnly?: boolean }) {
  const navigate = useNavigate();
  const { scope, isRead, markRead, markAllRead, unreadCount, refresh } = useNotificationCenter();
  const canSend = useCan('notifications:admin');
  const [f, setF] = useUrlState(['cat', 'page', 'q'] as const);
  const [sendOpen, setSendOpen] = useState(false);
  const page = Number(f.page) || 0;
  const cat = (CATS.includes(f.cat as never) ? f.cat : 'All') as (typeof CATS)[number];
  const query = useNotificationPage(scope, page);

  const rows = useMemo(() => (query.data?.content ?? []).filter((n) => (cat === 'All' || notificationCategory(n.eventType) === cat) && (!unreadOnly || !isRead(n.id)) && (!f.q || `${n.subject} ${n.message}`.toLowerCase().includes(f.q.toLowerCase()))), [query.data, cat, unreadOnly, isRead, f.q]);
  const open = useCallback((n: AppNotification) => { markRead(n.id); navigate(`/notifications/${n.id}`, { state: { notification: n } }); }, [markRead, navigate]);

  return (
    <>
      <PageHeader title={unreadOnly ? 'Unread notifications' : 'Notifications'} subtitle={scope === 'all' ? 'Every message sent by the system' : 'Messages sent to your e-mail address'} icon={<Bell className="h-5 w-5" />}
        actions={<><Button variant="outline" onClick={() => navigate(unreadOnly ? '/notifications' : '/notifications/unread')}><BellRing className="h-4 w-4" /> {unreadOnly ? 'All notifications' : `Unread (${unreadCount})`}</Button><Button variant="outline" onClick={markAllRead} disabled={unreadCount === 0}><CheckCheck className="h-4 w-4" /> Mark all read</Button>{canSend && <Button onClick={() => setSendOpen(true)}><Send className="h-4 w-4" /> Send message</Button>}</>} />
      <div className="mb-3"><Notice>Read/unread status is remembered in this browser only - the Notification Service stores no read flag. New messages are checked every 30 seconds (polling); the service offers no push channel.</Notice></div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <SearchInput value={f.q} onSearch={(q) => setF({ q })} placeholder="Search messages…" />
        <div className="inline-flex flex-wrap rounded-lg bg-surface-alt p-1" role="tablist" aria-label="Category">{CATS.map((c) => <button key={c} role="tab" aria-selected={cat === c} onClick={() => setF({ cat: c === 'All' ? '' : c })} className={cn('rounded-md px-3 py-1.5 text-sm font-medium', cat === c ? 'bg-surface shadow' : 'text-muted')}>{c}</button>)}</div>
        <Button variant="ghost" size="sm" onClick={refresh}>Refresh</Button>
      </div>
      <QueryBoundary query={query} isEmpty={() => rows.length === 0} emptyTitle={unreadOnly ? 'You are all caught up' : 'No notifications'} emptyDescription={unreadOnly ? 'No unread messages on this page.' : 'Messages appear after appointments, lab reports, prescriptions or billing events.'}>
        {() => (
          <>
            <Card className="overflow-hidden"><ul className="divide-y divide-[var(--hms-border)]" aria-label="Notifications">{rows.map((n) => <Row key={n.id} n={n} read={isRead(n.id)} onOpen={open} />)}</ul></Card>
            <Pagination page={query.data?.page ?? 0} totalPages={query.data?.totalPages ?? 0} totalElements={query.data?.totalElements} onPageChange={(p) => setF({ page: p }, { keepPage: true })} disabled={query.isFetching} label="notifications" />
          </>
        )}
      </QueryBoundary>
      {sendOpen && <SendNotificationDialog onClose={() => setSendOpen(false)} />}
    </>
  );
}
