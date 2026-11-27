'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { MemberFields } from '@/components/MemberFields';
import { checkImage } from '@/components/PictureUploader';
import { Alert, Button, Card, Select, TextInput } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { useServerSubmit } from '@/hooks/useServerForm';
import { uploadWithProgress } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { memberFields, passwordRules } from '@/lib/schemas';
import type { MemberType } from '@/lib/types';
import { money } from '@/lib/format';

const schema = z.object({ ...memberFields, password: passwordRules, confirmPassword: z.string(), memberTypeId: z.string().optional() })
  .refine((d) => d.password === d.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });
type V = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter(); const { refresh } = useAuth();
  const { data: types } = useApi<MemberType[]>('/member-types');
  const form = useForm<V>({ resolver: zodResolver(schema), defaultValues: { country: '' } });
  const { run, formError, busy } = useServerSubmit(form);
  const [file, setFile] = useState<File | null>(null); const [preview, setPreview] = useState<string | null>(null);
  const [picError, setPicError] = useState<string | null>(null); const [progress, setProgress] = useState<number | null>(null);
  const [pending, setPending] = useState(false); const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!file) { setPreview(null); return; } const u = URL.createObjectURL(file); setPreview(u); return () => URL.revokeObjectURL(u); }, [file]);

  const submit = form.handleSubmit((v) => run(async () => {
    const fd = new FormData();
    for (const [k, val] of Object.entries(v)) if (val !== undefined && val !== null) fd.append(k, String(val));
    if (file) fd.append('picture', file);
    const r = await uploadWithProgress<{ pendingApproval: boolean }>('POST', '/auth/register', fd, setProgress);
    setProgress(null);
    if (r.pendingApproval) { setPending(true); return; }
    await refresh(); router.replace('/member/dashboard');
  }));

  if (pending) return <div className="mx-auto max-w-lg px-4 py-12"><Alert tone="green">Thanks for registering! Your account is awaiting approval by library staff. You can log in once it has been activated.</Alert><Link href="/" className="mt-4 inline-block text-brand-700 hover:underline">Back to home</Link></div>;
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-1 text-2xl font-bold">Join the library</h1>
      <p className="mb-6 text-sm text-slate-500">Create a member account to borrow, reserve and renew books online. Already a member? <Link href="/login" className="text-brand-700 hover:underline">Log in</Link>.</p>
      <form onSubmit={submit} noValidate className="space-y-6">
        {formError && <Alert>{formError}</Alert>}
        <Card title="Your details"><MemberFields register={form.register as never} errors={form.formState.errors as never} /></Card>
        <Card title="Membership">
          <Select label="Membership type" hint="Your library can change the type later." {...form.register('memberTypeId')}>
            <option value="">Standard (default)</option>
            {types?.map((t) => <option key={t.id} value={t.id}>{t.name} — {t.maxLoans} books, {t.loanDays} days{t.membershipFee > 0 ? `, fee ${money(t.membershipFee)}` : ''}</option>)}
          </Select>
        </Card>
        <Card title="Profile picture (optional)">
          <div className="flex items-center gap-4">
            {preview ? <img src={preview} alt="Preview of your picture" className="h-20 w-20 rounded-full object-cover ring-2 ring-brand-300" /> : <div className="grid h-20 w-20 place-items-center rounded-full bg-slate-100 text-xs text-slate-400">No photo</div>}
            <div className="space-y-2">
              <input ref={input} id="picture" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; setPicError(null); if (!f) return; const err = checkImage(f); if (err) { setPicError(err); setFile(null); e.target.value = ''; } else setFile(f); }} />
              <div className="flex gap-2"><Button variant="secondary" onClick={() => input.current?.click()}>{file ? 'Change picture' : 'Choose picture'}</Button>{file && <Button variant="ghost" onClick={() => { setFile(null); if (input.current) input.current.value = ''; }}>Remove</Button>}</div>
              <p className="text-xs text-slate-500">JPEG, PNG or WebP, up to 2 MB.</p>
              {picError && <p role="alert" className="text-xs text-red-600">{picError}</p>}
            </div>
          </div>
        </Card>
        <Card title="Password">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="Password" type="password" autoComplete="new-password" required hint="8+ characters with upper-case, lower-case and a digit." error={form.formState.errors.password?.message} {...form.register('password')} />
            <TextInput label="Confirm password" type="password" autoComplete="new-password" required error={form.formState.errors.confirmPassword?.message} {...form.register('confirmPassword')} />
          </div>
        </Card>
        <div className="flex items-center gap-4"><Button type="submit" loading={busy}>{progress !== null ? `Uploading ${progress}%` : 'Create account'}</Button></div>
      </form>
    </div>
  );
}
