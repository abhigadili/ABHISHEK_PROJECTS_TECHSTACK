'use client';
import { Archive, ArchiveRestore, Plus, Printer, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { BookForm } from '@/components/BookForm';
import { Availability } from '@/components/book';
import { useToast } from '@/components/toast';
import { Badge, Button, Card, ConfirmDialog, DataTable, EmptyState, ErrorState, Modal, PageHeader, Select, Skeleton, StatusBadge, Tabs, TextInput } from '@/components/ui';
import { errMsg, useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate } from '@/lib/format';
import type { Book } from '@/lib/types';

interface Copy { id: number; accessionNumber: string; status: string; shelfLocation: string | null; conditionNotes: string | null; acquiredOn: string | null; loanId: number | null; borrower: string | null; dueDate: string | null; timesLoaned: number }
const clean = (b: Record<string, unknown>) => Object.fromEntries(Object.entries(b).filter(([, v]) => v !== undefined));

export default function ManageBookPage() {
  const { id } = useParams<{ id: string }>(); const router = useRouter(); const toast = useToast(); const { user } = useAuth();
  const { data: book, error, reload } = useApi<Book>(`/books/${id}`);
  const { data: copies, reload: reloadCopies, loading: cLoading, error: cError } = useApi<Copy[]>(`/books/${id}/copies`);
  const [tab, setTab] = useState('copies'); const [addOpen, setAddOpen] = useState(false); const [count, setCount] = useState('1'); const [acc, setAcc] = useState(''); const [shelf, setShelf] = useState('');
  const [busy, setBusy] = useState(false); const [confirm, setConfirm] = useState<'archive' | 'delete' | null>(null); const [edit, setEdit] = useState<Copy | null>(null); const [status, setStatus] = useState(''); const [notes, setNotes] = useState('');
  const refresh = () => { reload(); reloadCopies(); };
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!book) return <Skeleton className="h-64" />;

  const addCopies = async () => { setBusy(true); try { await api.post(`/books/${id}/copies`, { count: Number(count), accessionNumber: acc || undefined, shelfLocation: shelf || null }); toast.success('Copies added'); setAddOpen(false); setAcc(''); refresh(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); } };
  const saveCopy = async () => { if (!edit) return; setBusy(true); try { await api.patch(`/copies/${edit.id}`, { status: status || undefined, conditionNotes: notes || null }); toast.success('Copy updated'); setEdit(null); refresh(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); } };
  const deleteCopy = async (c: Copy) => { try { await api.del(`/copies/${c.id}`); toast.success('Copy deleted'); refresh(); } catch (e) { toast.error(errMsg(e)); } };
  const doConfirm = async () => { setBusy(true); try { if (confirm === 'archive') { await api.post(`/books/${id}/archive`); toast.success('Book archived'); refresh(); } else { await api.del(`/books/${id}`); toast.success('Book deleted'); router.push('/staff/books'); } setConfirm(null); } catch (e) { toast.error(errMsg(e)); setConfirm(null); } finally { setBusy(false); } };
  return (
    <>
      <PageHeader title={book.title} subtitle={`${book.authors ?? ''}${book.isbn13 ? ` · ISBN ${book.isbn13}` : ''}`}
        actions={<><Availability book={book} /><Link href={`/books/${book.id}`}><Button variant="secondary">Public page</Button></Link><Button variant="ghost" onClick={() => window.print()}><Printer className="h-4 w-4" />Print</Button>
          {book.status === 'active' ? <Button variant="secondary" onClick={() => setConfirm('archive')}><Archive className="h-4 w-4" />Archive</Button> : <Button variant="secondary" onClick={async () => { await api.post(`/books/${id}/restore`); toast.success('Book restored'); refresh(); }}><ArchiveRestore className="h-4 w-4" />Restore</Button>}
          {user?.role === 'admin' && <Button variant="danger" onClick={() => setConfirm('delete')}><Trash2 className="h-4 w-4" />Delete</Button>}</>} />
      <Tabs tabs={[{ key: 'copies', label: 'Physical copies', count: copies?.length }, { key: 'edit', label: 'Edit details' }]} value={tab} onChange={setTab} />
      {tab === 'copies' ? (
        <Card className="!p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 p-4"><p className="text-sm text-slate-600">{book.totalCopies} counted · {book.availableCopies} available · {book.borrowedCopies} on loan · {book.reservedCopies} held · {book.damagedCopies} damaged · {book.lostCopies} lost</p><Button size="sm" onClick={() => setAddOpen(true)} disabled={book.status !== 'active'}><Plus className="h-4 w-4" />Add copies</Button></div>
          <DataTable rows={copies} loading={cLoading} error={cError} onRetry={reloadCopies} rowKey={(c) => c.id} empty={<EmptyState title="No physical copies" description="Add copies so members can borrow this book." />}
            columns={[{ header: 'Accession no.', cell: (c) => <span className="font-mono text-xs">{c.accessionNumber}</span> }, { header: 'Status', cell: (c) => <StatusBadge status={c.status} /> }, { header: 'Shelf', cell: (c) => c.shelfLocation ?? '—' },
              { header: 'Borrower / due', cell: (c) => c.borrower ? <span>{c.borrower}<span className="block text-xs text-slate-500">due {fmtDate(c.dueDate)}</span></span> : '—' }, { header: 'Loans', cell: (c) => c.timesLoaned }, { header: 'Notes', cell: (c) => c.conditionNotes ?? '—' },
              { header: '', cell: (c) => <div className="flex gap-2"><Button size="sm" variant="secondary" disabled={c.status === 'on_loan'} onClick={() => { setEdit(c); setStatus(c.status); setNotes(c.conditionNotes ?? ''); }}>Edit</Button>{c.timesLoaned === 0 && c.status !== 'on_loan' && <Button size="sm" variant="ghost" onClick={() => deleteCopy(c)} aria-label={`Delete copy ${c.accessionNumber}`}><Trash2 className="h-3.5 w-3.5" /></Button>}</div> }]} />
        </Card>
      ) : <BookForm book={book} submitLabel="Save changes" onSubmit={async (b) => { await api.put(`/books/${id}`, clean(b)); toast.success('Book updated'); refresh(); }} />}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add copies" footer={<><Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button><Button loading={busy} onClick={addCopies}>Add</Button></>}>
        <div className="space-y-3"><TextInput label="Number of copies" type="number" min={1} max={100} value={count} onChange={(e) => setCount(e.target.value)} /><TextInput label="Accession number (optional, single copy only)" value={acc} onChange={(e) => setAcc(e.target.value)} disabled={Number(count) !== 1} hint="Blank = generated automatically." /><TextInput label="Shelf location" value={shelf} onChange={(e) => setShelf(e.target.value)} /></div></Modal>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={`Copy ${edit?.accessionNumber ?? ''}`} footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button loading={busy} onClick={saveCopy}>Save</Button></>}>
        <div className="space-y-3"><Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>{edit?.status === 'held' && <option value="held" disabled>held (for a reservation)</option>}<option value="available">available</option><option value="damaged">damaged</option><option value="lost">lost</option><option value="withdrawn">withdrawn</option></Select><TextInput label="Condition notes" value={notes} onChange={(e) => setNotes(e.target.value)} />{edit?.status === 'held' && <Badge tone="purple">Changing status releases the held reservation back to the queue.</Badge>}</div></Modal>
      <ConfirmDialog open={!!confirm} danger title={confirm === 'delete' ? 'Delete this book?' : 'Archive this book?'} confirmLabel={confirm === 'delete' ? 'Delete permanently' : 'Archive'} loading={busy} onConfirm={doConfirm} onCancel={() => setConfirm(null)}
        message={confirm === 'delete' ? 'Only books without any circulation history can be deleted; otherwise archive instead. This cannot be undone.' : 'Archived books are hidden from members and cannot be issued. Books with active loans or reservations cannot be archived.'} />
    </>
  );
}
