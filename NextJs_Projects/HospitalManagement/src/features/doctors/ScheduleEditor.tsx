'use client';
import { useState, useTransition } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { saveScheduleAction } from '@/actions/doctors';
import { scheduleSchema, type ScheduleFormValues } from '@/schemas/doctor';
import { DAYS_OF_WEEK, type ScheduleDay } from '@/types';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { emitToast } from '@/components/ui/toast';
import { humanize } from '@/lib/utilities/format';

/** React Hook Form + useFieldArray (dynamic rows, nested field errors) + Zod (cross-field rules: end > start, break inside hours, unique weekday). */
export function ScheduleEditor({ doctorId, initial, readOnly }: { doctorId: number; initial: ScheduleDay[]; readOnly: boolean }) {
  const [pending, start] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, control, handleSubmit, formState: { errors, isDirty } } = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleSchema) as never, mode: 'onBlur',
    defaultValues: { days: initial.map((d) => ({ ...d, breakStart: d.breakStart ?? '', breakEnd: d.breakEnd ?? '' })) },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'days' });
  const used = new Set(fields.map((f) => f.dayOfWeek));
  const submit = handleSubmit((v) => { setServerError(null); start(async () => { const r = await saveScheduleAction(doctorId, v); if (r.ok) emitToast({ kind: 'success', text: r.message! }); else setServerError(r.message ?? 'Failed'); }); });
  const err = (i: number, k: string) => (errors.days?.[i] as Record<string, { message?: string }> | undefined)?.[k]?.message;
  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      {serverError && <p role="alert" className="text-sm text-danger">{serverError}</p>}
      {fields.length === 0 && <p className="text-sm text-muted">No weekly schedule yet.</p>}
      {fields.map((f, i) => (
        <fieldset key={f.id} disabled={readOnly} className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-surface p-3 md:grid-cols-7">
          <div className="md:col-span-1"><label className="text-xs text-muted">Day</label><Select {...register(`days.${i}.dayOfWeek`)}>{DAYS_OF_WEEK.map((d) => <option key={d} value={d}>{humanize(d)}</option>)}</Select><p className="text-xs text-danger">{err(i, 'dayOfWeek')}</p></div>
          {(['startTime', 'endTime'] as const).map((k) => <div key={k}><label className="text-xs text-muted">{k === 'startTime' ? 'Start' : 'End'}</label><Input type="time" {...register(`days.${i}.${k}`)} /><p className="text-xs text-danger">{err(i, k)}</p></div>)}
          <div><label className="text-xs text-muted">Slot (min)</label><Input type="number" {...register(`days.${i}.slotMinutes`)} /><p className="text-xs text-danger">{err(i, 'slotMinutes')}</p></div>
          {(['breakStart', 'breakEnd'] as const).map((k) => <div key={k}><label className="text-xs text-muted">{k === 'breakStart' ? 'Break from' : 'Break to'}</label><Input type="time" {...register(`days.${i}.${k}`)} /><p className="text-xs text-danger">{err(i, k)}</p></div>)}
          {!readOnly && <div className="flex items-end"><Button type="button" variant="ghost" size="icon" aria-label={`Remove ${f.dayOfWeek}`} onClick={() => remove(i)}><Trash2 className="size-4 text-danger" /></Button></div>}
        </fieldset>
      ))}
      {!readOnly && <div className="flex gap-2"><Button type="button" variant="outline" disabled={used.size >= 7} onClick={() => append({ dayOfWeek: DAYS_OF_WEEK.find((d) => !used.has(d)) ?? 'MONDAY', startTime: '09:00', endTime: '13:00', slotMinutes: 30, breakStart: '', breakEnd: '' })}><Plus className="size-4" />Add day</Button><Button type="submit" loading={pending} disabled={!isDirty}>Save schedule</Button></div>}
    </form>
  );
}
