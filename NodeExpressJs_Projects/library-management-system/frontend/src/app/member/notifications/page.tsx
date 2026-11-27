'use client';
import { Bell, CheckCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useToast } from '@/components/toast';
import { Button, Card, EmptyState, ErrorState, PageHeader, Pagination, TableSkeleton, Tabs } from '@/components/ui';
import { errMsg, usePaged } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import type { Notification } from '@/lib/types';

export default function NotificationsPage() {
  const toast = useToast(); const [tab, setTab] = useState('all'); const [page, setPage] = useState(1);
  const { rows, meta, loading, error, reload } = usePaged<Notification>(`/notifications?page=${page}${tab === 'unread' ? '&unread=1' : ''}`);
  const markAll = async () => { try { await api.post('/notifications/read-all'); toast.success('All marked as read'); reload(); } catch (e) { toast.error(errMsg(e)); } };
  const markOne = async (n: Notification) => { if (!n.isRead) { try { await api.post(`/notifications/${n.id}/read`); reload(); } catch { /* non-fatal */ } } };
  return (
    <>
      <PageHeader title="Notifications" actions={<Button variant="secondary" onClick={markAll} disabled={!(meta as any)?.unread}><CheckCheck className="h-4 w-4" />Mark all as read</Button>} />
      <Tabs tabs={[{ key: 'all', label: 'All' }, { key: 'unread', label: 'Unread', count: (meta as any)?.unread }]} value={tab} onChange={(k) => { setTab(k); setPage(1); }} />
      <Card className="!p-0">
        {error ? <ErrorState message={error} onRetry={reload} /> : loading && !rows ? <TableSkeleton cols={2} /> : rows && rows.length ? (
          <ul className="divide-y divide-slate-100">{rows.map((n) => (
            <li key={n.id} className={`flex items-start gap-3 px-5 py-3 ${n.isRead ? '' : 'bg-brand-50/50'}`}>
              <Bell className={`mt-1 h-4 w-4 shrink-0 ${n.isRead ? 'text-slate-300' : 'text-brand-600'}`} aria-hidden />
              <div className="min-w-0 flex-1"><p className={`text-sm ${n.isRead ? '' : 'font-semibold'}`}>{n.title}</p><p className="text-sm text-slate-600">{n.message}</p><p className="mt-0.5 text-xs text-slate-400">{fmtDateTime(n.createdAt)}</p></div>
              <div className="flex shrink-0 gap-2">{n.link && <Link href={n.link} onClick={() => markOne(n)}><Button size="sm" variant="secondary">Open</Button></Link>}{!n.isRead && <Button size="sm" variant="ghost" onClick={() => markOne(n)}>Mark read</Button>}</div>
            </li>))}</ul>
        ) : <EmptyState title={tab === 'unread' ? 'No unread notifications' : 'No notifications yet'} />}
        <Pagination meta={meta} onPage={setPage} />
      </Card>
    </>
  );
}
