import { ArrowRight, TrainFront } from 'lucide-react';
import { useDeferredValue, useMemo, useState, useTransition } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { SearchForm } from '@/components/SearchForm';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Field';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { RadixSelect } from '@/components/ui/RadixSelect';
import { useAuth, useDocumentTitle } from '@/hooks';
import { useSearch } from '@/services/queries';
import { useAppDispatch } from '@/store';
import { trainSelected } from '@/store/bookingSlice';
import { useStationsQuery } from '@/store/api';
import { fmtDate, fmtDuration, fmtTime, inr } from '@/utils/format';
import type { SearchResult } from '@/types';

const SORTS = [{ value: 'departure', label: 'Earliest departure' }, { value: 'duration', label: 'Shortest journey' }, { value: 'fare', label: 'Lowest fare' }, { value: 'name', label: 'Train name' }];

export default function SearchResults() {
  useDocumentTitle('Train results');
  const [params, setParams] = useSearchParams(); const from = params.get('from') ?? '', to = params.get('to') ?? '', date = params.get('date') ?? '';
  const sort = params.get('sort') ?? 'departure'; const type = params.get('type') ?? '';
  const [isPending, startTransition] = useTransition(); // sorting/filtering re-fetches without freezing the UI
  const [nameFilter, setNameFilter] = useState(''); const deferredName = useDeferredValue(nameFilter); // typing stays instant, list filters in the background
  const valid = !!(from && to && date);
  const { data, isLoading, isFetching, error, refetch } = useSearch(valid ? { from, to, date, sort, type } : null);
  const { data: stations = [] } = useStationsQuery(); const nav = useNavigate(); const dispatch = useAppDispatch(); const { isAuthenticated } = useAuth();
  const setParam = (k: string, v: string) => startTransition(() => setParams((p) => { const n = new URLSearchParams(p); v ? n.set(k, v) : n.delete(k); return n; }, { replace: true }));
  const rows = useMemo(() => (data ?? []).filter((r) => !deferredName || `${r.train.name} ${r.train.number}`.toLowerCase().includes(deferredName.toLowerCase())), [data, deferredName]);
  const name = (id: string) => stations.find((s) => String(s.id) === id)?.name ?? '';
  const choose = (r: SearchResult, coachTypeId: number) => { dispatch(trainSelected({ result: r, coachTypeId })); nav(isAuthenticated ? '/book' : '/login', { state: { from: '/book' } }); };
  return (
    <div className="space-y-6">
      <Card><CardBody><SearchForm compact initial={{ from, to, date }} /></CardBody></Card>
      {!valid ? <EmptyState title="Choose where you're going" hint="Pick a source, destination and date above." /> : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-lg font-semibold">{name(from)} <ArrowRight className="inline" size={16} /> {name(to)} · {date && fmtDate(date)}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <Input aria-label="Filter by train name or number" placeholder="Filter by name / number" className="w-52" value={nameFilter} onChange={(e) => setNameFilter(e.target.value)} />
              <RadixSelect label="Train type" value={type || 'ALL'} onValueChange={(v) => setParam('type', v === 'ALL' ? '' : v)} options={[{ value: 'ALL', label: 'All types' }, ...['EXPRESS', 'SUPERFAST', 'PREMIUM', 'PASSENGER', 'SUBURBAN'].map((t) => ({ value: t, label: t[0] + t.slice(1).toLowerCase() }))]} />
              <RadixSelect label="Sort by" value={sort} onValueChange={(v) => setParam('sort', v)} options={SORTS} />
            </div>
          </div>
          <div className={isPending || (isFetching && !isLoading) ? 'opacity-60 transition-opacity' : 'transition-opacity'} aria-busy={isPending || isFetching}>
            {isLoading ? <div className="space-y-3"><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
              : error ? <ErrorState error={error} onRetry={refetch} />
              : rows.length === 0 ? <EmptyState title="No trains found" hint="Try another date or remove filters." />
              : <ul className="space-y-3">{rows.map((r) => (
                <li key={r.train.id}><Card><CardBody className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3"><TrainFront className="text-indigo-600" /><div><Link to={`/trains/${r.train.id}`} className="font-semibold hover:underline">{r.train.name} <span className="text-slate-400">#{r.train.number}</span></Link><div><Badge tone="indigo">{r.train.type.toLowerCase()}</Badge></div></div></div>
                    <div className="flex items-center gap-6 text-center"><div><p className="text-xl font-semibold">{fmtTime(r.from.departure)}</p><p className="text-xs text-slate-500">{r.from.station.code}</p></div><div className="text-xs text-slate-500"><p>{fmtDuration(r.durationMinutes)}</p><div className="my-1 h-px w-20 bg-slate-300" /><p>{r.distanceKm} km</p></div><div><p className="text-xl font-semibold">{fmtTime(r.to.arrival)}</p><p className="text-xs text-slate-500">{r.to.station.code}</p></div></div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {r.classes.map((c) => <div key={c.coachTypeId} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                      <div><p className="font-medium">{c.name} <span className="text-xs text-slate-400">({c.code})</span></p><p className={`text-xs ${c.available === 0 ? 'text-red-600' : c.available < 10 ? 'text-amber-600' : 'text-emerald-600'}`}>{c.available === 0 ? 'Sold out' : `${c.available} seats left`}</p></div>
                      <div className="text-right"><p className="font-semibold">{inr(c.fare)}</p><Button size="sm" disabled={c.available === 0} onClick={() => choose(r, c.coachTypeId)}>Book</Button></div></div>)}
                  </div>
                </CardBody></Card></li>))}</ul>}
          </div>
        </>)}
    </div>
  );
}
