import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { getStation, getStations } from '@/features/stations/server';
import { BackendError } from '@/lib/server/backend';
import { addDaysIso } from '@/utils/format';

type Props = { params: Promise<{ id: string }> };
export const revalidate = 3600;
export async function generateStaticParams() { return (await getStations().catch(() => [])).map((s) => ({ id: String(s.id) })); }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try { const s = await getStation(id); return { title: `${s.name} (${s.code})`, description: `Trains serving ${s.name}, ${s.city}, ${s.state}.`, alternates: { canonical: `/stations/${id}` } }; } catch { return { title: 'Station not found' }; }
}
export default async function StationPage({ params }: Props) {
  const { id } = await params; if (!/^\d+$/.test(id)) notFound();
  // Sequential-dependent fetch: need the station first, then (in parallel) the full list to suggest destinations.
  const station = await getStation(id).catch((e) => { if (e instanceof BackendError && e.status === 404) notFound(); throw e; });
  const others = (await getStations()).filter((s) => s.id !== station.id).slice(0, 8);
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">{station.name} <span className="text-slate-400">{station.code}</span></h1><p className="text-slate-500">{station.city}, {station.state}</p></div>
      <Card><CardBody><h2 className="mb-3 font-semibold">Search trains from here</h2><div className="flex flex-wrap gap-2">{others.map((o) => <Button key={o.id} variant="outline" size="sm" asChild><Link href={`/search?from=${station.id}&to=${o.id}&date=${addDaysIso(1)}`}>to {o.name}</Link></Button>)}</div></CardBody></Card>
    </div>
  );
}
