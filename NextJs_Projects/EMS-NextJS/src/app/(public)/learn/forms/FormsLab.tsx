'use client';
import { useState } from 'react';
import { Controller, FormProvider, useForm, useFormContext, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  username: z.string().min(3, 'At least 3 characters'),
  plan: z.enum(['free', 'pro']),
  seats: z.coerce.number().int().min(1, 'At least one seat').max(50),
  address: z.object({ city: z.string().min(1, 'City is required'), zip: z.string().regex(/^\d{5}$/, 'Five digits') }), // nested fields
});
type Values = z.input<typeof schema>;
const TAKEN = ['admin', 'root', 'ella'];

/** `useFormContext`: a deeply nested field reads the form WITHOUT prop drilling (provided by <FormProvider>). */
function CityField() {
  const { register, formState: { errors } } = useFormContext<Values>();
  return <label className="block text-sm">City<input {...register('address.city')} className="ml-2 rounded border border-border bg-surface px-2 py-1" />{errors.address?.city && <span role="alert" className="ml-2 text-red-600">{errors.address.city.message}</span>}</label>;
}
/** `useWatch`: re-renders ONLY this component when `seats`/`plan` change (not the whole form). */
function Price() {
  const seats = useWatch<Values, 'seats'>({ name: 'seats' }); const plan = useWatch<Values, 'plan'>({ name: 'plan' });
  return <p className="text-sm" data-testid="price">Price: ${plan === 'pro' ? Number(seats || 0) * 9 : 0}/month</p>;
}

export function FormsLab() {
  const methods = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { username: '', plan: 'free', seats: 1, address: { city: '', zip: '' } }, mode: 'onTouched' });
  const { register, control, handleSubmit, setError, formState: { errors, isSubmitting } } = methods;
  const [result, setResult] = useState('');
  // asynchronous validation: a (simulated) availability lookup run on submit — the real check lives on /register (live, against the backend)
  const submit = handleSubmit(async (v) => {
    await new Promise((r) => setTimeout(r, 300));
    if (TAKEN.includes(v.username.toLowerCase())) { setError('username', { message: 'That username is taken (async check)' }); return; }
    setResult(JSON.stringify(v));
  });
  return (
    <FormProvider {...methods}>
      <form onSubmit={submit} noValidate className="space-y-3" aria-label="Forms lab">
        <label className="block text-sm">Username<input {...register('username')} className="ml-2 rounded border border-border bg-surface px-2 py-1" />{errors.username && <span role="alert" className="ml-2 text-red-600">{errors.username.message}</span>}</label>
        {/* Controller: for controlled/third-party inputs that don't expose a native ref */}
        <Controller control={control} name="plan" render={({ field }) => (
          <fieldset className="text-sm"><legend>Plan</legend>{(['free', 'pro'] as const).map((p) => <label key={p} className="mr-3"><input type="radio" checked={field.value === p} onChange={() => field.onChange(p)} onBlur={field.onBlur} /> {p}</label>)}</fieldset>)} />
        <label className="block text-sm">Seats<input type="number" {...register('seats')} className="ml-2 w-20 rounded border border-border bg-surface px-2 py-1" />{errors.seats && <span role="alert" className="ml-2 text-red-600">{errors.seats.message}</span>}</label>
        <Price />
        <CityField />
        <label className="block text-sm">ZIP<input {...register('address.zip')} className="ml-2 rounded border border-border bg-surface px-2 py-1" />{errors.address?.zip && <span role="alert" className="ml-2 text-red-600">{errors.address.zip.message}</span>}</label>
        <button disabled={isSubmitting} className="rounded bg-primary px-4 py-2 text-sm text-white">{isSubmitting ? 'Checking…' : 'Submit'}</button>
        {result && <pre data-testid="result" className="overflow-x-auto rounded bg-black/5 p-2 text-xs">{result}</pre>}
      </form>
    </FormProvider>
  );
}
