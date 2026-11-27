'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserPlus } from 'lucide-react';
import Link from 'next/link';
import { Suspense, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { MemberFields } from '@/components/MemberFields';
import { checkImage } from '@/components/PictureUploader';
import { SearchInput } from '@/components/pickers';
import { useToast } from '@/components/toast';
import { Alert, Avatar, Button, Card, DataTable, EmptyState, Modal, PageHeader, Pagination, Select, StatusBadge, TextInput } from '@/components/ui';
import { useApi, useDebounced, usePaged } from '@/hooks/useApi';
import { useServerSubmit } from '@/hooks/useServerForm';
import { qs, uploadWithProgress } from '@/lib/api';
import { fmtDate, money } from '@/lib/format';
import { memberFields } from '@/lib/schemas';
import type { MemberType } from '@/lib/types';
import type { MemberLite } from '@/components/pickers';

const schema = z.object({ ...memberFields, memberTypeId: z.string().min(1, 'Choose a membership type'), password: z.string().optional().refine((v) => !v || (v.length >= 8 && /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v)), '8+ characters with upper, lower and a digit (or leave blank to generate one)') });
type V = z.infer<typeof schema>;

function CreateMember({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { data: types } = useApi<MemberType[]>('/member-types'); const toast = useToast();
  const form = useForm<V>({ resolver: zodResolver(schema) }); const { run, formError, busy } = useServerSubmit(form);
  const [file, setFile] = useState<File | null>(null); const [fileErr, setFileErr] = useState<string | null>(null); const [temp, setTemp] = useState<string | null>(null); const input = useRef<HTMLInputElement>(null);
  const close = () => { form.reset(); setFile(null); setTemp(null); onClose(); };
  return (
    <Modal open={open} onClose={close} title="Register a member" wide footer={temp ? <Button onClick={close}>Done</Button> : <><Button variant="secondary" onClick={close}>Cancel</Button><Button loading={busy} onClick={form.handleSubmit((v) => run(async () => {
      const fd = new FormData(); for (const [k, x] of Object.entries(v)) if (x !== undefined && x !== '') fd.append(k, String(x)); if (file) fd.append('picture', file);
      const r = await uploadWithProgress<{ temporaryPassword: string | null }>('POST', '/members', fd);
      toast.success('Member registered'); onCreated(); if (r.temporaryPassword) setTemp(r.temporaryPassword); else close();
    }))}>Register</Button></>}>
      {temp ? <Alert tone="amber">Member created. Give them this temporary password (shown only once): <code className="rounded bg-white px-1.5 py-0.5 font-mono font-bold">{temp}</code> and ask them to change it after logging in.</Alert> : (
        <form noValidate className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          {formError && <Alert>{formError}</Alert>}
          <MemberFields register={form.register as never} errors={form.formState.errors as never} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Membership type" required error={form.formState.errors.memberTypeId?.message} {...form.register('memberTypeId')}><option value="">Choose…</option>{types?.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.maxLoans} books / {t.loanDays} days{t.membershipFee > 0 ? `, fee ${money(t.membershipFee)}` : ''})</option>)}</Select>
            <TextInput label="Initial password (optional)" type="password" autoComplete="new-password" error={form.formState.errors.password?.message} {...form.register('password')} hint="Blank = generate a temporary password." />
          </div>
          <div><input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; setFileErr(null); if (!f) return; const err = checkImage(f); if (err) { setFileErr(err); setFile(null); e.target.value = ''; } else setFile(f); }} />
            <Button variant="secondary" onClick={() => input.current?.click()}>{file ? `Picture: ${file.name}` : 'Add profile picture (optional)'}</Button>{fileErr && <p role="alert" className="mt-1 text-xs text-red-600">{fileErr}</p>}</div>
        </form>)}
    </Modal>
  );
}

function Members() {
  const sp = useSearchParams(); const [q, setQ] = useState(''); const dq = useDebounced(q); const [status, setStatus] = useState(sp.get('status') ?? ''); const [page, setPage] = useState(1); const [creating, setCreating] = useState(false);
  const { rows, meta, loading, error, reload } = usePaged<MemberLite & { createdAt: string; phone: string | null }>(`/members${qs({ q: dq, status, page })}`);
  return (
    <>
      <PageHeader title="Members" subtitle="Look up, register and manage library members." actions={<Button onClick={() => setCreating(true)}><UserPlus className="h-4 w-4" />Register member</Button>} />
      <Card className="!p-0">
        <div className="grid gap-3 p-4 sm:grid-cols-[1fr_200px]"><SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Name, email, phone or member ID" label="Search members" />
          <select aria-label="Filter by status" className="input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option>{['active', 'pending', 'suspended', 'inactive'].map((s) => <option key={s}>{s}</option>)}</select></div>
        <DataTable rows={rows} loading={loading} error={error} onRetry={reload} rowKey={(m) => m.id} empty={<EmptyState title="No members found" description="Try another search or register a new member." />}
          columns={[{ header: 'Member', cell: (m) => <Link href={`/staff/members/${m.id}`} className="flex items-center gap-3"><Avatar userId={m.id} name={m.fullName} hasPicture={m.hasPicture} size={32} /><span><span className="font-medium text-brand-700 hover:underline">{m.fullName}</span><span className="block text-xs text-slate-500">{m.email}</span></span></Link> },
            { header: 'Member ID', cell: (m) => <span className="font-mono text-xs">{m.memberCode}</span> }, { header: 'Type', cell: (m) => m.membershipType ?? '—' }, { header: 'Expires', cell: (m) => fmtDate(m.membershipEnd) }, { header: 'Loans', cell: (m) => m.activeLoans },
            { header: 'Owes', cell: (m) => m.outstandingFines > 0 ? <b className="text-red-700">{money(m.outstandingFines)}</b> : '—' }, { header: 'Status', cell: (m) => <StatusBadge status={m.status} /> }]} />
        <Pagination meta={meta} onPage={setPage} />
      </Card>
      <CreateMember open={creating} onClose={() => setCreating(false)} onCreated={reload} />
    </>
  );
}
export default function MembersPage() { return <Suspense><Members /></Suspense>; }
