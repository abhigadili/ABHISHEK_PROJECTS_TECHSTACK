import { TrainFront } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody } from '@/components/ui/Card';
import type { SearchResult } from '@/types';
import { fmtDuration, fmtTime, inr } from '@/utils/format';
import { BookButton } from './BookButton';

/** Server Component. Only the "Book" button is a Client Component, so the card itself ships no JavaScript. */
export function TrainResultCard({ r }: { r: SearchResult }) {
  return (
    <Card><CardBody className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><TrainFront className="text-indigo-600" /><div><Link href={`/trains/${r.train.id}`} className="font-semibold hover:underline">{r.train.name} <span className="text-slate-400">#{r.train.number}</span></Link><div><Badge tone="indigo">{r.train.type.toLowerCase()}</Badge></div></div></div>
        <div className="flex items-center gap-6 text-center"><div><p className="text-xl font-semibold">{fmtTime(r.from.departure)}</p><p className="text-xs text-slate-500">{r.from.station.code}</p></div><div className="text-xs text-slate-500"><p>{fmtDuration(r.durationMinutes)}</p><div className="my-1 h-px w-20 bg-slate-300" /><p>{r.distanceKm} km</p></div><div><p className="text-xl font-semibold">{fmtTime(r.to.arrival)}</p><p className="text-xs text-slate-500">{r.to.station.code}</p></div></div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {r.classes.map((c) => (
          <div key={c.coachTypeId} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <div><p className="font-medium">{c.name} <span className="text-xs text-slate-400">({c.code})</span></p><p className={`text-xs ${c.available === 0 ? 'text-red-600' : c.available < 10 ? 'text-amber-600' : 'text-emerald-600'}`}>{c.available === 0 ? 'Sold out' : `${c.available} seats left`}</p></div>
            <div className="text-right"><p className="font-semibold">{inr(c.fare)}</p><BookButton result={r} coachTypeId={c.coachTypeId} disabled={c.available === 0} /></div>
          </div>))}
      </div>
    </CardBody></Card>
  );
}
