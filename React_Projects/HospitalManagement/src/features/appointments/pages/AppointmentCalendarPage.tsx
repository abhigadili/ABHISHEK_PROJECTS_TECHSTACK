import { lazy, Suspense, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { useAppointmentFeed } from '../hooks/useAppointments';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/ErrorState';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { AppointmentStatusBadge } from '@/components/common/StatusBadge';
import { formatDate, formatTimeRange, todayISO } from '@/utils/format';

// Component-based code splitting: the calendar grid is downloaded only when this page is opened.
const CalendarMonth = lazy(() => import('../components/CalendarMonth'));

export default function AppointmentCalendarPage() {
  const feed = useAppointmentFeed();
  const navigate = useNavigate();
  const [selected, setSelected] = useState(todayISO());
  const dayList = useMemo(() => feed.data.filter((a) => a.date === selected).sort((a, b) => a.startTime.localeCompare(b.startTime)), [feed.data, selected]);
  return (
    <>
      <PageHeader title="Appointment calendar" subtitle={feed.scopeLabel} icon={<CalendarDays className="h-5 w-5" />} actions={<Button variant="outline" asChild><Link to="/appointments">List view</Link></Button>} />
      {feed.isError && <ErrorState error={feed.error} onRetry={feed.refetch} />}
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card className="p-4">
          <Suspense fallback={<Skeleton className="h-[420px] w-full" />}>
            <CalendarMonth appointments={feed.data} selected={selected} onSelect={setSelected} />
          </Suspense>
        </Card>
        <Card className="p-4">
          <h2 className="mb-3 font-semibold">{formatDate(selected)}</h2>
          {feed.isPending ? <Skeleton className="h-20" /> : dayList.length === 0 ? <p className="text-sm text-muted">No appointments on this day.</p> : (
            <ul className="space-y-2">{dayList.map((a) => (
              <li key={a.id}><button type="button" onClick={() => navigate(`/appointments/${a.id}`)} className="w-full rounded-lg border border-line p-3 text-left text-sm hover:border-brand-500"><div className="flex items-center justify-between"><b>{formatTimeRange(a.startTime, a.endTime)}</b><AppointmentStatusBadge status={a.status} /></div><div className="mt-1 text-muted">{a.patientName} · {a.doctorName}</div></button></li>
            ))}</ul>
          )}
        </Card>
      </div>
    </>
  );
}
