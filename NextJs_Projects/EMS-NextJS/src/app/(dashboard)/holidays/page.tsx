import { Suspense } from 'react';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getHolidays, getWeeklyOffs } from '@/lib/server/holidays';
import { requireSession } from '@/lib/server/session';
import { can } from '@/constants/roles';
import { DataTable } from '@/components/common/DataTable';
import { Card, EmptyState, PageHeader, Skeleton, buttonClass } from '@/components/common/ui';
import { AddHoliday, DeleteHoliday } from '@/features/holidays/HolidayForms';
import { formatDate } from '@/lib/utils/format';
import { int, type RawSearchParams } from '@/lib/utils/search-params';
import type { Holiday } from '@/schemas/api';

export const metadata: Metadata = { title: 'Holidays' };
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

async function Body({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const sp = await searchParams; await connection();
  const year = int(sp.year, new Date().getUTCFullYear(), 2000, 2100);
  const [list, offs, u] = await Promise.all([getHolidays(year), getWeeklyOffs(), requireSession()]); // holidays + weekly offs: tagged Data Cache (revalidated on change / every 10 min)
  const manage = can(u.role, 'holiday:manage');
  return (
    <div className="space-y-4">
      <nav className="flex items-center gap-2" aria-label="Year"><a className={buttonClass('secondary')} href={`/holidays?year=${year - 1}`}>← {year - 1}</a><strong>{year}</strong><a className={buttonClass('secondary')} href={`/holidays?year=${year + 1}`}>{year + 1} →</a></nav>
      {manage && <Card><h2 className="mb-3 font-semibold">Add a holiday</h2><AddHoliday /></Card>}
      {list.length === 0 ? <EmptyState title={`No holidays recorded for ${year}`} /> : (
        <DataTable<Holiday> rows={list} rowKey={(h) => h.id} caption={`Holidays ${year}`} columns={[{ key: 'd', header: 'Date', render: (h) => formatDate(h.holidayDate) }, { key: 'n', header: 'Holiday', render: (h) => h.name }, { key: 'o', header: 'Type', render: (h) => (h.isOptional ? 'Optional' : 'Public') }, { key: 'l', header: 'Location', hideBelow: 'sm', render: (h) => h.location },
          ...(manage ? [{ key: 'x', header: '', render: (h: Holiday) => <DeleteHoliday id={h.id} name={h.name} /> }] : [])]} />)}
      <Card><h2 className="mb-2 font-semibold">Weekly offs</h2><p className="text-sm">{offs.length ? [...new Set(offs.map((o) => DAYS[o.dayOfWeek]))].join(', ') : 'None configured'}</p></Card>
    </div>
  );
}
export default function Page({ searchParams }: PageProps<'/holidays'>) { return <><PageHeader title="Holidays" /><Suspense fallback={<Skeleton className="h-64" />}><Body searchParams={searchParams} /></Suspense></>; }
