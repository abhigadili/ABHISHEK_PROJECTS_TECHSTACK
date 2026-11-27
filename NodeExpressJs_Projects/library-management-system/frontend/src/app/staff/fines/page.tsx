'use client';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { MemberPicker, SearchInput, type MemberLite } from '@/components/pickers';
import { useToast } from '@/components/toast';
import { Button, Card, DataTable, EmptyState, Modal, PageHeader, Pagination, Select, StatusBadge, Tabs, TextArea, TextInput } from '@/components/ui';
import { errMsg, useDebounced, usePaged } from '@/hooks/useApi';
import { api, qs } from '@/lib/api';
import { fmtDate, money, titleCase } from '@/lib/format';
import type { Fine } from '@/lib/types';

function Fines() {
  const sp = useSearchParams(); const toast = useToast();
  const [tab, setTab] = useState('unpaid'); const [q, setQ] = useState(''); const dq = useDebounced(q); const [type, setType] = useState(''); const [page, setPage] = useState(1);
  const { rows, meta, loading, error, reload } = usePaged<Fine>(`/fines${qs({ status: tab === 'all' ? '' : tab, q: dq, type, page, memberId: sp.get('memberId') ?? undefined })}`);
  const [adding, setAdding] = useState(false); const [member, setMember] = useState<MemberLite | null>(null); const [amount, setAmount] = useState(''); const [ftype, setFtype] = useState('manual'); const [reason, setReason] = useState('');
  const [waive, setWaive] = useState<Fine | null>(null); const [wAmount, setWAmount] = useState(''); const [wReason, setWReason] = useState(''); const [busy, setBusy] = useState(false);
  const addFine = async () => { setBusy(true); try { await api.post('/fines', { memberId: member!.id, amount: Number(amount), type: ftype, reason }); toast.success('Fine added'); setAdding(false); setMember(null); setAmount(''); setReason(''); reload(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); } };
  const doWaive = async () => { if (!waive) return; setBusy(true); try { await api.post(`/fines/${waive.id}/waive`, { amount: wAmount ? Number(wAmount) : undefined, reason: wReason }); toast.success('Fine waived'); setWaive(null); setWAmount(''); setWReason(''); reload(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); } };
  return (
    <>
      <PageHeader title="Fines" subtitle="Overdue, lost, damage and manual charges. Waivers and payments keep a full audit trail." actions={<Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" />Add fine</Button>} />
      <Tabs tabs={[{ key: 'unpaid', label: 'Unpaid' }, { key: 'paid', label: 'Paid' }, { key: 'waived', label: 'Waived' }, { key: 'all', label: 'All' }]} value={tab} onChange={(k) => { setTab(k); setPage(1); }} />
      <Card className="!p-0">
        <div className="grid gap-3 p-4 sm:grid-cols-[1fr_180px]"><SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Member, member ID or reason" label="Search fines" /><select aria-label="Fine type" className="input" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}><option value="">All types</option>{['overdue', 'lost', 'damage', 'manual'].map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</select></div>
        <DataTable rows={rows} loading={loading} error={error} onRetry={reload} rowKey={(f) => f.id} empty={<EmptyState title="No fines found" />}
          columns={[{ header: 'Date', cell: (f) => fmtDate(f.createdAt) }, { header: 'Member', cell: (f) => <div><Link href={`/staff/members/${f.userId}`} className="font-medium hover:underline">{f.memberName}</Link><div className="text-xs text-slate-500">{f.memberCode}</div></div> }, { header: 'Type', cell: (f) => titleCase(f.fineType) },
            { header: 'Reason', cell: (f) => <span>{f.reason}{f.waiverReason && <span className="block text-xs text-slate-500">Waived: {f.waiverReason}{f.waivedBy ? ` (${f.waivedBy})` : ''}</span>}</span> }, { header: 'Amount', cell: (f) => money(f.amount) }, { header: 'Paid / waived', cell: (f) => `${money(f.paidAmount)} / ${money(f.waivedAmount)}` },
            { header: 'Balance', cell: (f) => <b className={f.outstanding > 0 ? 'text-red-700' : ''}>{money(f.outstanding)}</b> }, { header: 'Status', cell: (f) => <StatusBadge status={f.status} /> },
            { header: '', cell: (f) => f.outstanding > 0 ? <div className="flex gap-2"><Link href={`/staff/payments?memberId=${f.userId}`}><Button size="sm">Pay</Button></Link><Button size="sm" variant="secondary" onClick={() => { setWaive(f); setWAmount(''); setWReason(''); }}>Waive</Button></div> : null }]} />
        <Pagination meta={meta} onPage={setPage} />
      </Card>
      <Modal open={adding} onClose={() => setAdding(false)} title="Add a fine" footer={<><Button variant="secondary" onClick={() => setAdding(false)}>Cancel</Button><Button loading={busy} disabled={!member || !(Number(amount) > 0) || reason.trim().length < 3} onClick={addFine}>Add fine</Button></>}>
        <div className="space-y-3"><MemberPicker value={member} onChange={setMember} /><div className="grid grid-cols-2 gap-3"><TextInput label="Amount" type="number" min={0.01} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /><Select label="Type" value={ftype} onChange={(e) => setFtype(e.target.value)}><option value="manual">Manual</option><option value="damage">Damage</option><option value="lost">Lost item</option></Select></div><TextArea label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} /></div></Modal>
      <Modal open={!!waive} onClose={() => setWaive(null)} title="Waive fine" footer={<><Button variant="secondary" onClick={() => setWaive(null)}>Cancel</Button><Button loading={busy} disabled={wReason.trim().length < 3} onClick={doWaive}>Waive</Button></>}>
        <div className="space-y-3"><p className="text-sm text-slate-600">{waive?.memberName} — balance <b>{money(waive?.outstanding)}</b></p><TextInput label="Amount to waive (blank = entire balance)" type="number" min={0.01} step="0.01" max={waive?.outstanding} value={wAmount} onChange={(e) => setWAmount(e.target.value)} /><TextArea label="Reason (required, recorded in the audit log)" value={wReason} onChange={(e) => setWReason(e.target.value)} /></div></Modal>
    </>
  );
}
export default function FinesPage() { return <Suspense><Fines /></Suspense>; }
