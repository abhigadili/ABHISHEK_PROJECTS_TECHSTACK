'use client';
import { Check, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useToast } from '@/components/toast';
import { Button, Card, DataTable, EmptyState, PageHeader, Pagination, Tabs } from '@/components/ui';
import { errMsg, usePaged } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';

interface R { id: number; rating: number; comment: string | null; status: string; createdAt: string; author: string; bookTitle: string; bookId: number }
export default function ReviewsPage() {
  const toast = useToast(); const [tab, setTab] = useState('pending'); const [page, setPage] = useState(1);
  const { rows, meta, loading, error, reload } = usePaged<R>(`/reviews?status=${tab}&page=${page}`);
  const act = async (id: number, status: 'approved' | 'rejected') => { try { await api.post(`/reviews/${id}/moderate`, { status }); toast.success(`Review ${status}`); reload(); } catch (e) { toast.error(errMsg(e)); } };
  const del = async (id: number) => { try { await api.del(`/reviews/${id}`); toast.success('Review deleted'); reload(); } catch (e) { toast.error(errMsg(e)); } };
  return (
    <>
      <PageHeader title="Review moderation" subtitle="Reviews wait here when moderation is switched on in the library settings." />
      <Tabs tabs={[{ key: 'pending', label: 'Pending' }, { key: 'approved', label: 'Approved' }, { key: 'rejected', label: 'Rejected' }]} value={tab} onChange={(k) => { setTab(k); setPage(1); }} />
      <Card className="!p-0"><DataTable rows={rows} loading={loading} error={error} onRetry={reload} rowKey={(r) => r.id} empty={<EmptyState title={`No ${tab} reviews`} />}
        columns={[{ header: 'Book', cell: (r) => <Link className="font-medium text-brand-700 hover:underline" href={`/books/${r.bookId}`}>{r.bookTitle}</Link> }, { header: 'Reader', cell: (r) => r.author }, { header: 'Rating', cell: (r) => `${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}` }, { header: 'Comment', cell: (r) => <span className="line-clamp-2 max-w-md">{r.comment ?? '—'}</span> }, { header: 'Date', cell: (r) => fmtDate(r.createdAt) },
          { header: '', cell: (r) => <div className="flex gap-2">{r.status !== 'approved' && <Button size="sm" variant="success" onClick={() => act(r.id, 'approved')}><Check className="h-3.5 w-3.5" />Approve</Button>}{r.status !== 'rejected' && <Button size="sm" variant="secondary" onClick={() => act(r.id, 'rejected')}><X className="h-3.5 w-3.5" />Reject</Button>}<Button size="sm" variant="ghost" onClick={() => del(r.id)}>Delete</Button></div> }]} />
        <Pagination meta={meta} onPage={setPage} /></Card>
    </>
  );
}
