import type { Metadata } from 'next';
import { Banknote, Ticket, TrainFront, Users } from 'lucide-react';
import { Suspense } from 'react';
import { StatusBadge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { PageHeader, Skeleton } from '@/components/ui/Feedback';
import { getStats } from '@/features/bookings/server';
import { requireUser } from '@/lib/server/session';
import { inr } from '@/utils/format';

export const metadata: Metadata = { title: 'Admin dashboard', robots: { index: false } };
function Bars({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  if (!data.length) return <p className="py-8 text-center text-sm text-slate-500">No bookings in the last 14 days.</p>;
  return <svg role="img" aria-label="Bookings per day, last 14 days" viewBox={`0 0 ${data.length * 40} 140`} className="h-40 w-full">{data.map((d, i) => { const h = (d.count / max) * 100; return <g key={d.date}><rect x={i * 40 + 6} y={110 - h} width={28} height={h} rx={4} fill="#4f46e5" /><text x={i * 40 + 20} y={104 - h} textAnchor="middle" fontSize={10} fill="#64748b">{d.count}</text><text x={i * 40 + 20} y={128} textAnchor="middle" fontSize={9} fill="#94a3b8">{d.date.slice(5)}</text></g>; })}</svg>;
}
async function Dashboard() {
  const s = await getStats(); // authenticated + dynamic: statistics are never cached or shared
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[{ l: 'Bookings today', v: s.todayBookings, i: Ticket }, { l: 'Registered users', v: s.users, i: Users }, { l: 'Trains', v: s.trains, i: TrainFront }, { l: 'Net revenue', v: inr(s.payments.net), i: Banknote }].map(({ l, v, i: I }) => <Card key={l}><CardBody className="flex items-center justify-between"><div><p className="text-sm text-slate-500">{l}</p><p className="mt-1 text-2xl font-bold">{v}</p></div><I className="text-indigo-500" /></CardBody></Card>)}</div>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]"><Card><CardHeader><CardTitle>Bookings per day</CardTitle></CardHeader><CardBody><Bars data={s.perDay} /></CardBody></Card>
        <Card><CardHeader><CardTitle>By status</CardTitle></CardHeader><CardBody className="space-y-2">{s.bookingsByStatus.length === 0 && <p className="text-sm text-slate-500">No bookings yet.</p>}{s.bookingsByStatus.map((b) => <div key={b.status} className="flex items-center justify-between text-sm"><StatusBadge status={b.status} /><span className="font-semibold">{b.count}</span></div>)}</CardBody></Card></div>
      <div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle>Payments &amp; refunds</CardTitle></CardHeader><CardBody className="grid grid-cols-3 gap-3 text-sm"><div><p className="text-slate-500">Collected</p><p className="text-lg font-semibold">{inr(s.payments.gross)}</p></div><div><p className="text-slate-500">Refunded</p><p className="text-lg font-semibold">{inr(s.payments.refunded)}</p></div><div><p className="text-slate-500">Cancellation fees</p><p className="text-lg font-semibold">{inr(s.cancellations.charges)}</p></div></CardBody></Card>
        <Card><CardHeader><CardTitle>Top trains</CardTitle></CardHeader><CardBody className="space-y-2 text-sm">{s.topTrains.length === 0 && <p className="text-slate-500">No confirmed bookings yet.</p>}{s.topTrains.map((t) => <div key={t.id} className="flex justify-between"><span>{t.name} <span className="text-slate-400">#{t.number}</span></span><span className="font-semibold">{t.bookings}</span></div>)}</CardBody></Card></div>
    </>
  );
}
export default async function AdminHome() {
  const user = await requireUser(); const money = user.roles.some((r) => r === 'ADMIN' || r === 'BOOKING_STAFF');
  return (
    <div className="space-y-6"><PageHeader title={money ? 'Dashboard' : 'Operations'} subtitle="Live overview of bookings, revenue and fleet" />
      {money ? <Suspense fallback={<div className="grid gap-4 sm:grid-cols-4"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>}><Dashboard /></Suspense>
        : <p className="text-slate-600">Use <strong>Trains</strong>, <strong>Routes</strong> and <strong>Schedules</strong> in the sidebar to manage coaches, seat status, cancellations and date overrides.</p>}
    </div>
  );
}
