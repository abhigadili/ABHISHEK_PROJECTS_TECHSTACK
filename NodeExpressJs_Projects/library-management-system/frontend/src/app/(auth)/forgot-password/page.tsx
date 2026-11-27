'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Alert, Button, Card, TextInput } from '@/components/ui';
import { useServerSubmit } from '@/hooks/useServerForm';
import { api } from '@/lib/api';

const schema = z.object({ email: z.string().trim().min(1, 'Email is required').email('Enter a valid email') });
export default function ForgotPasswordPage() {
  const form = useForm<{ email: string }>({ resolver: zodResolver(schema) });
  const { run, formError, busy } = useServerSubmit(form);
  const [result, setResult] = useState<{ message: string; devResetLink?: string } | null>(null);
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="mb-2 text-center text-2xl font-bold">Reset your password</h1>
      <p className="mb-6 text-center text-sm text-slate-500">Enter your email and we will generate a reset link.</p>
      <Card>
        {result ? (
          <div className="space-y-3">
            <Alert tone="green">{result.message}</Alert>
            {result.devResetLink
              ? <Alert tone="amber">Development mode (no email provider is configured): <Link className="break-all font-medium underline" href={result.devResetLink.replace(/^https?:\/\/[^/]+/, '')}>open the reset link</Link></Alert>
              : <p className="text-sm text-slate-500">No email provider is configured on this server, so a library administrator must pass the link on to you. Links expire after one hour.</p>}
            <Link href="/login" className="text-sm text-brand-700 hover:underline">Back to log in</Link>
          </div>
        ) : (
          <form noValidate className="space-y-4" onSubmit={form.handleSubmit((v) => run(async () => setResult(await api.post('/auth/forgot-password', v))))}>
            {formError && <Alert>{formError}</Alert>}
            <TextInput label="Email" type="email" required autoComplete="email" error={form.formState.errors.email?.message} {...form.register('email')} />
            <Button type="submit" loading={busy} className="w-full">Send reset link</Button>
          </form>
        )}
      </Card>
    </div>
  );
}
