'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useToast } from '@/components/toast';
import { Alert, Button, Card, ConfirmDialog, DataTable, EmptyState, PageHeader, Pagination, StatusBadge, Tabs } from '@/components/ui';
import { errMsg, usePaged } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { fmtDate, fmtDateTime } from '@/lib/format';
import type { Reservation } from '@/lib/types';

export default function MyReservationsPage() {
  const toast = useToast(); const [tab, setTab] = useState('open'); const [page, setPage] = useState(1); const [target, setTarget] = useState<Reservation | null>(null); const [busy, setBusy] = useState(false);
  const { rows, meta, loading, error, reload } = usePaged<Reservation>(`/reservations/mine?status=${tab === 'open' ? 'open' : ''}&page=${page}`);
  const cancel = async () => { if (!target) return; setBusy(true); try { await api.post(`/reservations/${target.id}/cancel`); toast.success('Reservation cancelled'); setTarget(null); reload(); } catch (e) { toast.error(errMsg(e)); setTarget(null); } finally { setBusy(false); } };
  const hasReady = rows?.some((r) => r.status === 'ready');
  return (
    <>
      <PageHeader title="My reservations" subtitle="Reserve a book from its page when every copy is out." />
      <Tabs tabs={[{ key: 'open', label: 'Active' }, { key: 'all', label: 'All' }]} value={tab} onChange={(k) => { setTab(k); setPage(1); }} />
      {hasReady && <div className="mb-4"><Alert tone="green">A reserved book is ready for you. Collect it at the desk before the hold expires.</Alert></div>}
      <Card className="!p-0">
        <DataTable rows={rows} loading={loading} error={error} onRetry={reload} rowKey={(r) => r.id} empty={<EmptyState title="No reservations" description="When a book is unavailable you can reserve it from the book page." action={<Link href="/books"><Button variant="secondary">Browse books</Button></Link>} />}
          columns={[
            { header: 'Book', cell: (r) => <Link href={`/books/${r.bookId}`} className="font-medium text-brand-700 hover:underline">{r.bookTitle}</Link> },
            { header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
            { header: 'Queue / hold', cell: (r) => r.status === 'pending' ? `Position ${r.queuePosition}` : r.status === 'ready' ? `Collect by ${fmtDateTime(r.expiresAt)}` : '—' },
            { header: 'Reserved on', cell: (r) => fmtDate(r.createdAt) },
            { header: '', cell: (r) => ['pending', 'ready'].includes(r.status) ? <Button size="sm" variant="secondary" onClick={() => setTarget(r)}>Cancel</Button> : null },
          ]} />
        <Pagination meta={meta} onPage={setPage} />
      </Card>
      <ConfirmDialog open={!!target} danger title="Cancel reservation?" message={<>You will lose your place in the queue for <strong>{target?.bookTitle}</strong>.</>} confirmLabel="Cancel reservation" loading={busy} onConfirm={cancel} onCancel={() => setTarget(null)} />
    </>
  );
}
