import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { ErrorState, PageLoader } from '@/components/ui/Feedback';
import { useDocumentTitle } from '@/hooks';
import { get } from '@/services/api';
import { DAYS } from '@/utils/format';
import type { Station, TrainLite } from '@/types';

interface TrainFull extends TrainLite { route?: { stops: { id: number; seq: number; arrivalTime: string | null; departureTime: string | null; dayOffset: number; distanceKm: number; station: Station }[] }; schedules?: { operatingDays: { dayOfWeek: number }[] }[] }
export default function TrainDetail() {
  const { id } = useParams(); const { data, isLoading, error, refetch } = useQuery({ queryKey: ['train', id], queryFn: async () => (await get<TrainFull>(`/trains/${id}`)).data });
  useDocumentTitle(data ? `${data.name}` : 'Train');
  if (isLoading) return <PageLoader />; if (error || !data) return <ErrorState error={error} onRetry={refetch} />;
  const days = new Set((data.schedules ?? []).flatMap((s) => s.operatingDays.map((d) => d.dayOfWeek)));
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">{data.name} <span className="text-slate-400">#{data.number}</span></h1><div className="mt-2 flex gap-2"><Badge tone="indigo">{data.type.toLowerCase()}</Badge><Badge tone={data.status === 'ACTIVE' ? 'green' : 'red'}>{data.status?.toLowerCase()}</Badge></div></div>
      {days.size > 0 && <div className="flex gap-1" aria-label="Runs on">{DAYS.map((d, i) => <span key={d} className={`rounded px-2 py-1 text-xs ${days.has(i) ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{d}</span>)}</div>}
      <Card><CardHeader><CardTitle>Route & timetable</CardTitle></CardHeader><CardBody className="overflow-x-auto">
        <table className="w-full text-sm"><thead className="text-left text-slate-500"><tr><th className="py-2">#</th><th>Station</th><th>Arrives</th><th>Departs</th><th>Day</th><th className="text-right">Distance</th></tr></thead>
          <tbody>{data.route?.stops.map((s) => <tr key={s.id} className="border-t"><td className="py-2">{s.seq}</td><td className="font-medium">{s.station.name} <span className="text-slate-400">({s.station.code})</span></td><td>{s.arrivalTime ?? '—'}</td><td>{s.departureTime ?? '—'}</td><td>{s.dayOffset + 1}</td><td className="text-right">{s.distanceKm} km</td></tr>)}</tbody></table>
      </CardBody></Card>
    </div>
  );
}
