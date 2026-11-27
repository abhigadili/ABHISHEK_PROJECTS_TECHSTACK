'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Alert, Button, Card, TextInput } from '@/components/ui';
import { useServerSubmit } from '@/hooks/useServerForm';
import { useAuth, homeFor } from '@/lib/auth';

const schema = z.object({ email: z.string().trim().min(1, 'Email is required').email('Enter a valid email'), password: z.string().min(1, 'Password is required') });
type V = z.infer<typeof schema>;

function LoginForm() {
  const { login } = useAuth(); const router = useRouter(); const sp = useSearchParams();
  const form = useForm<V>({ resolver: zodResolver(schema) });
  const { run, formError, busy } = useServerSubmit(form);
  const submit = form.handleSubmit((v) => run(async () => {
    const u = await login(v.email, v.password);
    const next = sp.get('next');
    router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : homeFor(u));
  }));
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {formError && <Alert>{formError}</Alert>}
      <TextInput label="Email" type="email" autoComplete="email" required error={form.formState.errors.email?.message} {...form.register('email')} />
      <TextInput label="Password" type="password" autoComplete="current-password" required error={form.formState.errors.password?.message} {...form.register('password')} />
      <Button type="submit" loading={busy} className="w-full">Log in</Button>
      <div className="flex justify-between text-sm"><Link href="/forgot-password" className="text-brand-700 hover:underline">Forgot password?</Link><Link href="/register" className="text-brand-700 hover:underline">Create an account</Link></div>
    </form>
  );
}
export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="mb-6 text-center text-2xl font-bold">Welcome back</h1>
      <Card><Suspense><LoginForm /></Suspense></Card>
    </div>
  );
}
