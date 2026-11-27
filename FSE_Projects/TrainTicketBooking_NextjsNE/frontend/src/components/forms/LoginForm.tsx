'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Field, FormError, Input } from '@/components/ui/Field';
import { loginAction } from '@/features/auth/actions';
import { loginSchema } from '@/validations/auth';
import type { z } from 'zod';

type Values = z.input<typeof loginSchema>;
/** Login (React Hook Form + Zod on the client, the SAME schema re-checked inside the Server Action). Used by the full page and the intercepted modal. */
export function LoginForm({ next, notice, onNavigate }: { next?: string; notice?: string; onNavigate?: () => void }) {
  const [pending, start] = useTransition(); const [error, setError] = useState<string>();
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });
  const submit = handleSubmit((v) => start(async () => {
    setError(undefined);
    const r = await loginAction({ ...v, next }); // on success the action redirects and never returns
    if (r && !r.ok) setError(r.message);
  }));
  return (
    <div className="space-y-4">
      {notice && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
      <FormError>{error}</FormError>
      <form noValidate className="space-y-4" onSubmit={submit}>
        <Field label="E-mail" error={errors.email?.message}><Input type="email" autoComplete="username" {...register('email')} /></Field>
        <Field label="Password" error={errors.password?.message}><Input type="password" autoComplete="current-password" {...register('password')} /></Field>
        <Button type="submit" className="w-full" loading={pending}>Sign in</Button>
      </form>
      <div className="flex justify-between text-sm"><Link className="text-indigo-600" href="/forgot-password" onClick={onNavigate}>Forgot password?</Link><Link className="text-indigo-600" href="/register" onClick={onNavigate}>Create account</Link></div>
    </div>
  );
}
