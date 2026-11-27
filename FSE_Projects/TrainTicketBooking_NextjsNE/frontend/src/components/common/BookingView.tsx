import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, TBody, TD, THead, TH, TR } from '@/components/ui/Table';
import type { Booking } from '@/types';
import { fmtDate, fmtDateTime, fmtTime, inr } from '@/utils/format';
import { CancelBooking } from './CancelBooking';
import { PrintButton } from './PrintButton';

/** Ticket / booking detail rendered on the server (used by the full page AND the intercepted modal). Interactive bits are small client islands. */
export function BookingView({ b, justBooked, compact }: { b: Booking; justBooked?: boolean; compact?: boolean }) {
  const active = b.passengers.filter((p) => p.status === 'CONFIRMED'); const canCancel = ['CONFIRMED', 'PARTIALLY_CANCELLED'].includes(b.status) && active.length > 0 && new Date(b.departureAt) > new Date();
  return (
    <div className="space-y-6">
      {justBooked && <div role="status" className="flex items-center gap-2 rounded-lg bg-emerald-50 p-4 text-emerald-800"><CheckCircle2 />Booking confirmed! Your PNR is <strong className="font-mono">{b.pnr?.pnr}</strong>.</div>}
      <Card><CardHeader><CardTitle>{b.train.name} <span className="text-slate-400">#{b.train.number}</span></CardTitle><StatusBadge status={b.status} /></CardHeader>
        <CardBody className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-4"><div><p className="text-xs text-slate-500">PNR</p><p className="font-mono text-lg font-bold tracking-wider">{b.pnr?.pnr ?? '—'}</p></div><div><p className="text-xs text-slate-500">Journey date</p><p className="font-semibold">{fmtDate(b.journeyDate)}</p></div><div><p className="text-xs text-slate-500">From → To</p><p className="font-semibold">{b.fromStation.name} → {b.toStation.name}</p></div><div><p className="text-xs text-slate-500">Departure</p><p className="font-semibold">{fmtTime(b.departureAt)}</p></div></div>
          <Table><THead><tr><TH>Passenger</TH><TH>Age/Gender</TH><TH>Coach / seat</TH><TH>Status</TH><TH className="text-right">Fare</TH></tr></THead>
            <TBody>{b.passengers.map((p) => <TR key={p.id}><TD className="font-medium">{p.name}</TD><TD>{p.age} / {p.gender[0]}</TD><TD>{p.seat?.seat ? `${p.seat.seat.coach?.number}-${p.seat.seat.seatNumber} ${p.seat.seat.seatType?.name ?? ''}` : '—'}</TD><TD><StatusBadge status={p.status} /></TD><TD className="text-right">{inr(p.fare)}</TD></TR>)}</TBody></Table>
          <p className="flex justify-between border-t pt-3 font-semibold"><span>Total</span><span>{inr(b.totalAmount)}</span></p>
          {b.status === 'PENDING_PAYMENT' && <div className="flex items-center justify-between rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><span>Payment pending - seats are held for a short time.</span><Button size="sm" asChild><Link href={`/book/${b.id}/pay`}>Pay now</Link></Button></div>}
          <div className="flex flex-wrap gap-2 print:hidden"><PrintButton />{canCancel && <CancelBooking bookingId={b.id} passengers={active.map((p) => ({ id: p.id, name: p.name, fare: p.fare }))} />}</div>
        </CardBody></Card>
      {!compact && b.payments && b.payments.length > 0 && <Card className="print:hidden"><CardHeader><CardTitle>Payments</CardTitle></CardHeader><CardBody className="space-y-2 text-sm">{b.payments.map((p) => <div key={p.id} className="flex flex-wrap justify-between gap-2"><span><span className="font-mono">{p.reference}</span> · {p.method.replace('_', ' ').toLowerCase()}{p.cardLast4 ? ` ····${p.cardLast4}` : ''} · {fmtDateTime(p.createdAt)}</span><span className="flex items-center gap-2"><StatusBadge status={p.status} />{inr(p.amount)}</span></div>)}</CardBody></Card>}
    </div>
  );
}
