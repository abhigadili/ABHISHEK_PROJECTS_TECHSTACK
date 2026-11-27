import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeftRight, Search } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { StationPicker } from '@/components/StationPicker';
import { useAppDispatch, useAppSelector } from '@/store';
import { searchChanged } from '@/store/bookingSlice';
import { addDaysIso, todayIso } from '@/utils/format';

const schema = z.object({ from: z.string().min(1, 'Select the source station'), to: z.string().min(1, 'Select the destination station'), date: z.string().min(1, 'Pick a travel date') })
  .refine((v) => v.from !== v.to, { path: ['to'], message: 'Source and destination must differ' })
  .refine((v) => v.date >= todayIso(), { path: ['date'], message: 'Date cannot be in the past' })
  .refine((v) => v.date <= addDaysIso(120), { path: ['date'], message: 'Bookings open 120 days ahead' });
type Values = z.infer<typeof schema>;

export function SearchForm({ compact = false, initial }: { compact?: boolean; initial?: Partial<Values> }) {
  const nav = useNavigate(); const dispatch = useAppDispatch(); const last = useAppSelector((s) => s.bookingFlow.search);
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { from: initial?.from ?? last.from, to: initial?.to ?? last.to, date: initial?.date ?? (last.date >= todayIso() ? last.date : addDaysIso(1)) } });
  const [from, to] = watch(['from', 'to']);
  const submit = handleSubmit((v) => { dispatch(searchChanged(v)); nav(`/search?from=${v.from}&to=${v.to}&date=${v.date}`); });
  return (
    <form onSubmit={submit} noValidate className={`grid gap-3 ${compact ? 'md:grid-cols-[1fr_auto_1fr_180px_auto]' : 'md:grid-cols-[1fr_auto_1fr_200px_auto]'} items-start`}>
      <Field label="From" error={errors.from?.message}><StationPicker {...register('from')} /></Field>
      <Button type="button" variant="ghost" size="icon" aria-label="Swap stations" className="mt-6" onClick={() => { setValue('from', to); setValue('to', from); }}><ArrowLeftRight size={18} /></Button>
      <Field label="To" error={errors.to?.message}><StationPicker {...register('to')} /></Field>
      <Field label="Date" error={errors.date?.message}><Input type="date" min={todayIso()} {...register('date')} /></Field>
      <Button type="submit" size="md" className="mt-6"><Search size={18} />Search</Button>
    </form>
  );
}
