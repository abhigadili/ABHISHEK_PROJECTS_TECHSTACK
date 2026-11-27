'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Alert, Button, Card, TextInput } from '@/components/ui';
import { useServerSubmit } from '@/hooks/useServerForm';
import { useToast } from '@/components/toast';
import { api } from '@/lib/api';
import { passwordRules } from '@/lib/schemas';

const schema = z.object({ newPassword: passwordRules, confirmPassword: z.string() }).refine((d) => d.newPassword === d.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });
type V = z.infer<typeof schema>;

function ResetForm() {
  const token = useSearchParams().get('token') ?? ''; const router = useRouter(); const toast = useToast();
  const form = useForm<V>({ resolver: zodResolver(schema) });
  const { run, formError, busy } = useServerSubmit(form);
  if (!token) return <Alert>This reset link is missing its token. <Link href="/forgot-password" className="underline">Request a new link</Link>.</Alert>;
  return (
    <form noValidate className="space-y-4" onSubmit={form.handleSubmit((v) => run(async () => { await api.post('/auth/reset-password', { token, ...v }); toast.success('Password updated. Please log in.'); router.replace('/login'); }))}>
      {formError && <Alert>{formError} <Link href="/forgot-password" className="underline">Request a new link</Link></Alert>}
      <TextInput label="New password" type="password" autoComplete="new-password" required hint="At least 8 characters with upper-case, lower-case and a digit." error={form.formState.errors.newPassword?.message} {...form.register('newPassword')} />
      <TextInput label="Confirm new password" type="password" autoComplete="new-password" required error={form.formState.errors.confirmPassword?.message} {...form.register('confirmPassword')} />
      <Button type="submit" loading={busy} className="w-full">Set new password</Button>
    </form>
  );
}
export default function ResetPasswordPage() {
  return <div className="mx-auto max-w-md px-4 py-12"><h1 className="mb-6 text-center text-2xl font-bold">Choose a new password</h1><Card><Suspense><ResetForm /></Suspense></Card></div>;
}
