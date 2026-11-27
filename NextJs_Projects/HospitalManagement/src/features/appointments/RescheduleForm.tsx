'use client';
import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { rescheduleAppointmentAction } from '@/actions/appointments';
import { useSlots } from './hooks';
import { groupSlots } from '@/lib/utilities/slots';
import { Input } from '@/components/ui/input';
import { SubmitButton } from '@/features/SubmitButton';
import { Alert, EmptyState } from '@/components/ui/empty-state';
import { emitToast } from '@/components/ui/toast';
import { todayISO } from '@/lib/utilities/format';
import { cn } from '@/lib/utilities/cn';
import type { Appointment } from '@/types';
import type { ActionState } from '@/lib/actions/state';

export function RescheduleForm({ appointment }: { appointment: Appointment }) {
  const router = useRouter();
  const [date, setDate] = useState(appointment.date >= todayISO() ? appointment.date : todayISO());
  const [time, setTime] = useState('');
  const slots = useSlots(appointment.doctorId, date);
  const [s, action] = useActionState<ActionState<Appointment>, FormData>(rescheduleAppointmentAction, { ok: false });
  useEffect(() => { if (s.ok) { emitToast({ kind: 'success', text: s.message! }); router.push(`/appointments/${appointment.id}`); } }, [s, router, appointment.id]);
  return (
    <form action={action} className="max-w-2xl space-y-4"><input type="hidden" name="id" value={appointment.id} /><input type="hidden" name="startTime" value={time} />
      {s.message && !s.ok && <Alert tone="danger">{s.message}</Alert>}
      <div><label htmlFor="date" className="mb-1 block text-sm font-medium">New date</label><Input id="date" name="date" type="date" min={todayISO()} className="w-48" value={date} onChange={(e) => { setDate(e.target.value); setTime(''); }} /></div>
      {slots.isPending ? <p className="text-sm text-muted">Loading slots…</p> : groupSlots(slots.data ?? []).length === 0 ? <EmptyState title="No slots on this date" /> : groupSlots(slots.data ?? []).map((g) => <div key={g.period}><p className="mb-1 text-sm font-medium">{g.period}</p><div className="flex flex-wrap gap-2">{g.slots.map((x) => <button key={x.startTime} type="button" disabled={!x.available} onClick={() => setTime(x.startTime)} aria-pressed={time === x.startTime} className={cn('num rounded-lg border px-3 py-1.5 text-sm disabled:line-through disabled:opacity-40', time === x.startTime ? 'border-primary bg-primary text-primary-fg' : 'border-line hover:bg-surface2')}>{x.startTime}</button>)}</div></div>)}
      <SubmitButton disabled={!time} pendingText="Rescheduling…">Confirm new time</SubmitButton>
    </form>
  );
}
