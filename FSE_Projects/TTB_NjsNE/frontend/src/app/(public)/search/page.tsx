import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { Suspense } from 'react';
import { FilterBar } from '@/components/common/FilterBar';
import { TrainResultCard } from '@/components/common/TrainResultCard';
import { SearchForm } from '@/components/forms/SearchForm';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState, Skeleton } from '@/components/ui/Feedback';
import { getStations } from '@/features/stations/server';
import { searchTrains } from '@/features/trains/server';
import { fmtDate } from '@/utils/format';
import { BackendError } from '@/lib/server/backend';

/** Search results are DYNAMIC (they read searchParams and must show live availability and fares). */
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams; const stations = await getStations().catch(() => []);
  const n = (id: string) => stations.find((s) => String(s.id) === id)?.name;
  const from = n(one(sp.from)), to = n(one(sp.to));
  return { title: from && to ? `Trains from ${from} to ${to}` : 'Train search', robots: { index: false, follow: true } }; // result pages are transient: do not index
}

async function Results({ from, to, date, sort, type, q }: { from: string; to: string; date: string; sort: string; type: string; q: string }) {
  let rows; try { rows = await searchTrains({ from, to, date, sort, type }); } catch (e) { return <EmptyState title="Could not search trains" hint={e instanceof BackendError ? e.message : 'Please try again.'} />; }
  const filtered = q ? rows.filter((r) => `${r.train.name} ${r.train.number}`.toLowerCase().includes(q.toLowerCase())) : rows;
  if (!filtered.length) return <EmptyState title="No trains found" hint="Try another date or remove filters." />;
  return <ul className="space-y-3">{filtered.map((r) => <li key={r.train.id}><TrainResultCard r={r} /></li>)}</ul>;
}
const Fallback = () => <div className="space-y-3" aria-busy><Skeleton className="h-36" /><Skeleton className="h-36" /></div>;

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams; const from = one(sp.from), to = one(sp.to), date = one(sp.date);
  const stations = await getStations().catch(() => []); // parallel/independent of the search below; deduped + cached
  const valid = /^\d+$/.test(from) && /^\d+$/.test(to) && /^\d{4}-\d{2}-\d{2}$/.test(date) && from !== to;
  const name = (id: string) => stations.find((s) => String(s.id) === id)?.name ?? '';
  return (
    <div className="space-y-6">
      <Card><CardBody><SearchForm stations={stations} initial={{ from, to, date }} /></CardBody></Card>
      {!valid ? <EmptyState title="Choose where you're going" hint="Pick a source, destination and date above." /> : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-lg font-semibold">{name(from)} <ArrowRight className="inline" size={16} /> {name(to)} · {fmtDate(date)}</h1>
            <FilterBar />
          </div>
          {/* Streaming: the shell above is sent immediately; this boundary streams in when the backend answers. `key` re-suspends on every new query. */}
          <Suspense key={`${from}-${to}-${date}-${one(sp.sort)}-${one(sp.type)}-${one(sp.q)}`} fallback={<Fallback />}>
            <Results from={from} to={to} date={date} sort={one(sp.sort) || 'departure'} type={one(sp.type)} q={one(sp.q)} />
          </Suspense>
        </>)}
    </div>
  );
}
