'use client';
import { useState, useTransition } from 'react';
import { deactivatePatientAction } from '@/actions/patients';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { emitToast } from '@/components/ui/toast';

/** Confirmation dialog (Radix) -> Server Action. On success the action redirect()s to the list; on failure the message is toasted. */
export function DeactivatePatient({ id, name }: { id: number; name: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="danger">Deactivate patient</Button></DialogTrigger>
      <DialogContent title="Deactivate patient?" description={`${name} will be marked inactive. This is a soft delete handled by the Patient service.`}>
        <div className="flex justify-end gap-2"><DialogClose asChild><Button variant="outline">Keep active</Button></DialogClose>
          <Button variant="danger" loading={pending} onClick={() => start(async () => { const r = await deactivatePatientAction(id); if (r && !r.ok) { emitToast({ kind: 'error', text: r.message ?? 'Failed' }); setOpen(false); } })}>Deactivate</Button></div>
      </DialogContent>
    </Dialog>
  );
}
