'use client';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Button, ConfirmDialog, DataTable, EmptyState, StatusBadge, type Column } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDate, fmtDateTime, money } from '@/lib/format';
import type { Loan } from '@/lib/types';
import { errMsg } from '@/hooks/useApi';
import { useToast } from '@/components/toast';

/** Loans table with a Renew action (members renew their own loans; the API enforces policy). */
export function LoanTable({ rows, loading, error, reload, canRenew = true, showMember = false, history = false }: { rows?: Loan[]; loading?: boolean; error?: string | null; reload: () => void; canRenew?: boolean; showMember?: boolean; history?: boolean }) {
  const toast = useToast(); const [target, setTarget] = useState<Loan | null>(null); const [busy, setBusy] = useState(false);
  const renew = async () => {
    if (!target) return; setBusy(true);
    try { const l = await api.post<Loan>(`/loans/${target.id}/renew`); toast.success(`Renewed. New due date: ${fmtDate(l.dueDate)}`); setTarget(null); reload(); }
    catch (e) { toast.error(errMsg(e)); setTarget(null); } finally { setBusy(false); }
  };
  const cols: Column<Loan>[] = [
    { header: 'Book', cell: (l) => <div><Link href={`/books/${l.bookId}`} className="font-medium text-brand-700 hover:underline">{l.bookTitle}</Link><div className="text-xs text-slate-500">{l.authors}</div></div> },
    ...(showMember ? [{ header: 'Member', cell: (l: Loan) => <div><Link className="hover:underline" href={`/staff/members/${l.userId}`}>{l.memberName}</Link><div className="text-xs text-slate-500">{l.memberCode}</div></div> }] : []),
    { header: 'Copy', cell: (l) => <span className="font-mono text-xs">{l.accessionNumber}</span> },
    { header: 'Issued', cell: (l) => fmtDate(l.issuedAt) },
    { header: history ? 'Due / returned' : 'Due', cell: (l) => <div className={l.isOverdue ? 'font-semibold text-red-700' : ''}>{fmtDate(l.dueDate)}{l.returnedAt && <div className="text-xs font-normal text-slate-500">returned {fmtDateTime(l.returnedAt)}</div>}{l.isOverdue && <div className="text-xs">{l.daysLate} day(s) late{l.estimatedFine > 0 ? ` · est. fine ${money(l.estimatedFine)}` : ''}</div>}</div> },
    { header: 'Renewals', cell: (l) => l.renewalCount },
    { header: 'Status', cell: (l) => <StatusBadge status={l.displayStatus} /> },
    ...(canRenew ? [{ header: '', cell: (l: Loan) => l.status === 'active' ? <Button size="sm" variant="secondary" onClick={() => setTarget(l)}><RefreshCw className="h-3.5 w-3.5" />Renew</Button> : null }] : []),
  ];
  return (
    <>
      <DataTable columns={cols} rows={rows} loading={loading} error={error} onRetry={reload} rowKey={(l) => l.id} empty={<EmptyState title={history ? 'No borrowing history yet' : 'No books on loan'} description={history ? undefined : 'Browse the catalogue and ask at the desk to borrow something.'} action={history ? undefined : <Link href="/books"><Button variant="secondary">Browse books</Button></Link>} />} />
      <ConfirmDialog open={!!target} title="Renew this loan?" message={<>Renew <strong>{target?.bookTitle}</strong>? The due date moves forward according to the membership policy.</>} confirmLabel="Renew" loading={busy} onConfirm={renew} onCancel={() => setTarget(null)} />
    </>
  );
}
