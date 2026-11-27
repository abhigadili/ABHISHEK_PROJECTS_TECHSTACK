import { CheckCircle2, Printer } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { ErrorState, PageLoader } from '@/components/ui/Feedback';
import { FormError } from '@/components/ui/Field';
import { useCountdown, useDocumentTitle, useToast } from '@/hooks';
import { toApiError } from '@/services/api';
import { useBooking, useCancelBooking, useQuote } from '@/services/queries';
import { fmtDate, fmtDateTime, fmtTime, inr } from '@/utils/format';

export default function BookingDetail() {
  const { id } = useParams(); const loc = useLocation(); const toast = useToast(); const { data: b, isLoading, error, refetch } = useBooking(id); useDocumentTitle(b?.pnr ? `PNR ${b.pnr.pnr}` : 'Booking');
  const [open, setOpen] = useState(false); const [picked, setPicked] = useState<number[]>([]); const [err, setErr] = useState<string>();
  const cancel = useCancelBooking(); const left = useCountdown(b?.status === 'PENDING_PAYMENT' ? b.expiresAt : null);
  const active = b?.passengers.filter((p) => p.status === 'CONFIRMED') ?? []; const canCancel = !!b && ['CONFIRMED', 'PARTIALLY_CANCELLED'].includes(b.status) && active.length > 0 && new Date(b.departureAt) > new Date();
  const quote = useQuote(Number(id), open);
  if (isLoading) return <PageLoader />; if (error || !b) return <ErrorState error={error} onRetry={refetch} />;
  const all = picked.length === 0 || picked.length === active.length;
  const qPassengers = quote.data?.passengers ?? [];
  const doCancel = async () => {
    setErr(undefined);
    try { await cancel.mutateAsync({ id: b.id, passengerIds: all ? undefined : picked, reason: 'Cancelled by passenger' }); toast('success', 'Cancellation processed', 'Your refund has been initiated.'); setOpen(false); setPicked([]); }
    catch (e) { setErr(toApiError(e).message); }
  };
  return (
    <div className="space-y-6">
      {(loc.state as { justBooked?: boolean } | null)?.justBooked && <div role="status" className="flex items-center gap-2 rounded-lg bg-emerald-50 p-4 text-emerald-800"><CheckCircle2 />Booking confirmed! Your PNR is <strong>{b.pnr?.pnr}</strong>.</div>}
      <Card className="print:shadow-none"><CardHeader><div><CardTitle>{b.train.name} <span className="text-slate-400">#{b.train.number}</span></CardTitle></div><StatusBadge status={b.status} /></CardHeader>
        <CardBody className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-4"><div><p className="text-xs text-slate-500">PNR</p><p className="text-lg font-bold tracking-wider">{b.pnr?.pnr ?? '—'}</p></div><div><p className="text-xs text-slate-500">Journey date</p><p className="font-semibold">{fmtDate(b.journeyDate)}</p></div><div><p className="text-xs text-slate-500">From → To</p><p className="font-semibold">{b.fromStation.name} → {b.toStation.name}</p></div><div><p className="text-xs text-slate-500">Departure</p><p className="font-semibold">{fmtTime(b.departureAt)}</p></div></div>
          <table className="w-full text-sm"><thead className="text-left text-slate-500"><tr><th className="py-1">Passenger</th><th>Age/Gender</th><th>Seat</th><th>Status</th><th className="text-right">Fare</th></tr></thead>
            <tbody>{b.passengers.map((p) => <tr key={p.id} className="border-t"><td className="py-2 font-medium">{p.name}</td><td>{p.age} / {p.gender[0]}</td><td>{p.seat?.seat ? `${p.seat.seat.coach?.number}-${p.seat.seat.seatNumber} ${p.seat.seat.seatType?.name ?? ''}` : '—'}</td><td><StatusBadge status={p.status} /></td><td className="text-right">{inr(p.fare)}</td></tr>)}</tbody></table>
          <p className="flex justify-between border-t pt-3 font-semibold"><span>Total paid</span><span>{inr(b.totalAmount)}</span></p>
          {b.status === 'PENDING_PAYMENT' && <div className="flex items-center justify-between rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><span>{left > 0 ? `Payment pending - seats held for ${Math.floor(left / 60)}m ${left % 60}s` : 'The seat hold has expired.'}</span>{left > 0 && <Button size="sm" asChild><Link to={`/book/${b.id}/pay`}>Pay now</Link></Button>}</div>}
          <div className="flex flex-wrap gap-2 print:hidden"><Button variant="outline" onClick={() => window.print()}><Printer size={16} />Print ticket</Button>{canCancel && <Button variant="danger" onClick={() => setOpen(true)}>Cancel ticket</Button>}</div>
        </CardBody></Card>
      {b.payments && b.payments.length > 0 && <Card className="print:hidden"><CardHeader><CardTitle>Payments</CardTitle></CardHeader><CardBody className="space-y-2 text-sm">{b.payments.map((p) => <div key={p.id} className="flex flex-wrap justify-between gap-2"><span>{p.reference} · {p.method.replace('_', ' ').toLowerCase()}{p.cardLast4 ? ` ····${p.cardLast4}` : ''} · {fmtDateTime(p.createdAt)}</span><span className="flex items-center gap-2"><StatusBadge status={p.status} />{inr(p.amount)}</span></div>)}</CardBody></Card>}
      <Dialog open={open} onOpenChange={setOpen} title="Cancel ticket" description="Select passengers to cancel (none selected = whole booking)." wide>
        <div className="mt-3 space-y-3">
          <ul className="space-y-1">{active.map((p) => <li key={p.id}><label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={picked.includes(p.id)} onChange={() => setPicked((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]))} />{p.name} - {inr(p.fare)}</label></li>)}</ul>
          {quote.isLoading ? <p className="text-sm text-slate-500">Calculating refund…</p> : quote.data && (
            <div className="rounded-lg bg-slate-50 p-3 text-sm"><p className="text-slate-600">Rule: {quote.data.rule.label} ({quote.data.rule.chargePercent}% charge) · departs in {quote.data.hoursBefore}h</p>
              {(() => { const sel = all ? qPassengers : qPassengers.filter((p) => picked.includes(p.id)); const g = sel.reduce((s, p) => s + Number(p.fare), 0); const c = Math.round(g * quote.data.rule.chargePercent) / 100; return <><p className="mt-1">Fare: {inr(g)} · Charge: {inr(c)}</p><p className="mt-1 text-base font-semibold text-emerald-700">Estimated refund: {inr(g - c)}</p></>; })()}</div>)}
          <FormError>{err}</FormError>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Keep ticket</Button><Button variant="danger" loading={cancel.isPending} onClick={doCancel}>Confirm cancellation</Button></div>
        </div>
      </Dialog>
    </div>
  );
}
