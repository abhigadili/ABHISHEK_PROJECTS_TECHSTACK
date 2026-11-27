'use client';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { FormError } from '@/components/ui/Field';
import { cancelBookingAction } from '@/features/bookings/actions';
import { useToast } from '@/hooks';
import { bookingApi } from '@/services/booking-api';
import { inr } from '@/utils/format';

/**
 * Cancellation dialog. The refund QUOTE comes from Express (TanStack Query, fetched only while the dialog is open - never recalculated here;
 * we only add up the per-passenger fares the backend returned). The cancellation itself is a Server Action that revalidates the account pages.
 */
export function CancelBooking({ bookingId, passengers }: { bookingId: number; passengers: { id: number; name: string; fare: string }[] }) {
  const [open, setOpen] = useState(false); const [picked, setPicked] = useState<number[]>([]); const [err, setErr] = useState<string>();
  const [pending, start] = useTransition(); const router = useRouter(); const toast = useToast();
  const quote = useQuery({ queryKey: ['quote', bookingId], enabled: open, staleTime: 0, queryFn: ({ signal }) => bookingApi.quote(bookingId).then((q) => { void signal; return q; }) });
  const all = picked.length === 0 || picked.length === passengers.length;
  const confirm = () => start(async () => {
    setErr(undefined);
    const r = await cancelBookingAction({ id: bookingId, passengerIds: all ? undefined : picked });
    if (r.ok) { toast('success', 'Cancellation processed', r.message); setOpen(false); setPicked([]); router.refresh(); } else setErr(r.message);
  });
  const q = quote.data; const sel = q ? (all ? q.passengers : q.passengers.filter((p) => picked.includes(p.id))) : [];
  const gross = sel.reduce((s, p) => s + Number(p.fare), 0); const charge = q ? Math.round(gross * q.rule.chargePercent) / 100 : 0;
  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>Cancel ticket</Button>
      <Dialog open={open} onOpenChange={setOpen} title="Cancel ticket" description="Select passengers to cancel (none selected = whole booking)." wide>
        <div className="mt-3 space-y-3">
          <ul className="space-y-1">{passengers.map((p) => <li key={p.id}><label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={picked.includes(p.id)} onChange={() => setPicked((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]))} />{p.name} - {inr(p.fare)}</label></li>)}</ul>
          {quote.isLoading ? <p className="text-sm text-slate-500">Calculating refund…</p> : q && (
            <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800"><p className="text-slate-600 dark:text-slate-300">Rule: {q.rule.label} ({q.rule.chargePercent}% charge) · departs in {q.hoursBefore}h</p><p className="mt-1">Fare: {inr(gross)} · Charge: {inr(charge)}</p><p className="mt-1 text-base font-semibold text-emerald-700">Estimated refund: {inr(gross - charge)}</p></div>)}
          <FormError>{err}</FormError>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Keep ticket</Button><Button variant="danger" loading={pending} onClick={confirm}>Confirm cancellation</Button></div>
        </div>
      </Dialog>
    </>
  );
}
