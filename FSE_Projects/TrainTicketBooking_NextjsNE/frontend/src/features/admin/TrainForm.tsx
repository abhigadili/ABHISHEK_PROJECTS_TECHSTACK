'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Field, FormError, Input, Select } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Feedback';
import { useToast } from '@/hooks';
import { trainApi } from '@/services/train-api';
import { useCoachTypesQuery, useStationsQuery } from '@/store/api';
import { applyServerErrors } from '@/utils/forms';
import { label } from '@/utils/format';
import { trainSchema, trainStatuses, trainTypes } from '@/validations/catalog';
import { revalidateCatalogAction } from './actions';

type Values = z.input<typeof trainSchema>;
interface TrainFull { id: number; number: string; name: string; type: string; status?: string; route?: { stops: { stationId: number; arrivalTime: string | null; departureTime: string | null; dayOffset: number; distanceKm: number }[] } }
const emptyStop = { stationId: '' as never, arrivalTime: '', departureTime: '', dayOffset: 0, distanceKm: 0 };

/** Add / edit a train together with its ROUTE (ordered stops with times, day offset and distance) - nested objects + dynamic form arrays. */
export function TrainForm({ trainId }: { trainId?: number }) {
  const existing = useQuery({ queryKey: ['admin', 'train', trainId], enabled: !!trainId, staleTime: 0, queryFn: () => trainApi.one<TrainFull>(trainId!) });
  if (trainId && existing.isLoading) return <Skeleton className="h-64" />;
  return <Inner trainId={trainId} t={existing.data} />;
}
function Inner({ trainId, t }: { trainId?: number; t?: TrainFull }) {
  const router = useRouter(); const qc = useQueryClient(); const toast = useToast(); const stations = useStationsQuery(); const coachTypes = useCoachTypesQuery(); const [err, setErr] = useState<string>();
  const { register, control, handleSubmit, setError, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(trainSchema) as never,
    defaultValues: trainId && t ? { number: t.number, name: t.name, type: t.type as never, status: (t.status ?? 'ACTIVE') as never, route: { name: `${t.name} route`, stops: (t.route?.stops ?? []).map((s) => ({ ...s, arrivalTime: s.arrivalTime ?? '', departureTime: s.departureTime ?? '' })) as never } }
      : { number: '', name: '', type: 'EXPRESS', status: 'ACTIVE', route: { name: '', stops: [{ ...emptyStop }, { ...emptyStop }] }, coaches: [{ coachTypeId: 1, count: 2 }], operatingDays: [0, 1, 2, 3, 4, 5, 6] },
  });
  const stops = useFieldArray({ control, name: 'route.stops' }); const coaches = useFieldArray({ control, name: 'coaches' });
  const save = useMutation({ mutationFn: (body: Record<string, unknown>) => (trainId ? trainApi.update(trainId, body) : trainApi.create(body)) });
  const clean = (v: Values) => ({ ...v, route: v.route && { ...v.route, name: v.route.name || `${v.name} route`, stops: v.route.stops.map((s, i, a) => ({ ...s, arrivalTime: i === 0 ? null : s.arrivalTime || null, departureTime: i === a.length - 1 ? null : s.departureTime || null })) } });
  return (
    <form noValidate className="space-y-6" onSubmit={handleSubmit(async (v) => {
      try { const { number: _n, coaches: _c, operatingDays: _o, ...edit } = clean(v); await save.mutateAsync(trainId ? edit : clean(v)); await revalidateCatalogAction('trains', trainId); await qc.invalidateQueries({ queryKey: ['admin'] }); toast('success', trainId ? 'Train updated' : 'Train created'); router.push('/admin/trains'); router.refresh(); }
      catch (e) { setErr(applyServerErrors(e, setError)); } }, () => setErr('Some fields need attention - see the highlighted messages below.'))}>
      <FormError>{err}</FormError>
      <Card><CardHeader><CardTitle>Train</CardTitle></CardHeader><CardBody className="grid gap-3 sm:grid-cols-4">
        <Field label="Number" error={errors.number?.message}><Input {...register('number')} disabled={!!trainId} /></Field><Field className="sm:col-span-2" label="Name" error={errors.name?.message}><Input {...register('name')} /></Field>
        <Field label="Type" error={errors.type?.message}><Select {...register('type')}>{trainTypes.map((x) => <option key={x} value={x}>{label(x)}</option>)}</Select></Field>
        {trainId && <Field label="Status"><Select {...register('status')}>{trainStatuses.map((x) => <option key={x} value={x}>{label(x)}</option>)}</Select></Field>}
      </CardBody></Card>
      <Card><CardHeader><CardTitle>Route stops</CardTitle><Button type="button" size="sm" variant="outline" onClick={() => stops.append({ ...emptyStop })}><Plus size={14} />Add stop</Button></CardHeader><CardBody className="space-y-2">
        {errors.route?.stops?.root?.message && <FormError>{errors.route.stops.root.message}</FormError>}
        {stops.fields.map((f, i) => (
          <div key={f.id} className="grid items-start gap-2 rounded-lg border border-slate-200 p-2 sm:grid-cols-[2fr_1fr_1fr_70px_90px_36px] dark:border-slate-700">
            <Field label={i === 0 ? 'Station' : ' '} error={errors.route?.stops?.[i]?.stationId?.message}><Select {...register(`route.stops.${i}.stationId`)}><option value="">Select…</option>{(stations.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}</Select></Field>
            <Field label={i === 0 ? 'Arrives' : ' '} error={errors.route?.stops?.[i]?.arrivalTime?.message}><Input type="time" disabled={i === 0} {...register(`route.stops.${i}.arrivalTime`)} /></Field>
            <Field label={i === 0 ? 'Departs' : ' '} error={errors.route?.stops?.[i]?.departureTime?.message}><Input type="time" disabled={i === stops.fields.length - 1} {...register(`route.stops.${i}.departureTime`)} /></Field>
            <Field label={i === 0 ? 'Day +' : ' '}><Input type="number" min={0} max={5} {...register(`route.stops.${i}.dayOffset`)} /></Field>
            <Field label={i === 0 ? 'Km' : ' '} error={errors.route?.stops?.[i]?.distanceKm?.message}><Input type="number" min={0} {...register(`route.stops.${i}.distanceKm`)} /></Field>
            <Button type="button" variant="ghost" size="icon" className="mt-[26px]" aria-label={`Remove stop ${i + 1}`} disabled={stops.fields.length <= 2} onClick={() => stops.remove(i)}><Trash2 size={16} /></Button></div>))}
      </CardBody></Card>
      {!trainId && <Card><CardHeader><CardTitle>Coaches</CardTitle><Button type="button" size="sm" variant="outline" onClick={() => coaches.append({ coachTypeId: 1, count: 1 })}><Plus size={14} />Add</Button></CardHeader><CardBody className="space-y-2">
        {coaches.fields.map((f, i) => <div key={f.id} className="flex gap-2"><Select aria-label="Coach type" {...register(`coaches.${i}.coachTypeId`)}>{(coachTypes.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code}) · {c.seatsPerCoach} seats</option>)}</Select><Input aria-label="Number of coaches" className="w-24" type="number" min={1} max={20} {...register(`coaches.${i}.count`)} /><Button type="button" variant="ghost" size="icon" aria-label="Remove coach row" onClick={() => coaches.remove(i)}><Trash2 size={16} /></Button></div>)}
      </CardBody></Card>}
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => router.push('/admin/trains')}>Cancel</Button><Button type="submit" loading={save.isPending}>Save train</Button></div>
    </form>
  );
}
