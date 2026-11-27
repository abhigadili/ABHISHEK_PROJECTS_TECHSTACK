'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { SearchInput } from '@/components/pickers';
import { useToast } from '@/components/toast';
import { Alert, Button, Card, ConfirmDialog, DataTable, EmptyState, Modal, PageHeader, Pagination, Select, StatusBadge, TextInput } from '@/components/ui';
import { errMsg, useDebounced, usePaged } from '@/hooks/useApi';
import { useServerSubmit } from '@/hooks/useServerForm';
import { api, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate } from '@/lib/format';
import { phoneRule } from '@/lib/schemas';

interface S { id: number; email: string; fullName: string; phone: string | null; status: string; role: string; lastLoginAt: string | null }
const schema = z.object({ fullName: z.string().trim().min(2, 'Name is required'), email: z.string().trim().email('Enter a valid email'), phone: phoneRule.optional().or(z.literal('')), role: z.enum(['librarian', 'admin']), password: z.string().optional().refine((v) => !v || (v.length >= 8 && /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v)), '8+ characters with upper, lower and a digit') });

export default function StaffAdminPage() {
  const toast = useToast(); const { user } = useAuth(); const [q, setQ] = useState(''); const dq = useDebounced(q); const [page, setPage] = useState(1);
  const { rows, meta, loading, error, reload } = usePaged<S>(`/staff${qs({ q: dq, page })}`);
  const [adding, setAdding] = useState(false); const [temp, setTemp] = useState<string | null>(null);
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { role: 'librarian' } }); const { run, formError, busy } = useServerSubmit(form);
  const [target, setTarget] = useState<{ s: S; action: 'suspended' | 'active' | 'reset' } | null>(null); const [reason, setReason] = useState(''); const [working, setWorking] = useState(false); const [resetPw, setResetPw] = useState<string | null>(null);
  const close = () => { setAdding(false); setTemp(null); form.reset({ role: 'librarian' }); };
  const act = async () => { if (!target) return; setWorking(true); try { if (target.action === 'reset') { const r = await api.post<{ temporaryPassword: string }>(`/staff/${target.s.id}/reset-password`); setResetPw(r.temporaryPassword); } else { await api.post(`/staff/${target.s.id}/status`, { status: target.action, reason: reason || undefined }); toast.success('Account updated'); setTarget(null); setReason(''); reload(); } } catch (e) { toast.error(errMsg(e)); setTarget(null); } finally { setWorking(false); } };
  const e = form.formState.errors;
  return (
    <>
      <PageHeader title="Staff accounts" subtitle="Librarians and administrators. Only admins can create or change them." actions={<Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" />Add staff</Button>} />
      <Card className="!p-0"><div className="p-4"><SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Name or email" label="Search staff" /></div>
        <DataTable rows={rows} loading={loading} error={error} onRetry={reload} rowKey={(s) => s.id} empty={<EmptyState title="No staff found" />}
          columns={[{ header: 'Name', cell: (s) => <span><b>{s.fullName}</b><span className="block text-xs text-slate-500">{s.email}</span></span> }, { header: 'Role', cell: (s) => <span className="capitalize">{s.role}</span> }, { header: 'Status', cell: (s) => <StatusBadge status={s.status} /> }, { header: 'Last login', cell: (s) => fmtDate(s.lastLoginAt) },
            { header: '', cell: (s) => s.id === user?.id ? <span className="text-xs text-slate-400">you</span> : <div className="flex gap-2">{s.status === 'active' ? <Button size="sm" variant="secondary" onClick={() => setTarget({ s, action: 'suspended' })}>Suspend</Button> : <Button size="sm" variant="success" onClick={() => setTarget({ s, action: 'active' })}>Activate</Button>}<Button size="sm" variant="ghost" onClick={() => { setResetPw(null); setTarget({ s, action: 'reset' }); }}><KeyRound className="h-3.5 w-3.5" />Reset password</Button></div> }]} />
        <Pagination meta={meta} onPage={setPage} /></Card>
      <Modal open={adding} onClose={close} title="Add staff account" footer={temp ? <Button onClick={close}>Done</Button> : <><Button variant="secondary" onClick={close}>Cancel</Button><Button loading={busy} onClick={form.handleSubmit((v) => run(async () => { const r = await api.post<{ temporaryPassword: string | null }>('/staff', { ...v, phone: v.phone || null, password: v.password || undefined }); reload(); toast.success('Staff account created'); if (r.temporaryPassword) setTemp(r.temporaryPassword); else close(); }))}>Create</Button></>}>
        {temp ? <Alert tone="amber">Account created. Temporary password (shown once): <code className="rounded bg-white px-1.5 py-0.5 font-mono font-bold">{temp}</code></Alert> : (
          <form noValidate onSubmit={(ev) => ev.preventDefault()} className="space-y-3">{formError && <Alert>{formError}</Alert>}<TextInput label="Full name" error={e.fullName?.message} {...form.register('fullName')} /><TextInput label="Email" type="email" error={e.email?.message} {...form.register('email')} /><TextInput label="Phone (optional)" error={e.phone?.message} {...form.register('phone')} />
            <Select label="Role" {...form.register('role')}><option value="librarian">Librarian</option><option value="admin">Administrator</option></Select><TextInput label="Password (optional)" type="password" autoComplete="new-password" hint="Blank = generate a temporary password." error={e.password?.message} {...form.register('password')} /></form>)}
      </Modal>
      <ConfirmDialog open={!!target} danger={target?.action !== 'active'} title={target?.action === 'reset' ? 'Reset password?' : target?.action === 'active' ? 'Activate account?' : 'Suspend account?'} confirmLabel={resetPw ? 'Close' : 'Confirm'} loading={working} onCancel={() => { setTarget(null); setResetPw(null); }} onConfirm={resetPw ? () => { setTarget(null); setResetPw(null); } : act}
        message={resetPw ? <Alert tone="amber">Temporary password for {target?.s.fullName} (shown once): <code className="rounded bg-white px-1.5 py-0.5 font-mono font-bold">{resetPw}</code></Alert> : target?.action === 'reset' ? `Generate a new temporary password for ${target?.s.fullName}? Their sessions are ended.` : `${target?.s.fullName}`}>
        {target?.action === 'suspended' && <TextInput label="Reason" value={reason} onChange={(ev) => setReason(ev.target.value)} />}</ConfirmDialog>
    </>
  );
}
