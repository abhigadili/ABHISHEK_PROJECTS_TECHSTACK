import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { StatusBadge } from '@/components/ui/Badge';
import { Card, CardBody } from '@/components/ui/Card';
import type { Booking } from '@/types';
import { fmtDate, fmtTime, inr } from '@/utils/format';

export const BookingCard = ({ b, href }: { b: Booking; href?: string }) => (
  <Link href={href ?? `/account/bookings/${b.id}`} className="block"><Card className="transition-shadow hover:shadow-md"><CardBody className="flex flex-wrap items-center justify-between gap-3">
    <div className="min-w-0"><p className="font-semibold">{b.train.name} <span className="text-slate-400">#{b.train.number}</span></p>
      <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-600 dark:text-slate-300">{b.fromStation.code} <ArrowRight size={14} /> {b.toStation.code} · {fmtDate(b.journeyDate)} · {fmtTime(b.departureAt)}</p>
      <p className="mt-0.5 text-xs text-slate-500">{b.passengers.length} passenger{b.passengers.length > 1 ? 's' : ''}{b.pnr ? <> · PNR <span className="font-mono">{b.pnr.pnr}</span></> : ''}</p></div>
    <div className="text-right"><StatusBadge status={b.status} /><p className="mt-1 font-semibold">{inr(b.totalAmount)}</p></div>
  </CardBody></Card></Link>
);
