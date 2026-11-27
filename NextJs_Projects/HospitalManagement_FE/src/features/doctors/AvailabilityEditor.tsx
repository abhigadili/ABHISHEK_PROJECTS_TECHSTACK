'use client';
import { useState, useTransition } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { availabilitySchema, type AvailabilityFormValues } from '@/lib/validations/doctor';
import { addTimeOffAction, removeTimeOffAction, saveAvailabilityAction } from './actions';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import { emitToast } from '@/components/ui/toast';
import { todayISO } from '@/lib/utilities/format';
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
interface Props { doctorId: number; hospitals: { id: number; name: string }[]; initial: { hospitalId: number; days: { dayOfWeek: number; startTime: string; endTime: string; slotMinutes: number; breakStart: string; breakEnd: string }[] }[]; timeOff: { id: number; date: string; reason: string }[] }
/** Scenario 3: working days, hours, consultation duration (slot minutes), break (React Hook Form + useFieldArray + Zod) and days off. */
export function AvailabilityEditor({ doctorId, hospitals, initial, timeOff }: Props) {
  const [hid, setHid] = useState(hospitals[0]?.id ?? 0); const [p, st] = useTransition(); const [d, setD] = useState(''); const [why, setWhy] = useState('');
  const { register, control, handleSubmit, reset, formState: { errors, isDirty } } = useForm<AvailabilityFormValues>({ resolver: zodResolver(availabilitySchema) as never, defaultValues: { hospitalId: hid, days: initial.find((i) => i.hospitalId === hid)?.days ?? [] } });
  const { fields, append, remove } = useFieldArray({ control, name: 'days' });
  const used = new Set(fields.map((f) => Number(f.dayOfWeek)));
  const switchHospital = (id: number) => { setHid(id); reset({ hospitalId: id, days: initial.find((i) => i.hospitalId === id)?.days ?? [] }); };
  const err = (i: number, k: string) => (errors.days?.[i] as Record<string, { message?: string }> | undefined)?.[k]?.message;
  const save = handleSubmit((v) => st(async () => { const r = await saveAvailabilityAction(doctorId, { ...v, hospitalId: hid }); emitToast({ kind: r.ok ? 'success' : 'error', text: r.message ?? '' }); if (r.ok) reset(v); }));
  return (
    <div className="space-y-8">
      <form onSubmit={save} className="space-y-3" noValidate>
        {hospitals.length > 1 && <NativeSelect aria-label="Hospital" className="w-64" value={hid} onChange={(e) => switchHospital(Number(e.target.value))}>{hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</NativeSelect>}
        {fields.length === 0 && <p className="text-sm text-muted">No working days configured - patients cannot book you at this hospital.</p>}
        {fields.map((f, i) => <fieldset key={f.id} className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-surface p-3 md:grid-cols-7"><div><label className="text-xs text-muted">Day</label><NativeSelect {...register(`days.${i}.dayOfWeek`)}>{DAYS.map((x, n) => <option key={x} value={n}>{x}</option>)}</NativeSelect><p className="text-xs text-danger">{err(i, 'dayOfWeek')}</p></div>{(['startTime', 'endTime'] as const).map((k) => <div key={k}><label className="text-xs text-muted">{k === 'startTime' ? 'Start' : 'End'}</label><Input type="time" {...register(`days.${i}.${k}`)} /><p className="text-xs text-danger">{err(i, k)}</p></div>)}<div><label className="text-xs text-muted">Slot (min)</label><Input type="number" {...register(`days.${i}.slotMinutes`)} /><p className="text-xs text-danger">{err(i, 'slotMinutes')}</p></div>{(['breakStart', 'breakEnd'] as const).map((k) => <div key={k}><label className="text-xs text-muted">{k === 'breakStart' ? 'Break from' : 'Break to'}</label><Input type="time" {...register(`days.${i}.${k}`)} /><p className="text-xs text-danger">{err(i, k)}</p></div>)}<div className="flex items-end"><Button type="button" variant="ghost" size="icon" aria-label={`Remove ${DAYS[Number(f.dayOfWeek)]}`} onClick={() => remove(i)}><Trash2 className="size-4 text-danger" /></Button></div></fieldset>)}
        <div className="flex gap-2"><Button type="button" variant="outline" disabled={used.size >= 7} onClick={() => append({ dayOfWeek: [1, 2, 3, 4, 5, 6, 0].find((x) => !used.has(x)) ?? 1, startTime: '09:00', endTime: '13:00', slotMinutes: 30, breakStart: '', breakEnd: '' })}><Plus className="size-4" />Add day</Button><Button type="submit" loading={p} disabled={!isDirty}>Save availability</Button></div>
      </form>
      <div className="space-y-3"><h2 className="font-semibold">Days off</h2><ul className="space-y-2">{timeOff.length === 0 && <li className="text-sm text-muted">No days off scheduled.</li>}{timeOff.map((t) => <li key={t.id} className="flex items-center justify-between rounded-lg border border-line bg-surface px-3 py-2 text-sm"><span>{t.date}{t.reason ? ` · ${t.reason}` : ''}</span><Button variant="ghost" size="icon" aria-label="Remove day off" disabled={p} onClick={() => st(async () => { const r = await removeTimeOffAction(doctorId, t.id); emitToast({ kind: r.ok ? 'success' : 'error', text: r.message ?? '' }); })}><Trash2 className="size-4 text-danger" /></Button></li>)}</ul><div className="flex flex-wrap gap-2"><Input type="date" min={todayISO()} aria-label="Day off date" className="w-44" value={d} onChange={(e) => setD(e.target.value)} /><Input placeholder="Reason (optional)" aria-label="Reason" className="w-60" value={why} onChange={(e) => setWhy(e.target.value)} /><Button disabled={!d || p} onClick={() => st(async () => { const r = await addTimeOffAction(doctorId, { date: d, reason: why }); emitToast({ kind: r.ok ? 'success' : 'error', text: r.message ?? '' }); if (r.ok) { setD(''); setWhy(''); } })}>Add day off</Button></div></div>
    </div>
  );
}
