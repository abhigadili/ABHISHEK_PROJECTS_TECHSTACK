'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { LoanTable } from '@/components/LoanTable';
import { PictureUploader } from '@/components/PictureUploader';
import { useToast } from '@/components/toast';
import { Alert, Badge, Button, Card, ConfirmDialog, DataTable, EmptyState, ErrorState, Modal, PageHeader, Select, Skeleton, StatusBadge, Tabs, TextArea, TextInput } from '@/components/ui';
import { errMsg, useApi, usePaged } from '@/hooks/useApi';
import { useServerSubmit } from '@/hooks/useServerForm';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate, money, titleCase } from '@/lib/format';
import { memberFields } from '@/lib/schemas';
import type { Fine, Loan, MemberType, Membership, Reservation } from '@/lib/types';

interface Member { id: number; fullName: string; email: string; phone: string; status: string; statusReason: string | null; memberCode: string; registrationDate: string; hasPicture: boolean; membershipType: string | null; membershipEnd: string | null; activeLoans: number; outstandingFines: number; dateOfBirth: string | null; gender: string | null; address: string | null; city: string | null; state: string | null; postalCode: string | null; country: string | null; lastLoginAt: string | null; policy: Membership | null }
const editSchema = z.object({ fullName: memberFields.fullName, email: memberFields.email, phone: memberFields.phone, dateOfBirth: memberFields.dateOfBirth, gender: z.string().optional(), address: memberFields.address, city: memberFields.city, state: z.string().optional(), postalCode: memberFields.postalCode, country: memberFields.country });

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>(); const toast = useToast(); const { user } = useAuth();
  const { data: m, error, reload } = useApi<Member>(`/members/${id}`);
  const { data: types } = useApi<MemberType[]>('/member-types');
  const [tab, setTab] = useState('loans'); const [picVer, setPicVer] = useState(0);
  const loans = usePaged<Loan>(tab === 'loans' ? `/loans?memberId=${id}&pageSize=50` : null);
  const fines = usePaged<Fine>(tab === 'fines' ? `/fines?memberId=${id}&pageSize=50` : null);
  const res = usePaged<Reservation>(tab === 'reservations' ? `/reservations?q=${m?.memberCode ?? ''}&pageSize=50` : null);
  const terms = useApi<{ id: number; type: string; startDate: string; endDate: string; status: string; notes: string | null }[]>(tab === 'memberships' ? `/members/${id}/memberships` : null);
  const [statusTarget, setStatusTarget] = useState<string | null>(null); const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false);
  const [memOpen, setMemOpen] = useState(false); const [typeId, setTypeId] = useState(''); const [editOpen, setEditOpen] = useState(false); const [fineOpen, setFineOpen] = useState(false);
  const [fineAmt, setFineAmt] = useState(''); const [fineReason, setFineReason] = useState('');
  const form = useForm<z.infer<typeof editSchema>>({ resolver: zodResolver(editSchema) }); const { run, formError, busy: saving } = useServerSubmit(form);
  useEffect(() => { if (m) { form.reset({ fullName: m.fullName, email: m.email, phone: m.phone ?? '', dateOfBirth: m.dateOfBirth ?? '', gender: m.gender ?? '', address: m.address ?? '', city: m.city ?? '', state: m.state ?? '', postalCode: m.postalCode ?? '', country: m.country ?? '' }); setTypeId(String(m.policy?.memberTypeId ?? '')); } }, [m]); // eslint-disable-line react-hooks/exhaustive-deps
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!m) return <Skeleton className="h-64" />;

  const changeStatus = async () => { if (!statusTarget) return; setBusy(true); try { await api.post(`/members/${id}/status`, { status: statusTarget, reason: reason || undefined }); toast.success(`Account ${statusTarget === 'active' ? 'activated' : statusTarget}`); setStatusTarget(null); setReason(''); reload(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); } };
  const saveMembership = async () => { setBusy(true); try { await api.post(`/members/${id}/membership`, { memberTypeId: Number(typeId) }); toast.success('Membership updated'); setMemOpen(false); reload(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); } };
  const addFine = async () => { setBusy(true); try { await api.post('/fines', { memberId: Number(id), amount: Number(fineAmt), reason: fineReason }); toast.success('Fine added'); setFineOpen(false); setFineAmt(''); setFineReason(''); reload(); fines.reload(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); } };
  const e = form.formState.errors; const expired = m.policy?.expired;
  return (
    <>
      <PageHeader title={m.fullName} subtitle={`${m.memberCode} · ${m.email} · registered ${fmtDate(m.registrationDate)}`}
        actions={<><Link href={`/staff/issue`}><Button>Issue a book</Button></Link>{m.outstandingFines > 0 && <Link href={`/staff/payments?memberId=${m.id}`}><Button variant="secondary">Record payment</Button></Link>}<Button variant="secondary" onClick={() => setEditOpen(true)}>Edit details</Button></>} />
      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card title="Profile picture"><PictureUploader userId={m.id} name={m.fullName} hasPicture={m.hasPicture} onChanged={() => { setPicVer((v) => v + 1); reload(); }} version={String(picVer)} /></Card>
        <Card title="Account"><dl className="space-y-2 text-sm"><div className="flex justify-between"><dt className="text-slate-500">Status</dt><dd><StatusBadge status={m.status} /></dd></div>{m.statusReason && <div className="flex justify-between"><dt className="text-slate-500">Reason</dt><dd>{m.statusReason}</dd></div>}<div className="flex justify-between"><dt className="text-slate-500">Last login</dt><dd>{fmtDate(m.lastLoginAt)}</dd></div><div className="flex justify-between"><dt className="text-slate-500">Phone</dt><dd>{m.phone}</dd></div><div className="flex justify-between"><dt className="text-slate-500">Outstanding</dt><dd className={m.outstandingFines > 0 ? 'font-bold text-red-700' : ''}>{money(m.outstandingFines)}</dd></div></dl>
          <div className="mt-4 flex flex-wrap gap-2">{m.status !== 'active' && <Button size="sm" variant="success" onClick={() => setStatusTarget('active')}>{m.status === 'pending' ? 'Approve' : 'Activate'}</Button>}{m.status === 'active' && <Button size="sm" variant="danger" onClick={() => setStatusTarget('suspended')}>Suspend</Button>}{m.status !== 'inactive' && <Button size="sm" variant="secondary" onClick={() => setStatusTarget('inactive')}>Deactivate</Button>}</div></Card>
        <Card title="Membership">{m.policy ? <dl className="space-y-2 text-sm"><div className="flex justify-between"><dt className="text-slate-500">Type</dt><dd className="font-medium">{m.policy.typeName}</dd></div><div className="flex justify-between"><dt className="text-slate-500">Valid</dt><dd>{fmtDate(m.policy.startDate)} → {fmtDate(m.policy.endDate)} {expired && <Badge tone="red">expired</Badge>}</dd></div><div className="flex justify-between"><dt className="text-slate-500">Limits</dt><dd>{m.activeLoans}/{m.policy.maxLoans} loans · {m.policy.loanDays}d · {m.policy.maxRenewals} renewals</dd></div></dl> : <p className="text-sm text-slate-500">No membership.</p>}<Button size="sm" className="mt-4" onClick={() => setMemOpen(true)}>Renew / change type</Button></Card>
      </div>
      <Tabs tabs={[{ key: 'loans', label: 'Loans' }, { key: 'fines', label: 'Fines' }, { key: 'reservations', label: 'Reservations' }, { key: 'memberships', label: 'Membership history' }]} value={tab} onChange={setTab} />
      <Card className="!p-0">
        {tab === 'loans' && <LoanTable rows={loans.rows} loading={loans.loading} error={loans.error} reload={loans.reload} history />}
        {tab === 'fines' && <><div className="flex justify-end p-3"><Button size="sm" variant="secondary" onClick={() => setFineOpen(true)}>Add manual fine</Button></div><DataTable rows={fines.rows} loading={fines.loading} error={fines.error} onRetry={fines.reload} rowKey={(f) => f.id} empty={<EmptyState title="No fines" />} columns={[{ header: 'Date', cell: (f) => fmtDate(f.createdAt) }, { header: 'Type', cell: (f) => titleCase(f.fineType) }, { header: 'Reason', cell: (f) => f.reason }, { header: 'Amount', cell: (f) => money(f.amount) }, { header: 'Balance', cell: (f) => money(f.outstanding) }, { header: 'Status', cell: (f) => <StatusBadge status={f.status} /> }]} /></>}
        {tab === 'reservations' && <DataTable rows={res.rows?.filter((r) => r.userId === m.id)} loading={res.loading} error={res.error} onRetry={res.reload} rowKey={(r) => r.id} empty={<EmptyState title="No reservations" />} columns={[{ header: 'Book', cell: (r) => r.bookTitle }, { header: 'Status', cell: (r) => <StatusBadge status={r.status} /> }, { header: 'Placed', cell: (r) => fmtDate(r.createdAt) }]} />}
        {tab === 'memberships' && <DataTable rows={terms.data} loading={terms.loading} error={terms.error} rowKey={(t) => t.id} columns={[{ header: 'Type', cell: (t) => t.type }, { header: 'From', cell: (t) => fmtDate(t.startDate) }, { header: 'To', cell: (t) => fmtDate(t.endDate) }, { header: 'Status', cell: (t) => <StatusBadge status={t.status} /> }, { header: 'Notes', cell: (t) => t.notes ?? '—' }]} />}
      </Card>

      <ConfirmDialog open={!!statusTarget} danger={statusTarget !== 'active'} title={`${statusTarget === 'active' ? 'Activate' : statusTarget === 'suspended' ? 'Suspend' : 'Deactivate'} account?`} confirmLabel="Confirm" loading={busy} onConfirm={changeStatus} onCancel={() => setStatusTarget(null)} message={statusTarget === 'active' ? 'The member will be able to log in and borrow again.' : 'The member is signed out immediately and cannot log in or borrow.'}>
        {statusTarget !== 'active' && <TextInput label="Reason (required)" value={reason} onChange={(ev) => setReason(ev.target.value)} />}</ConfirmDialog>
      <Modal open={memOpen} onClose={() => setMemOpen(false)} title="Renew or change membership" footer={<><Button variant="secondary" onClick={() => setMemOpen(false)}>Cancel</Button><Button loading={busy} onClick={saveMembership} disabled={!typeId}>Save</Button></>}>
        <Select label="Membership type" value={typeId} onChange={(ev) => setTypeId(ev.target.value)}>{types?.map((t) => <option key={t.id} value={t.id}>{t.name} — {t.membershipDays} days{t.membershipFee > 0 ? `, fee ${money(t.membershipFee)}` : ''}</option>)}</Select>
        <p className="mt-2 text-xs text-slate-500">Choosing the current type renews the term (extending from its end date); another type starts a new term today. History is kept.</p></Modal>
      <Modal open={fineOpen} onClose={() => setFineOpen(false)} title="Add manual fine" footer={<><Button variant="secondary" onClick={() => setFineOpen(false)}>Cancel</Button><Button loading={busy} onClick={addFine} disabled={!(Number(fineAmt) > 0) || fineReason.trim().length < 3}>Add fine</Button></>}>
        <div className="space-y-3"><TextInput label="Amount" type="number" min={0.01} step="0.01" value={fineAmt} onChange={(ev) => setFineAmt(ev.target.value)} /><TextArea label="Reason" value={fineReason} onChange={(ev) => setFineReason(ev.target.value)} /></div></Modal>
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit member details" wide footer={<><Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button><Button loading={saving} onClick={form.handleSubmit((v) => run(async () => { await api.patch(`/members/${id}`, Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x === '' ? null : x]).filter(([k, x]) => x !== null || !['fullName', 'phone', 'email'].includes(k as string)))); toast.success('Member updated'); setEditOpen(false); reload(); }))}>Save</Button></>}>
        <form noValidate onSubmit={(ev) => ev.preventDefault()} className="space-y-4">{formError && <Alert>{formError}</Alert>}<div className="grid gap-4 sm:grid-cols-2">
          <TextInput label="Full name" error={e.fullName?.message} {...form.register('fullName')} /><TextInput label="Email" type="email" error={e.email?.message} {...form.register('email')} /><TextInput label="Phone" error={e.phone?.message} {...form.register('phone')} /><TextInput label="Date of birth" type="date" error={e.dateOfBirth?.message} {...form.register('dateOfBirth')} />
          <div className="sm:col-span-2"><TextInput label="Address" error={e.address?.message} {...form.register('address')} /></div><TextInput label="City" error={e.city?.message} {...form.register('city')} /><TextInput label="State" {...form.register('state')} /><TextInput label="Postal code" error={e.postalCode?.message} {...form.register('postalCode')} /><TextInput label="Country" error={e.country?.message} {...form.register('country')} /></div></form></Modal>
      <span className="hidden">{user?.id}</span>
    </>
  );
}
