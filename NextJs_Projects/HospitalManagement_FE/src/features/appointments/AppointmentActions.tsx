'use client';
import { useOptimistic, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { cancelAppointmentAction, rescheduleAppointmentAction } from './actions';
import { get } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/badge';
import { emitToast } from '@/components/ui/toast';
import { todayISO } from '@/lib/utilities/format';
import { msUntil } from '@/lib/utilities/time';
import { cn } from '@/lib/utilities/cn';
import type { SlotDto } from '@/store/slices/bookingSlice';
/** useOptimistic: the status flips to CANCELLED immediately and reverts if the Server Action fails. Reschedule loads slots with TanStack Query. */
export function AppointmentActions({ id, status, startsAt, doctorId, hospitalId }: { id: number; status: string; startsAt: string; doctorId: number; hospitalId: number; base: string }) {
  const router = useRouter(); const [shown, setShown] = useOptimistic(status, (_c, n: string) => n); const [pending, start] = useTransition();
  const [reason, setReason] = useState(''); const [cancelOpen, setCancelOpen] = useState(false); const [resOpen, setResOpen] = useState(false); const [date, setDate] = useState(todayISO()); const [slot, setSlot] = useState('');
  const slots = useQuery({ queryKey: ['slots', doctorId, hospitalId, date], queryFn: ({ signal }) => get<SlotDto[]>('/appointments/slots', { doctorId, hospitalId, date }, signal), enabled: resOpen, staleTime: 10_000 });
  const live = ['PENDING', 'CONFIRMED'].includes(shown); const tooLate = msUntil(startsAt) < 2 * 3600_000; // patients can change appointments up to 2 hours before
  const cancel = () => start(async () => { setCancelOpen(false); setShown('CANCELLED'); const r = await cancelAppointmentAction(id, reason); emitToast({ kind: r.ok ? 'success' : 'error', text: r.message ?? '' }); router.refresh(); });
  const reschedule = () => start(async () => { const r = await rescheduleAppointmentAction(id, slot); emitToast({ kind: r.ok ? 'success' : 'error', text: r.message ?? '' }); if (r.ok) { setResOpen(false); router.refresh(); } });
  return <div className="space-y-2 border-t border-line pt-4">{shown !== status && <p className="text-sm">Status: <StatusBadge status={shown} /> <span className="text-muted">(updating…)</span></p>}{live && tooLate && <p className="text-sm text-muted">Changes are no longer possible within 2 hours of the visit.</p>}
    {live && !tooLate && <div className="flex flex-wrap gap-2">
      <Dialog open={resOpen} onOpenChange={setResOpen}><DialogTrigger asChild><Button variant="outline">Reschedule</Button></DialogTrigger><DialogContent title="Reschedule appointment" description="Pick a new free slot with the same doctor."><div className="space-y-3"><Input type="date" aria-label="New date" min={todayISO()} value={date} onChange={(e) => { setDate(e.target.value); setSlot(''); }} />{slots.isPending ? <p className="text-sm text-muted">Loading…</p> : (slots.data?.data ?? []).length === 0 ? <p className="text-sm text-muted">No slots that day.</p> : <ul className="flex flex-wrap gap-2">{slots.data!.data.map((x) => <li key={x.startsAt}><button type="button" disabled={!x.available} onClick={() => setSlot(x.startsAt)} aria-pressed={slot === x.startsAt} className={cn('num cursor-pointer rounded-lg border px-3 py-1.5 text-sm disabled:line-through disabled:opacity-40', slot === x.startsAt ? 'border-primary bg-primary text-primary-fg' : 'border-line hover:bg-surface2')}>{x.label}</button></li>)}</ul>}<div className="flex justify-end gap-2"><DialogClose asChild><Button variant="outline">Close</Button></DialogClose><Button disabled={!slot} loading={pending} onClick={reschedule}>Confirm new time</Button></div></div></DialogContent></Dialog>
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}><DialogTrigger asChild><Button variant="danger">Cancel appointment</Button></DialogTrigger><DialogContent title="Cancel this appointment?" description="The slot becomes available to others immediately."><Textarea placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} /><div className="mt-4 flex justify-end gap-2"><DialogClose asChild><Button variant="outline">Keep it</Button></DialogClose><Button variant="danger" onClick={cancel}>Yes, cancel</Button></div></DialogContent></Dialog></div>}</div>;
}
