'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Field, FormError, Input } from '@/components/ui/Field';
import { registerAction } from '@/features/auth/actions';
import { registerSchema } from '@/validations/auth';
import type { z } from 'zod';

type Values = z.input<typeof registerSchema>;
/** Registration: client validation (RHF + Zod, validated on blur), then a Server Action whose field errors are mapped back onto the form. */
export function RegisterForm() {
  const [pending, start] = useTransition(); const [error, setError] = useState<string>();
  const { register, handleSubmit, setError: setField, formState: { errors } } = useForm<Values>({ resolver: zodResolver(registerSchema), mode: 'onBlur', defaultValues: { name: '', email: '', mobile: '', password: '', confirmPassword: '' } });
  const submit = handleSubmit((v) => start(async () => {
    setError(undefined);
    const r = await registerAction(v);
    if (r && !r.ok) { setError(r.message); for (const [k, m] of Object.entries(r.fieldErrors ?? {})) setField(k as keyof Values, { type: 'server', message: m }); }
  }));
  return (
    <div className="space-y-4">
      <FormError>{error}</FormError>
      <form noValidate className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
        <Field className="sm:col-span-2" label="Full name" error={errors.name?.message}><Input autoComplete="name" {...register('name')} /></Field>
        <Field label="E-mail" error={errors.email?.message}><Input type="email" autoComplete="email" {...register('email')} /></Field>
        <Field label="Mobile" error={errors.mobile?.message}><Input inputMode="numeric" maxLength={10} autoComplete="tel" {...register('mobile')} /></Field>
        <Field label="Password" error={errors.password?.message}><Input type="password" autoComplete="new-password" {...register('password')} /></Field>
        <Field label="Confirm password" error={errors.confirmPassword?.message}><Input type="password" autoComplete="new-password" {...register('confirmPassword')} /></Field>
        <Button type="submit" className="sm:col-span-2" loading={pending}>Create account</Button>
      </form>
      <p className="text-center text-sm">Already registered? <Link className="text-indigo-600" href="/login">Sign in</Link></p>
    </div>
  );
}
