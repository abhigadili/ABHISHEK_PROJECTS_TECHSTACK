'use client';
import { Undo2 } from 'lucide-react';
import { useState } from 'react';
import { SearchInput } from '@/components/pickers';
import { useToast } from '@/components/toast';
import { Alert, Button, Card, ConfirmDialog, DataTable, EmptyState, PageHeader, Select, TextInput } from '@/components/ui';
import { errMsg, useDebounced, usePaged } from '@/hooks/useApi';
import { api, qs } from '@/lib/api';
import { fmtDate, money } from '@/lib/format';
import type { Loan } from '@/lib/types';

export default function ReturnPage() {
  const toast = useToast(); const [q, setQ] = useState(''); const dq = useDebounced(q, 300);
  const { rows, loading, error, reload } = usePaged<Loan>(dq.trim().length >= 2 ? `/loans${qs({ status: 'active', q: dq, pageSize: 20 })}` : null);
  const [target, setTarget] = useState<Loan | null>(null); const [condition, setCondition] = useState('good'); const [charge, setCharge] = useState(''); const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ title: string; fines: { type: string; amount: number }[]; daysOverdue: number } | null>(null);
  const [scan, setScan] = useState(''); const [scanErr, setScanErr] = useState<string | null>(null);

  const doReturn = async (body: Record<string, unknown>, title: string) => {
    const r = await api.post<{ fines: { type: string; amount: number }[]; daysOverdue: number }>('/loans/return', body);
    setResult({ title, fines: r.fines, daysOverdue: r.daysOverdue }); toast.success(`Returned “${title}”`); reload();
  };
  const confirm = async () => { if (!target) return; setBusy(true); try { await doReturn({ loanId: target.id, condition, ...(condition === 'damaged' && charge ? { damageCharge: Number(charge) } : {}) }, target.bookTitle); setTarget(null); setCondition('good'); setCharge(''); } catch (e) { toast.error(errMsg(e)); setTarget(null); } finally { setBusy(false); } };
  const quick = async () => { setScanErr(null); setResult(null); try { await doReturn({ accessionNumber: scan.trim() }, scan.trim()); setScan(''); } catch (e) { setScanErr(errMsg(e)); } };
  return (
    <>
      <PageHeader title="Return books" subtitle="Scan an accession number for a quick return, or search the open loans to mark damaged or lost items." />
      <Card title="Quick return" className="mb-6"><form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); void quick(); }}><div className="w-72"><TextInput label="Accession number" value={scan} onChange={(e) => setScan(e.target.value)} placeholder="ACC-00003-1" autoFocus /></div><Button type="submit" disabled={!scan.trim()}><Undo2 className="h-4 w-4" />Return</Button></form>{scanErr && <div className="mt-3"><Alert>{scanErr}</Alert></div>}</Card>
      {result && <div className="mb-6"><Alert tone={result.fines.length ? 'amber' : 'green'}>Returned <strong>{result.title}</strong>.{result.daysOverdue > 0 && ` ${result.daysOverdue} day(s) overdue.`}{result.fines.length ? ` Fines added: ${result.fines.map((f) => `${f.type} ${money(f.amount)}`).join(', ')}.` : ' No fines.'}</Alert></div>}
      <Card title="Open loans" className="!p-0"><div className="space-y-3 p-4"><SearchInput value={q} onChange={setQ} placeholder="Member name / ID, book title or accession number (min. 2 characters)" label="Search open loans" /></div>
        <DataTable rows={rows} loading={loading} error={error} onRetry={reload} rowKey={(l) => l.id} empty={<EmptyState title={dq.trim().length < 2 ? 'Search for an open loan' : 'No open loans match'} />}
          columns={[{ header: 'Book', cell: (l) => <div className="font-medium">{l.bookTitle}<div className="font-mono text-xs font-normal text-slate-500">{l.accessionNumber}</div></div> }, { header: 'Member', cell: (l) => <div>{l.memberName}<div className="text-xs text-slate-500">{l.memberCode}</div></div> },
            { header: 'Due', cell: (l) => <span className={l.isOverdue ? 'font-semibold text-red-700' : ''}>{fmtDate(l.dueDate)}{l.isOverdue && ` (${l.daysLate}d late · est. ${money(l.estimatedFine)})`}</span> }, { header: '', cell: (l) => <Button size="sm" onClick={() => setTarget(l)}>Return…</Button> }]} /></Card>
      <ConfirmDialog open={!!target} title="Process return" confirmLabel="Confirm return" loading={busy} onConfirm={confirm} onCancel={() => setTarget(null)} message={<>Return <strong>{target?.bookTitle}</strong> from {target?.memberName}?{target?.isOverdue && <span className="mt-1 block text-red-700">Overdue by {target.daysLate} day(s): an overdue fine (about {money(target.estimatedFine)}) will be added.</span>}</>}>
        <Select label="Condition" value={condition} onChange={(e) => setCondition(e.target.value)}><option value="good">Good — back on the shelf</option><option value="damaged">Damaged — remove from circulation, add damage charge</option><option value="lost">Lost — add replacement charge</option></Select>
        {condition === 'damaged' && <TextInput label="Damage charge (blank = library default)" type="number" min={0} step="0.01" value={charge} onChange={(e) => setCharge(e.target.value)} />}
      </ConfirmDialog>
    </>
  );
}
