'use client';
import { useState, useTransition } from 'react';
import { CalendarOff, Trash2 } from 'lucide-react';
import { addDayOffAction, removeDayOffAction } from '@/actions/doctors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { emitToast } from '@/components/ui/toast';
import { formatDate, todayISO } from '@/lib/utilities/format';
import type { Unavailability } from '@/types';

export function DaysOff({ doctorId, days, canEdit }: { doctorId: number; days: Unavailability[]; canEdit: boolean }) {
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) => start(async () => { const r = await fn(); emitToast({ kind: r.ok ? 'success' : 'error', text: r.message ?? '' }); if (r.ok) { setDate(''); setReason(''); } });
  return (
    <div className="space-y-3">
      <ul className="space-y-2">{days.length === 0 && <li className="text-sm text-muted">No days off scheduled.</li>}{days.map((d) => <li key={d.id} className="flex items-center justify-between rounded-lg border border-line bg-surface px-3 py-2 text-sm"><span className="flex items-center gap-2"><CalendarOff className="size-4 text-warn" />{formatDate(d.date)}{d.reason ? ` · ${d.reason}` : ''}</span>{canEdit && <Button variant="ghost" size="icon" aria-label="Remove day off" disabled={pending} onClick={() => run(() => removeDayOffAction(doctorId, d.id))}><Trash2 className="size-4 text-danger" /></Button>}</li>)}</ul>
      {canEdit && <div className="flex flex-wrap gap-2"><Input type="date" min={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} aria-label="Day off date" className="w-44" /><Input placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} className="w-60" aria-label="Reason" /><Button disabled={!date || pending} onClick={() => run(() => addDayOffAction(doctorId, date, reason))}>Add day off</Button></div>}
    </div>
  );
}
