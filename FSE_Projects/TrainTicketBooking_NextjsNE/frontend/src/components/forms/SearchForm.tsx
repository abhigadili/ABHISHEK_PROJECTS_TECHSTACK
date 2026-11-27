'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeftRight, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { usePrefs } from '@/store/zustand';
import type { Station } from '@/types';
import { addDaysIso, todayIso } from '@/utils/format';

const schema = z.object({ from: z.string().min(1, 'Select the source station'), to: z.string().min(1, 'Select the destination station'), date: z.string().min(1, 'Pick a travel date') })
  .refine((v) => v.from !== v.to, { path: ['to'], message: 'Source and destination must differ' })        // cross-field validation
  .refine((v) => v.date >= todayIso(), { path: ['date'], message: 'Date cannot be in the past' })
  .refine((v) => v.date <= addDaysIso(120), { path: ['date'], message: 'Bookings open 120 days ahead' });
type Values = z.infer<typeof schema>;

/** Train search (React Hook Form + Zod). Stations arrive as props from a cached Server Component fetch - no client round trip. */
export function SearchForm({ stations, initial }: { stations: Station[]; initial?: Partial<Values> }) {
  const router = useRouter(); const [pending, start] = useTransition(); const addRecent = usePrefs((s) => s.addRecent);
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { from: initial?.from || '', to: initial?.to || '', date: initial?.date || addDaysIso(1) } });
  const [from, to] = watch(['from', 'to']);
  const name = (id: string) => stations.find((s) => String(s.id) === id)?.name ?? id;
  const submit = handleSubmit((v) => { addRecent({ ...v, fromName: name(v.from), toName: name(v.to) }); start(() => router.push(`/search?from=${v.from}&to=${v.to}&date=${v.date}`)); });
  const opts = stations.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>);
  return (
    <form onSubmit={submit} noValidate className="grid items-start gap-3 md:grid-cols-[1fr_auto_1fr_190px_auto]">
      <Field label="From" error={errors.from?.message}><Select {...register('from')}><option value="">Select station</option>{opts}</Select></Field>
      <Button type="button" variant="ghost" size="icon" aria-label="Swap stations" className="mt-6" onClick={() => { setValue('from', to); setValue('to', from); }}><ArrowLeftRight size={18} /></Button>
      <Field label="To" error={errors.to?.message}><Select {...register('to')}><option value="">Select station</option>{opts}</Select></Field>
      <Field label="Date" error={errors.date?.message}><Input type="date" min={todayIso()} {...register('date')} /></Field>
      <Button type="submit" className="mt-6" loading={pending}><Search size={18} />Search</Button>
    </form>
  );
}
