'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerPatientSchema, type RegisterPatientInput } from '@/lib/validations/auth';
import { registerPatientAction } from './actions';
import { Button } from '@/components/ui/button';
import { Field, Input, NativeSelect } from '@/components/ui/input';
import { Alert } from '@/components/ui/empty-state';

const STEPS = ['Account', 'Personal details', 'Emergency contact'] as const;
const FIELDS: Record<number, (keyof RegisterPatientInput | string)[]> = { 0: ['account.email', 'account.password', 'account.confirmPassword'], 1: ['personal.firstName', 'personal.lastName', 'personal.phone', 'personal.dateOfBirth', 'personal.gender', 'personal.bloodGroup', 'personal.address', 'personal.city'], 2: ['emergency.name', 'emergency.phone', 'acceptTerms'] };
const lookup = (obj: unknown, path: string): string | undefined => (path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], obj) as { message?: string } | undefined)?.message;

/**
 * Scenario 1: multi-step patient registration with React Hook Form + Zod (nested objects, cross-field + conditional rules).
 * Final submit calls a Server Action that validates again, hashes the password, creates User+Patient in one transaction and redirects.
 */
export function RegisterWizard() {
  const [step, setStep] = useState(0); const [pending, start] = useTransition(); const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, trigger, setError: setFieldError, control, formState: { errors } } = useForm<RegisterPatientInput>({
    resolver: zodResolver(registerPatientSchema) as never, mode: 'onTouched',
    defaultValues: { account: { email: '', password: '', confirmPassword: '' }, personal: { firstName: '', lastName: '', phone: '', dateOfBirth: '', gender: undefined as never, bloodGroup: '', address: '', city: '' }, emergency: { name: '', phone: '' }, acceptTerms: undefined as never },
  });
  const pw = useWatch({ control, name: 'account.password' }) ?? '';
  const strength = [/.{10,}/, /[A-Z]/, /[a-z]/, /\d/].filter((r) => r.test(pw)).length;
  const e = (p: string) => lookup(errors, p);
  const next = async () => { if (await trigger(FIELDS[step] as never)) setStep((s) => s + 1); };
  const submit = handleSubmit((v) => { setError(null); start(async () => { const r = await registerPatientAction(v); if (r && !r.ok) { setError(r.message ?? 'Registration failed'); for (const [k, m] of Object.entries(r.fieldErrors ?? {})) { setFieldError(k as never, { message: m }); const s = Object.entries(FIELDS).find(([, f]) => f.includes(k))?.[0]; if (s) setStep(Number(s)); } } }); });
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <ol className="flex gap-2 text-xs">{STEPS.map((s, i) => <li key={s} className={`flex-1 rounded-full px-2 py-1 text-center ${i === step ? 'bg-primary text-primary-fg' : i < step ? 'bg-primary/20' : 'bg-surface2 text-muted'}`}>{i + 1}. {s}</li>)}</ol>
      {error && <Alert tone="danger">{error}</Alert>}
      {step === 0 && <div className="space-y-3"><Field label="E-mail" htmlFor="email" required error={e('account.email')}><Input id="email" type="email" autoComplete="email" {...register('account.email')} /></Field><Field label="Password" htmlFor="pw" required error={e('account.password')} hint="10+ characters with upper, lower case and a digit"><Input id="pw" type="password" autoComplete="new-password" {...register('account.password')} /></Field><div className="flex gap-1" aria-hidden>{[0, 1, 2, 3].map((i) => <span key={i} className={`h-1 flex-1 rounded ${i < strength ? 'bg-ok' : 'bg-line'}`} />)}</div><Field label="Confirm password" htmlFor="cpw" required error={e('account.confirmPassword')}><Input id="cpw" type="password" autoComplete="new-password" {...register('account.confirmPassword')} /></Field></div>}
      {step === 1 && <div className="grid gap-3 sm:grid-cols-2"><Field label="First name" htmlFor="fn" required error={e('personal.firstName')}><Input id="fn" {...register('personal.firstName')} /></Field><Field label="Last name" htmlFor="ln" required error={e('personal.lastName')}><Input id="ln" {...register('personal.lastName')} /></Field><Field label="Phone" htmlFor="ph" required error={e('personal.phone')}><Input id="ph" {...register('personal.phone')} /></Field><Field label="Date of birth" htmlFor="dob" required error={e('personal.dateOfBirth')}><Input id="dob" type="date" {...register('personal.dateOfBirth')} /></Field><Field label="Gender" htmlFor="g" required error={e('personal.gender')}><NativeSelect id="g" defaultValue="" {...register('personal.gender')}><option value="" disabled>Select…</option><option value="FEMALE">Female</option><option value="MALE">Male</option><option value="OTHER">Other</option></NativeSelect></Field><Field label="Blood group" htmlFor="bg"><NativeSelect id="bg" {...register('personal.bloodGroup')}>{['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((b) => <option key={b} value={b}>{b || 'Unknown'}</option>)}</NativeSelect></Field><Field label="Address" htmlFor="ad"><Input id="ad" {...register('personal.address')} /></Field><Field label="City" htmlFor="ct"><Input id="ct" {...register('personal.city')} /></Field></div>}
      {step === 2 && <div className="space-y-3"><Field label="Emergency contact name" htmlFor="en" error={e('emergency.name')}><Input id="en" {...register('emergency.name')} /></Field><Field label="Emergency contact phone" htmlFor="ep" error={e('emergency.phone')} hint="Required when a name is given"><Input id="ep" {...register('emergency.phone')} /></Field><label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 size-4" {...register('acceptTerms')} />I accept the terms of use and the privacy notice.</label>{e('acceptTerms') && <p role="alert" className="text-xs text-danger">{e('acceptTerms')}</p>}</div>}
      <div className="flex justify-between"><Button type="button" variant="ghost" disabled={step === 0 || pending} onClick={() => setStep((s) => s - 1)}>Back</Button>{step < 2 ? <Button key="next" type="button" onClick={next}>Next</Button> : <Button key="submit" type="submit" loading={pending}>Create account</Button>}</div>
      <p className="text-center text-sm text-muted">Already registered? <Link className="font-medium text-primary hover:underline" href="/login">Sign in</Link></p>
    </form>
  );
}
