'use client';
import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { doctorProfileSchema } from '@/lib/validations/doctor';
import { updateDoctorProfileAction } from './actions';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { emitToast } from '@/components/ui/toast';
import type { z } from 'zod';
type V = z.input<typeof doctorProfileSchema>;
/** React Hook Form + Zod; defaultValues + reset(values) after a successful save keep the form pristine. */
export function DoctorProfileForm({ doctorId, defaults }: { doctorId: number; defaults: V }) {
  const [p, st] = useTransition();
  const { register, handleSubmit, setError, reset, formState: { errors, isDirty } } = useForm<V>({ resolver: zodResolver(doctorProfileSchema) as never, defaultValues: defaults });
  const submit = handleSubmit((v) => st(async () => { const r = await updateDoctorProfileAction(doctorId, v); if (r.ok) { emitToast({ kind: 'success', text: r.message! }); reset(v); } else for (const [k, m] of Object.entries(r.fieldErrors ?? {})) setError(k as keyof V, { message: m }); }));
  return <form onSubmit={submit} className="grid gap-4 md:grid-cols-2" noValidate><Field label="Phone" htmlFor="phone" error={errors.phone?.message}><Input id="phone" {...register('phone')} /></Field><Field label="Qualifications" htmlFor="q" error={errors.qualifications?.message}><Input id="q" {...register('qualifications')} /></Field><Field label="Experience (years)" htmlFor="e" error={errors.experienceYears?.message}><Input id="e" type="number" {...register('experienceYears')} /></Field><Field label="Consultation fee (INR)" htmlFor="f" error={errors.consultationFee?.message}><Input id="f" type="number" step="0.01" {...register('consultationFee')} /></Field><div className="md:col-span-2"><Field label="Biography" htmlFor="b" error={errors.bio?.message}><Textarea id="b" rows={4} {...register('bio')} /></Field></div><div className="flex gap-2 md:col-span-2"><Button type="submit" loading={p} disabled={!isDirty}>Save profile</Button><Button type="button" variant="ghost" disabled={!isDirty} onClick={() => reset(defaults)}>Reset</Button></div></form>;
}
