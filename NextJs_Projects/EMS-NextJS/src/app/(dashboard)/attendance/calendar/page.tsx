import { Suspense } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { attendanceCalendar } from '@/lib/server/attendance';
import { PageHeader, Skeleton, StatusBadge } from '@/components/common/ui';
import { int, type RawSearchParams } from '@/lib/utils/search-params';

export const metadata: Metadata = { title: 'Attendance calendar' };

async function Cal({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const sp = await searchParams;
  await connection();
  const now = new Date();
  const year = int(sp.year, now.getUTCFullYear(), 2000, 2100), month = int(sp.month, now.getUTCMonth() + 1, 1, 12);
  const days = await attendanceCalendar(year, month);
  const prev = month === 1 ? [year - 1, 12] : [year, month - 1], next = month === 12 ? [year + 1, 1] : [year, month + 1];
  const lead = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return (
    <>
      <div className="mb-4 flex items-center gap-3"><Link href={`/attendance/calendar?year=${prev[0]}&month=${prev[1]}`} className="text-primary hover:underline">← Previous</Link>
        <h2 className="font-semibold" aria-live="polite">{new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h2>
        <Link href={`/attendance/calendar?year=${next[0]}&month=${next[1]}`} className="text-primary hover:underline">Next →</Link></div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d}>{d}</div>)}</div>
      <div className="mt-1 grid grid-cols-7 gap-1">{Array.from({ length: lead }, (_, i) => <div key={`b${i}`} />)}
        {days.map((d) => <div key={d.date} className="min-h-16 rounded-lg border border-border p-1 text-xs"><div className="font-medium">{Number(d.date.slice(8))}</div>
          {d.holidayName ? <span className="text-amber-700">{d.holidayName}</span> : d.recorded ? <StatusBadge status={d.recorded.status} /> : <span className="text-muted">{d.calendarDayType === 'WORKING_DAY' ? '' : 'Off'}</span>}</div>)}</div>
    </>
  );
}
export default function CalendarPage({ searchParams }: PageProps<'/attendance/calendar'>) {
  return <><PageHeader title="Attendance calendar" /><Suspense fallback={<Skeleton className="h-96" />}><Cal searchParams={searchParams} /></Suspense></>;
}
