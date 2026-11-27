'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cancelInvoiceAction, refundPaymentAction } from './actions';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/input';
import { emitToast } from '@/components/ui/toast';
export function RefundButton({ paymentId, max }: { paymentId: number; max: number }) {
  const r = useRouter(); const [open, setOpen] = useState(false); const [amount, setAmount] = useState(String(max)); const [reason, setReason] = useState(''); const [err, setErr] = useState<Record<string, string>>({}); const [p, st] = useTransition();
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button size="sm" variant="outline">Refund</Button></DialogTrigger><DialogContent title="Record a refund" description={`Up to ${max.toFixed(2)} can be refunded.`}><div className="space-y-3"><Field label="Amount" htmlFor="ra" error={err.amount}><Input id="ra" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field><Field label="Reason" htmlFor="rr" error={err.reason}><Input id="rr" value={reason} onChange={(e) => setReason(e.target.value)} /></Field><div className="flex justify-end gap-2"><DialogClose asChild><Button variant="outline">Close</Button></DialogClose><Button loading={p} onClick={() => st(async () => { const x = await refundPaymentAction(paymentId, { amount, reason }); setErr(x.fieldErrors ?? {}); emitToast({ kind: x.ok ? 'success' : 'error', text: x.message ?? '' }); if (x.ok) { setOpen(false); r.refresh(); } })}>Refund</Button></div></div></DialogContent></Dialog>;
}
export function CancelInvoiceButton({ id }: { id: number }) { const r = useRouter(); const [p, st] = useTransition(); return <Button variant="danger" size="sm" loading={p} onClick={() => { if (confirm('Cancel this invoice?')) st(async () => { const x = await cancelInvoiceAction(id); emitToast({ kind: x.ok ? 'success' : 'error', text: x.message ?? '' }); r.refresh(); }); }}>Cancel invoice</Button>; }
