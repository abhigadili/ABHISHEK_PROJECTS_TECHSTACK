'use client';
import { Plus, Upload } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Availability } from '@/components/book';
import { SearchInput } from '@/components/pickers';
import { Button, Card, DataTable, EmptyState, PageHeader, Pagination } from '@/components/ui';
import { useDebounced, usePaged } from '@/hooks/useApi';
import { qs } from '@/lib/api';
import type { Book } from '@/lib/types';

export default function StaffBooksPage() {
  const [q, setQ] = useState(''); const dq = useDebounced(q); const [status, setStatus] = useState('active'); const [availability, setAvail] = useState(''); const [page, setPage] = useState(1);
  const { rows, meta, loading, error, reload } = usePaged<Book>(`/books${qs({ q: dq, status, availability, page, pageSize: 15, sort: 'title' })}`);
  return (
    <>
      <PageHeader title="Books & copies" subtitle="Manage the catalogue and physical inventory." actions={<><Link href="/staff/books/import"><Button variant="secondary"><Upload className="h-4 w-4" />Import CSV</Button></Link><Link href="/staff/books/new"><Button><Plus className="h-4 w-4" />Add book</Button></Link></>} />
      <Card className="!p-0">
        <div className="grid gap-3 p-4 sm:grid-cols-[1fr_160px_180px]"><SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Title, author, ISBN, publisher or category" label="Search books" />
          <select aria-label="Status" className="input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="active">Active</option><option value="archived">Archived</option><option value="all">All</option></select>
          <select aria-label="Availability" className="input" value={availability} onChange={(e) => { setAvail(e.target.value); setPage(1); }}><option value="">Any availability</option><option value="available">Available</option><option value="unavailable">No copy available</option></select></div>
        <DataTable rows={rows} loading={loading} error={error} onRetry={reload} rowKey={(b) => b.id} empty={<EmptyState title="No books found" description="Try a different search, or add a new book." />}
          columns={[{ header: 'Title', cell: (b) => <div><Link href={`/staff/books/${b.id}`} className="font-medium text-brand-700 hover:underline">{b.title}</Link><div className="text-xs text-slate-500">{b.authors}</div></div> }, { header: 'ISBN', cell: (b) => <span className="font-mono text-xs">{b.isbn13 ?? b.isbn10 ?? '—'}</span> },
            { header: 'Category', cell: (b) => <span className="text-xs">{b.categories ?? '—'}</span> }, { header: 'Shelf', cell: (b) => b.location ?? '—' }, { header: 'Copies', cell: (b) => <span className="text-xs">{b.availableCopies} in / {b.borrowedCopies} out / {b.reservedCopies} held / {b.totalCopies} total</span> }, { header: 'Availability', cell: (b) => <Availability book={b} compact /> }]} />
        <Pagination meta={meta} onPage={setPage} />
      </Card>
    </>
  );
}
