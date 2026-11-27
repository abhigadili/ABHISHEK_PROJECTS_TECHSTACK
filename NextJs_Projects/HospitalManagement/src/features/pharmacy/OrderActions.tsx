'use client';
import { useActionState, useState, useTransition } from 'react';
import { dispenseOrderAction, rejectOrderAction } from '@/actions/pharmacy';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Field, Textarea } from '@/components/ui/input';
import { SubmitButton } from '@/features/SubmitButton';
import { emitToast } from '@/components/ui/toast';
import type { ActionState } from '@/lib/actions/state';

export function OrderActions({ id, canAct, inStock }: { id: number; canAct: boolean; inStock: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [s, action] = useActionState<ActionState, FormData>(async (prev, fd) => { const r = await rejectOrderAction(id, prev, fd); if (r.ok) { emitToast({ kind: 'success', text: r.message! }); setOpen(false); } return r; }, { ok: false });
  if (!canAct) return null;
  return (
    <div className="flex gap-2">
      <Button loading={pending} disabled={!inStock} title={inStock ? undefined : 'Some medicines are out of stock'} onClick={() => start(async () => { const r = await dispenseOrderAction(id); emitToast({ kind: r.ok ? 'success' : 'error', text: r.message ?? '' }); })}>Dispense</Button>
      <Button variant="danger" onClick={() => setOpen(true)}>Reject</Button>
      <Dialog open={open} onOpenChange={setOpen}><DialogContent title="Reject order"><form action={action} className="space-y-3"><Field label="Reason" htmlFor="reason" error={s.fieldErrors?.reason}><Textarea id="reason" name="reason" rows={3} /></Field><div className="flex justify-end"><SubmitButton variant="danger" pendingText="Rejecting…">Reject order</SubmitButton></div></form></DialogContent></Dialog>
    </div>
  );
}
