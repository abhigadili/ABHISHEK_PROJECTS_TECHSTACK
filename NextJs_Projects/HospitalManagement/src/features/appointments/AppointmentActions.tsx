'use client';
import Link from 'next/link';
import { useActionState, useEffect, useOptimistic, useState, useTransition } from 'react';
import { cancelAppointmentAction, completeAppointmentAction } from '@/actions/appointments';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/input';
import { SubmitButton } from '@/features/SubmitButton';
import { StatusBadge } from '@/components/ui/badge';
import { emitToast } from '@/components/ui/toast';
import { useAuth } from '@/components/providers/AuthProvider';
import type { Appointment } from '@/types';
import type { ActionState } from '@/lib/actions/state';

/** useOptimistic: the status badge flips to CANCELLED the instant the Server Action starts and reverts automatically if it fails. */
export function AppointmentActions({ appointment }: { appointment: Appointment }) {
  const { can } = useAuth();
  const [status, setOptimistic] = useOptimistic(appointment.status, (_cur, next: Appointment['status']) => next);
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [done, completeAction] = useActionState<ActionState<Appointment>, FormData>(completeAppointmentAction, { ok: false });
  useEffect(() => { if (done.message) emitToast({ kind: done.ok ? 'success' : 'error', text: done.message }); }, [done]);
  const cancel = () => start(async () => { setOpen(false); setOptimistic('CANCELLED'); const r = await cancelAppointmentAction(appointment.id, reason); emitToast({ kind: r.ok ? 'success' : 'error', text: r.message ?? '' }); });
  const live = status === 'BOOKED';
  return (
    <div className="space-y-3 border-t border-line pt-4">
      {status !== appointment.status && <p className="text-sm">Status: <StatusBadge status={status} /> <span className="text-muted">(updating…)</span></p>}
      <div className="flex flex-wrap gap-2">
        {live && can('appointments:manage') && <Button asChild variant="outline"><Link href={`/appointments/${appointment.id}/reschedule`}>Reschedule</Link></Button>}
        {live && can('appointments:manage') && (
          <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="danger" disabled={pending}>Cancel appointment</Button></DialogTrigger>
            <DialogContent title="Cancel this appointment?" description="The time slot becomes available to other patients immediately."><Textarea placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} /><div className="mt-4 flex justify-end gap-2"><DialogClose asChild><Button variant="outline">Keep it</Button></DialogClose><Button variant="danger" onClick={cancel}>Yes, cancel</Button></div></DialogContent></Dialog>
        )}
      </div>
      {live && can('appointments:complete') && (
        <form action={completeAction} className="max-w-md space-y-2"><input type="hidden" name="id" value={appointment.id} /><Textarea name="notes" placeholder="Visit notes (optional)" /><SubmitButton variant="default" pendingText="Completing…">Mark as completed</SubmitButton><p className="text-xs text-muted">Only possible once the appointment time has started (backend rule).</p></form>
      )}
    </div>
  );
}
