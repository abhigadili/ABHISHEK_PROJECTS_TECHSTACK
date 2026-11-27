'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useToast } from '@/components/toast';
import { Alert, Button, Card, Checkbox, DataTable, Modal, PageHeader, StatusBadge, TextInput } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { useServerSubmit } from '@/hooks/useServerForm';
import { api } from '@/lib/api';
import { money } from '@/lib/format';
import type { MemberType } from '@/lib/types';

const int = (min: number, max: number) => z.string().refine((v) => v !== '' && Number.isInteger(+v) && +v >= min && +v <= max, `${min}–${max}`);
const dec = z.string().refine((v) => v !== '' && +v >= 0, 'Zero or more');
const schema = z.object({ name: z.string().trim().min(2, 'Name is required').max(60), description: z.string().max(255).optional(), maxLoans: int(0, 100), loanDays: int(1, 365), maxRenewals: int(0, 20), renewalDays: int(1, 365), maxReservations: int(0, 100), finePerDay: dec, graceDays: int(0, 60), maxFinePerLoan: z.string().optional().refine((v) => !v || +v >= 0, 'Zero or more'), membershipDays: int(1, 3650), membershipFee: dec, isActive: z.boolean() });
type V = z.infer<typeof schema>;
const toForm = (t: MemberType | null): V => ({ name: t?.name ?? '', description: t?.description ?? '', maxLoans: String(t?.maxLoans ?? 5), loanDays: String(t?.loanDays ?? 14), maxRenewals: String(t?.maxRenewals ?? 2), renewalDays: String(t?.renewalDays ?? 14), maxReservations: String(t?.maxReservations ?? 5), finePerDay: String(t?.finePerDay ?? 0.5), graceDays: String(t?.graceDays ?? 0), maxFinePerLoan: t?.maxFinePerLoan != null ? String(t.maxFinePerLoan) : '', membershipDays: String(t?.membershipDays ?? 365), membershipFee: String(t?.membershipFee ?? 0), isActive: t?.isActive ?? true });

export default function MemberTypesPage() {
  const toast = useToast(); const { data, error, loading, reload } = useApi<MemberType[]>('/member-types/all'); const [editing, setEditing] = useState<MemberType | null | 'new'>(null);
  const form = useForm<V>({ resolver: zodResolver(schema), defaultValues: toForm(null) }); const { run, formError, busy } = useServerSubmit(form); const e = form.formState.errors;
  useEffect(() => { if (editing) form.reset(toForm(editing === 'new' ? null : editing)); }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = form.handleSubmit((v) => run(async () => {
    const body = { ...v, description: v.description || null, maxLoans: +v.maxLoans, loanDays: +v.loanDays, maxRenewals: +v.maxRenewals, renewalDays: +v.renewalDays, maxReservations: +v.maxReservations, finePerDay: +v.finePerDay, graceDays: +v.graceDays, maxFinePerLoan: v.maxFinePerLoan ? +v.maxFinePerLoan : null, membershipDays: +v.membershipDays, membershipFee: +v.membershipFee };
    if (editing === 'new') await api.post('/member-types', body); else await api.put(`/member-types/${(editing as MemberType).id}`, body);
    toast.success('Membership type saved'); setEditing(null); reload();
  }));
  const f = (name: keyof V, label: string, hint?: string) => <TextInput label={label} hint={hint} inputMode="decimal" error={e[name]?.message as string | undefined} {...form.register(name as never)} />;
  return (
    <>
      <PageHeader title="Membership types & policies" subtitle="Borrowing limits, loan periods, renewals and late-fee rules are stored in the database and applied immediately." actions={<Button onClick={() => setEditing('new')}><Plus className="h-4 w-4" />Add type</Button>} />
      <Card className="!p-0"><DataTable rows={data} loading={loading} error={error} onRetry={reload} rowKey={(t) => t.id}
        columns={[{ header: 'Type', cell: (t) => <span><b>{t.name}</b><span className="block text-xs text-slate-500">{t.description}</span></span> }, { header: 'Loans', cell: (t) => `${t.maxLoans} × ${t.loanDays}d` }, { header: 'Renewals', cell: (t) => `${t.maxRenewals} × ${t.renewalDays}d` }, { header: 'Reservations', cell: (t) => t.maxReservations },
          { header: 'Late fee', cell: (t) => `${money(t.finePerDay)}/d, grace ${t.graceDays}d${t.maxFinePerLoan != null ? `, cap ${money(t.maxFinePerLoan)}` : ''}` }, { header: 'Term / fee', cell: (t) => `${t.membershipDays}d / ${money(t.membershipFee)}` }, { header: 'Members', cell: (t) => t.activeMembers ?? 0 }, { header: 'Status', cell: (t) => <StatusBadge status={t.isActive ? 'active' : 'inactive'} /> },
          { header: '', cell: (t) => <Button size="sm" variant="secondary" onClick={() => setEditing(t)}>Edit</Button> }]} /></Card>
      <Modal open={!!editing} onClose={() => setEditing(null)} wide title={editing === 'new' ? 'Add membership type' : 'Edit membership type'} footer={<><Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button loading={busy} onClick={save}>Save</Button></>}>
        <form noValidate onSubmit={(ev) => { ev.preventDefault(); void save(); }} className="grid gap-4 sm:grid-cols-3">{formError && <div className="sm:col-span-3"><Alert>{formError}</Alert></div>}
          <div className="sm:col-span-2"><TextInput label="Name" error={e.name?.message} {...form.register('name')} /></div><div className="flex items-end pb-2"><Checkbox label="Available for new members" {...form.register('isActive')} /></div>
          <div className="sm:col-span-3"><TextInput label="Description" {...form.register('description')} /></div>
          {f('maxLoans', 'Max loans')}{f('loanDays', 'Loan period (days)')}{f('maxReservations', 'Max reservations')}{f('maxRenewals', 'Max renewals')}{f('renewalDays', 'Renewal period (days)')}<span />
          {f('finePerDay', 'Fine per day')}{f('graceDays', 'Grace period (days)')}{f('maxFinePerLoan', 'Max fine per loan', 'Blank = no cap')}{f('membershipDays', 'Membership term (days)')}{f('membershipFee', 'Membership fee', 'Informational; not auto-charged')}
        </form></Modal>
    </>
  );
}
