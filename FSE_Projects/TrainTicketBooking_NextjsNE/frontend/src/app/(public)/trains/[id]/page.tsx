import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Feedback';
import { Table, TBody, TD, THead, TH, TR } from '@/components/ui/Table';
import { getTrain, getTrains, getTrainSchedules } from '@/features/trains/server';
import { BackendError } from '@/lib/server/backend';
import { DAYS } from '@/utils/format';

type Props = { params: Promise<{ id: string }> };
export const revalidate = 300; // ISR for every train page

/** Pre-render the known trains at build time; unknown ids are rendered on first request and then cached (dynamicParams default = true). */
export async function generateStaticParams() {
  const trains = await getTrains({ size: 100 }).then((r) => r.data).catch(() => []);
  return trains.map((t) => ({ id: String(t.id) }));
}
/** Dynamic metadata: title, description, Open Graph and canonical URL are derived from the train. Same fetch is deduped with the page's own call. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const t = await getTrain(id); const stops = t.route?.stops ?? []; const path = stops.length ? `${stops[0].station.name} to ${stops.at(-1)!.station.name}` : t.type.toLowerCase();
    return { title: `${t.name} (${t.number})`, description: `${t.name} #${t.number} runs ${path}. See the full timetable, stops and operating days.`, alternates: { canonical: `/trains/${id}` }, openGraph: { title: `${t.name} (${t.number})`, description: `Timetable and route: ${path}`, type: 'article' } };
  } catch { return { title: 'Train not found', robots: { index: false } }; }
}

async function Schedule({ id }: { id: string }) {
  const schedules = await getTrainSchedules(id).catch(() => []); const days = new Set(schedules.filter((s) => s.active).flatMap((s) => s.operatingDays.map((d) => d.dayOfWeek)));
  return <div className="flex flex-wrap gap-1" aria-label="Runs on">{DAYS.map((d, i) => <span key={d} className={`rounded px-2 py-1 text-xs ${days.has(i) ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>{d}</span>)}</div>;
}
export default async function TrainPage({ params }: Props) {
  const { id } = await params; if (!/^\d+$/.test(id)) notFound();
  let train; try { train = await getTrain(id); } catch (e) { if (e instanceof BackendError && e.status === 404) notFound(); throw e; }
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">{train.name} <span className="text-slate-400">#{train.number}</span></h1><div className="mt-2 flex gap-2"><Badge tone="indigo">{train.type.toLowerCase()}</Badge><Badge tone={train.status === 'ACTIVE' ? 'green' : 'red'}>{(train.status ?? '').toLowerCase()}</Badge></div></div>
      {/* Dependent + independent data: the route came with the train, the schedule streams separately in its own Suspense boundary */}
      <Suspense fallback={<Skeleton className="h-8 w-80" />}><Schedule id={id} /></Suspense>
      <Card><CardHeader><CardTitle>Route &amp; timetable</CardTitle></CardHeader><CardBody>
        <Table><THead><tr><TH>#</TH><TH>Station</TH><TH>Arrives</TH><TH>Departs</TH><TH>Day</TH><TH className="text-right">Distance</TH></tr></THead>
          <TBody>{train.route?.stops.map((s) => <TR key={s.id}><TD>{s.seq}</TD><TD className="font-medium">{s.station.name} <span className="text-slate-400">({s.station.code})</span></TD><TD>{s.arrivalTime ?? '—'}</TD><TD>{s.departureTime ?? '—'}</TD><TD>{s.dayOffset + 1}</TD><TD className="text-right">{s.distanceKm} km</TD></TR>)}</TBody></Table>
      </CardBody></Card>
    </div>
  );
}
