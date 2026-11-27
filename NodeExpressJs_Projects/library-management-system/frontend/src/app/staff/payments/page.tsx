'use client';
import Link from 'next/link';
import { Printer, Undo2 } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { MemberPicker, SearchInput, type MemberLite } from '@/components/pickers';
import { useToast } from '@/components/toast';
import { Alert, Button, Card, ConfirmDialog, DataTable, EmptyState, PageHeader, Pagination, Select, StatusBadge, TextArea, TextInput } from '@/components/ui';
import { errMsg, useApi, useDebounced, usePaged } from '@/hooks/useApi';
import { api, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate, fmtDateTime, money, titleCase } from '@/lib/format';
import type { Fine, Payment } from '@/lib/types';

function Payments() {
  const sp = useSearchParams(); const toast = useToast(); const { user } = useAuth();
  const [member, setMember] = useState<MemberLite | null>(null); const [amount, setAmount] = useState(''); const [method, setMethod] = useState('cash'); const [reference, setReference] = useState(''); const [notes, setNotes] = useState('');
  const [selected, setSelected] = useState<number[]>([]); const [busy, setBusy] = useState(false); const [formErr, setFormErr] = useState<string | null>(null); const [last, setLast] = useState<{ id: number; receipt: string; remaining: number } | null>(null); const [confirm, setConfirm] = useState(false);
  const pre = sp.get('memberId'); const { data: preMember } = useApi<MemberLite>(pre ? `/members/${pre}` : null);
  useEffect(() => { if (preMember && !member) setMember(preMember); }, [preMember]); // eslint-disable-line react-hooks/exhaustive-deps
  const fines = usePaged<Fine>(member ? `/fines?memberId=${member.id}&status=unpaid&pageSize=100` : null);
  const due = fines.rows?.reduce((a, f) => a + f.outstanding, 0) ?? 0; const chosen = fines.rows?.filter((f) => selected.includes(f.id)).reduce((a, f) => a + f.outstanding, 0) ?? 0; const target = selected.length ? chosen : due;
  useEffect(() => { setSelected([]); setAmount(''); }, [member?.id]);
  const pay = async () => { setBusy(true); setFormErr(null); try { const p = await api.post<Payment & { remainingBalance: number }>('/payments', { memberId: member!.id, amount: Number(amount || target), method, reference: reference || null, notes: notes || null, fineIds: selected.length ? selected : undefined }); setLast({ id: p.id, receipt: p.receiptNumber, remaining: p.remainingBalance }); toast.success('Payment recorded'); setConfirm(false); setAmount(''); setReference(''); setNotes(''); setSelected([]); fines.reload(); hist.reload(); } catch (e) { setFormErr(errMsg(e)); setConfirm(false); } finally { setBusy(false); } };

  const [q, setQ] = useState(''); const dq = useDebounced(q); const [page, setPage] = useState(1);
  const hist = usePaged<Payment>(`/payments${qs({ q: dq, page })}`);
  const [refund, setRefund] = useState<Payment | null>(null); const [rReason, setRReason] = useState('');
  const doRefund = async () => { if (!refund) return; setBusy(true); try { await api.post(`/payments/${refund.id}/refund`, { reason: rReason }); toast.success('Payment reversed'); setRefund(null); setRReason(''); hist.reload(); fines.reload(); } catch (e) { toast.error(errMsg(e)); setRefund(null); } finally { setBusy(false); } };
  const amt = Number(amount || target);
  return (
    <>
      <PageHeader title="Payments" subtitle="Record cash, card-terminal or other payments against a member’s fines. Partial payments are supported; no card details are stored." />
      <Card title="Record a payment" className="mb-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4"><MemberPicker value={member} onChange={(m) => { setMember(m); setLast(null); setFormErr(null); }} />
            {member && (<div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><TextInput label={`Amount (balance ${money(target)})`} type="number" min={0.01} step="0.01" max={target} value={amount} placeholder={target.toFixed(2)} onChange={(e) => setAmount(e.target.value)} /><Select label="Method" value={method} onChange={(e) => setMethod(e.target.value)}>{['cash', 'card', 'online', 'cheque', 'other'].map((m) => <option key={m} value={m}>{titleCase(m)}</option>)}</Select></div>
              <TextInput label="Reference (optional)" value={reference} onChange={(e) => setReference(e.target.value)} hint="Terminal slip or transaction id. Never enter card numbers." /><TextArea label="Notes (optional)" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              {formErr && <Alert>{formErr}</Alert>}<Button disabled={!(amt > 0) || amt > target + 0.001} onClick={() => setConfirm(true)}>Record payment of {money(amt || 0)}</Button></div>)}
            {last && <Alert tone="green">Payment recorded — receipt <b>{last.receipt}</b>. Remaining balance {money(last.remaining)}. <Link className="underline" target="_blank" href={`/receipt/${last.id}`}>Print receipt</Link></Alert>}
          </div>
          <div>{member ? <><p className="mb-2 text-sm font-medium">Unpaid fines <span className="font-normal text-slate-500">(tick to pay specific ones; otherwise oldest first)</span></p>
            {fines.rows && fines.rows.length ? <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">{fines.rows.map((f) => <li key={f.id} className="flex items-center gap-3 px-3 py-2 text-sm"><input type="checkbox" aria-label={`Select fine ${f.id}`} className="rounded border-slate-300" checked={selected.includes(f.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, f.id] : selected.filter((x) => x !== f.id))} /><span className="flex-1">{titleCase(f.fineType)} · {f.reason}<span className="block text-xs text-slate-500">{fmtDate(f.createdAt)}</span></span><b>{money(f.outstanding)}</b></li>)}</ul> : <p className="rounded-lg bg-emerald-50 px-3 py-4 text-sm text-emerald-800">{fines.loading ? 'Loading…' : 'This member has no unpaid fines.'}</p>}</> : <EmptyState title="Choose a member" description="Search above to see their unpaid fines." />}</div>
        </div>
      </Card>
      <Card title="Payment history" className="!p-0"><div className="p-4"><SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Member, member ID, receipt number or reference" label="Search payments" /></div>
        <DataTable rows={hist.rows} loading={hist.loading} error={hist.error} onRetry={hist.reload} rowKey={(p) => p.id} empty={<EmptyState title="No payments yet" />}
          columns={[{ header: 'Date', cell: (p) => fmtDateTime(p.createdAt) }, { header: 'Receipt', cell: (p) => <span className="font-mono text-xs">{p.receiptNumber}</span> }, { header: 'Member', cell: (p) => <span>{p.memberName}<span className="block text-xs text-slate-500">{p.memberCode}</span></span> }, { header: 'Type', cell: (p) => <span className="flex items-center gap-1"><StatusBadge status={p.kind} />{p.isRefunded && <StatusBadge status="cancelled" />}</span> },
            { header: 'Method', cell: (p) => titleCase(p.method) }, { header: 'Amount', cell: (p) => <b>{p.kind === 'refund' ? '−' : ''}{money(p.amount)}</b> }, { header: 'Received by', cell: (p) => p.receivedBy ?? '—' },
            { header: '', cell: (p) => <div className="flex gap-2"><Link href={`/receipt/${p.id}`} target="_blank"><Button size="sm" variant="secondary" aria-label={`Print receipt ${p.receiptNumber}`}><Printer className="h-3.5 w-3.5" /></Button></Link>{user?.role === 'admin' && p.kind === 'payment' && !p.isRefunded && <Button size="sm" variant="ghost" onClick={() => setRefund(p)}><Undo2 className="h-3.5 w-3.5" />Reverse</Button>}</div> }]} />
        <Pagination meta={hist.meta} onPage={setPage} /></Card>
      <ConfirmDialog open={confirm} title="Record this payment?" confirmLabel="Record payment" loading={busy} onConfirm={pay} onCancel={() => setConfirm(false)} message={<>Record <b>{money(amt || 0)}</b> ({titleCase(method)}) from <b>{member?.fullName}</b>? Payments are permanent records; mistakes are corrected by an admin reversal.</>} />
      <ConfirmDialog open={!!refund} danger title="Reverse payment?" confirmLabel="Reverse payment" loading={busy} onConfirm={doRefund} onCancel={() => setRefund(null)} message={<>Reverse <b>{refund?.receiptNumber}</b> ({money(refund?.amount)})? The fines it paid become outstanding again; the original record is kept.</>}><TextInput label="Reason (required)" value={rReason} onChange={(e) => setRReason(e.target.value)} /></ConfirmDialog>
    </>
  );
}
export default function PaymentsPage() { return <Suspense><Payments /></Suspense>; }
