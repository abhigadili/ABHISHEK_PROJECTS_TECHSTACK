'use client';
import Link from 'next/link';
import { useState } from 'react';
import { SearchInput } from '@/components/pickers';
import { useToast } from '@/components/toast';
import { Button, Card, ConfirmDialog, DataTable, EmptyState, PageHeader, Pagination, StatusBadge, Tabs } from '@/components/ui';
import { errMsg, useDebounced, usePaged } from '@/hooks/useApi';
import { api, qs } from '@/lib/api';
import { fmtDate, fmtDateTime } from '@/lib/format';
import type { Reservation } from '@/lib/types';

export default function StaffReservationsPage() {
  const toast = useToast(); const [tab, setTab] = useState('open'); const [q, setQ] = useState(''); const dq = useDebounced(q); const [page, setPage] = useState(1);
  const [target, setTarget] = useState<Reservation | null>(null); const [busy, setBusy] = useState(false);
  const { rows, meta, loading, error, reload } = usePaged<Reservation>(`/reservations${qs({ status: tab === 'all' ? '' : tab, q: dq, page })}`);
  const cancel = async () => { if (!target) return; setBusy(true); try { await api.post(`/reservations/${target.id}/cancel`); toast.success('Reservation cancelled'); setTarget(null); reload(); } catch (e) { toast.error(errMsg(e)); setTarget(null); } finally { setBusy(false); } };
  return (
    <>
      <PageHeader title="Reservations" subtitle="Queue of members waiting for a book. Ready = a copy is held at the desk." />
      <Tabs tabs={[{ key: 'open', label: 'Open' }, { key: 'ready', label: 'Ready for pickup' }, { key: 'pending', label: 'Waiting' }, { key: 'fulfilled', label: 'Fulfilled' }, { key: 'expired', label: 'Expired' }, { key: 'all', label: 'All' }]} value={tab} onChange={(k) => { setTab(k); setPage(1); }} />
      <Card className="!p-0"><div className="p-4"><SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Member, member ID or title" label="Search reservations" /></div>
        <DataTable rows={rows} loading={loading} error={error} onRetry={reload} rowKey={(r) => r.id} empty={<EmptyState title="No reservations" />}
          columns={[{ header: 'Book', cell: (r) => <Link className="font-medium text-brand-700 hover:underline" href={`/staff/books/${r.bookId}`}>{r.bookTitle}</Link> }, { header: 'Member', cell: (r) => <div><Link className="hover:underline" href={`/staff/members/${r.userId}`}>{r.memberName}</Link><div className="text-xs text-slate-500">{r.memberCode}</div></div> },
            { header: 'Status', cell: (r) => <StatusBadge status={r.status} /> }, { header: 'Queue / hold', cell: (r) => r.status === 'pending' ? `#${r.queuePosition}` : r.status === 'ready' ? <span>Copy {r.heldCopy}<div className="text-xs text-slate-500">until {fmtDateTime(r.expiresAt)}</div></span> : '—' }, { header: 'Placed', cell: (r) => fmtDate(r.createdAt) },
            { header: '', cell: (r) => <div className="flex gap-2">{r.status === 'ready' && <Link href={`/staff/issue`}><Button size="sm">Issue…</Button></Link>}{['pending', 'ready'].includes(r.status) && <Button size="sm" variant="secondary" onClick={() => setTarget(r)}>Cancel</Button>}</div> }]} />
        <Pagination meta={meta} onPage={setPage} /></Card>
      <ConfirmDialog open={!!target} danger title="Cancel reservation?" message={<>Cancel the reservation of <strong>{target?.bookTitle}</strong> for {target?.memberName}? A held copy passes to the next member in the queue.</>} confirmLabel="Cancel reservation" loading={busy} onConfirm={cancel} onCancel={() => setTarget(null)} />
    </>
  );
}
