'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { labTestSchema } from '@/lib/validations/clinical';
import { createLabTestAction } from './actions';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Field, Input, NativeSelect } from '@/components/ui/input';
import { emitToast } from '@/components/ui/toast';
import type { z } from 'zod';
type V = z.input<typeof labTestSchema>;
export function AddTestDialog({ categories }: { categories: { id: number; name: string }[] }) {
  const [open, setOpen] = useState(false); const [p, st] = useTransition(); const r = useRouter();
  const { register, handleSubmit, setError, reset, formState: { errors } } = useForm<V>({ resolver: zodResolver(labTestSchema) as never, defaultValues: { code: '', name: '', categoryId: categories[0]?.id, price: 0, sampleType: '', turnaroundHours: 24 } });
  const submit = handleSubmit((v) => st(async () => { const x = await createLabTestAction(v); if (x.ok) { emitToast({ kind: 'success', text: x.message! }); setOpen(false); reset(); r.refresh(); } else for (const [k, m] of Object.entries(x.fieldErrors ?? {})) setError(k as keyof V, { message: m }); }));
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button>Add test</Button></DialogTrigger><DialogContent title="Add laboratory test"><form onSubmit={submit} className="grid grid-cols-2 gap-3" noValidate><Field label="Code" htmlFor="code" error={errors.code?.message}><Input id="code" {...register('code')} /></Field><Field label="Category" htmlFor="cat" error={errors.categoryId?.message}><NativeSelect id="cat" {...register('categoryId')}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></Field><div className="col-span-2"><Field label="Name" htmlFor="name" error={errors.name?.message}><Input id="name" {...register('name')} /></Field></div><Field label="Price (INR)" htmlFor="price" error={errors.price?.message}><Input id="price" type="number" step="0.01" {...register('price')} /></Field><Field label="Sample type" htmlFor="sample"><Input id="sample" {...register('sampleType')} /></Field><Field label="Turnaround (h)" htmlFor="tat" error={errors.turnaroundHours?.message}><Input id="tat" type="number" {...register('turnaroundHours')} /></Field><div className="col-span-2 flex justify-end"><Button type="submit" loading={p}>Add test</Button></div></form></DialogContent></Dialog>;
}
