import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState, PageHeader } from '@/components/ui/Feedback';
import { getTrains } from '@/features/trains/server';

export const metadata: Metadata = { title: 'Trains', description: 'Browse every train, its type and status.', alternates: { canonical: '/trains' } };
/** ISR: prerendered, then regenerated at most every 5 minutes (or instantly when an admin edits a train and the `trains` tag is revalidated). */
export const revalidate = 300;
export default async function TrainsPage() {
  const trains = await getTrains({ size: 50 }).then((r) => r.data).catch(() => null);
  return (
    <div><PageHeader title="Trains" subtitle="Our fleet - open a train for its route, timetable and operating days" />
      {!trains?.length ? <EmptyState title="No trains available" hint="The catalogue could not be loaded right now." /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{trains.map((t) => (
          <Link key={t.id} href={`/trains/${t.id}`}><Card className="h-full transition-shadow hover:shadow-md"><CardBody><p className="text-xs text-slate-400">#{t.number}</p><h2 className="font-semibold">{t.name}</h2><div className="mt-2 flex gap-2"><Badge tone="indigo">{t.type.toLowerCase()}</Badge><Badge tone={t.status === 'ACTIVE' ? 'green' : 'red'}>{(t.status ?? 'ACTIVE').toLowerCase()}</Badge></div></CardBody></Card></Link>))}</div>)}
    </div>
  );
}
