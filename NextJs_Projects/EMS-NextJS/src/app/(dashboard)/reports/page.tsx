import { Suspense } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { departmentsReport, designationsReport, joinersExitsReport, leaveSummaryReport } from '@/lib/server/reports';
import { monthlyAttendance } from '@/lib/server/attendance';
import { requirePermission } from '@/lib/server/permissions';
import { DataTable } from '@/components/common/DataTable';
import { EmptyState, PageHeader, Skeleton, buttonClass } from '@/components/common/ui';
import { cn } from '@/lib/utils/cn';
import { formatDate, humanize } from '@/lib/utils/format';
import { int, one, type RawSearchParams } from '@/lib/utils/search-params';

export const metadata: Metadata = { title: 'Reports' };
const TABS = [['departments', 'Departments'], ['designations', 'Designations'], ['joiners', 'Joiners & leavers'], ['leave', 'Leave summary'], ['attendance', 'Monthly attendance']] as const;

async function Report({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const sp = await searchParams; await connection();
  await requirePermission('reports:view');
  const tab = TABS.find(([k]) => k === one(sp.tab))?.[0] ?? 'departments';
  const from = one(sp.from), to = one(sp.to);
  const now = new Date(); const year = int(sp.year, now.getUTCFullYear(), 2000, 2100), month = int(sp.month, now.getUTCMonth() + 1, 1, 12);
  const dates = <form className="mb-4 flex flex-wrap items-end gap-3"><input type="hidden" name="tab" value={tab} /><label className="text-sm">From<input type="date" name="from" defaultValue={from} className="ml-2 rounded-lg border border-border bg-surface px-2 py-1" /></label><label className="text-sm">To<input type="date" name="to" defaultValue={to} className="ml-2 rounded-lg border border-border bg-surface px-2 py-1" /></label><button className={buttonClass('secondary')}>Apply</button></form>;
  let body;
  let csv: string | null = null;
  if (tab === 'departments') {
    const rows = await departmentsReport(); csv = '/api/reports/departments/csv';
    body = <DataTable rows={rows} rowKey={(r) => r.code} caption="Departments" columns={[{ key: 'c', header: 'Code', render: (r) => r.code }, { key: 'n', header: 'Name', render: (r) => r.name }, { key: 'h', header: 'Head', hideBelow: 'sm', render: (r) => r.head ?? '—' }, { key: 'a', header: 'Active', render: (r) => r.activeEmployees }, { key: 'i', header: 'Inactive', render: (r) => r.inactiveEmployees }, { key: 't', header: 'Teams', render: (r) => r.teams }]} />;
  } else if (tab === 'designations') {
    const rows = await designationsReport(); csv = '/api/reports/designations/csv';
    body = <DataTable rows={rows} rowKey={(r) => r.name} caption="Designations" columns={[{ key: 'n', header: 'Designation', render: (r) => r.name }, { key: 'l', header: 'Level', render: (r) => r.jobLevel }, { key: 'a', header: 'Active employees', render: (r) => r.activeEmployees }]} />;
  } else if (tab === 'joiners') {
    const r = await joinersExitsReport(from, to);
    body = <><p className="mb-2 text-sm text-muted">{formatDate(r.from)} – {formatDate(r.to)}</p>{r.joiners.length === 0 ? <EmptyState title="No joiners in this period" /> : <DataTable rows={r.joiners} rowKey={(x) => x.employeeCode} caption="Joiners" columns={[{ key: 'c', header: 'Code', render: (x) => x.employeeCode }, { key: 'n', header: 'Name', render: (x) => x.name }, { key: 'd', header: 'Joined', render: (x) => formatDate(x.date) }, { key: 'p', header: 'Department', hideBelow: 'sm', render: (x) => x.department ?? '—' }]} />}</>;
  } else if (tab === 'leave') {
    const r = await leaveSummaryReport(from, to);
    const cols = r.rows[0] ? Object.keys(r.rows[0]) : [];
    body = r.rows.length === 0 ? <EmptyState title="No leave in this period" /> : <DataTable<Record<string, string | number | null>> rows={r.rows} rowKey={(x) => JSON.stringify(x)} caption="Leave summary" columns={cols.map((c) => ({ key: c, header: humanize(c.replace(/([A-Z])/g, '_$1')), render: (x) => String(x[c] ?? '—') }))} />;
  } else {
    const rows = await monthlyAttendance(year, month); csv = `/api/reports/attendance-monthly/csv?year=${year}&month=${month}`;
    body = <><form className="mb-4 flex items-end gap-3"><input type="hidden" name="tab" value="attendance" /><label className="text-sm">Year<input type="number" name="year" defaultValue={year} className="ml-2 w-24 rounded-lg border border-border bg-surface px-2 py-1" /></label><label className="text-sm">Month<input type="number" name="month" min={1} max={12} defaultValue={month} className="ml-2 w-20 rounded-lg border border-border bg-surface px-2 py-1" /></label><button className={buttonClass('secondary')}>Apply</button></form>
      {rows.length === 0 ? <EmptyState title="No attendance recorded this month" /> : <DataTable rows={rows} rowKey={(r) => r.employeeId} caption="Monthly attendance" columns={[{ key: 'n', header: 'Employee', render: (r) => r.employeeName }, { key: 'p', header: 'Present', render: (r) => r.present }, { key: 'h', header: 'Half day', hideBelow: 'sm', render: (r) => r.halfDay }, { key: 'a', header: 'Absent', render: (r) => r.absent }, { key: 'l', header: 'On leave', hideBelow: 'sm', render: (r) => r.onLeave }, { key: 't', header: 'Hours', render: (r) => r.totalHours.toFixed(1) }]} />}</>;
  }
  return (
    <>
      <nav className="mb-4 flex flex-wrap gap-1 border-b border-border" aria-label="Reports">{TABS.map(([k, l]) => <Link key={k} href={`/reports?tab=${k}`} aria-current={tab === k ? 'page' : undefined} className={cn('border-b-2 px-4 py-2 text-sm font-medium', tab === k ? 'border-primary text-primary' : 'border-transparent text-muted')}>{l}</Link>)}</nav>
      {(tab === 'joiners' || tab === 'leave') && dates}
      {csv && <p className="mb-3"><a href={csv} download className={buttonClass('secondary')} data-testid="csv-download">Download CSV</a></p>}
      {body}
    </>
  );
}
export default function Page({ searchParams }: PageProps<'/reports'>) { return <><PageHeader title="Reports" subtitle="Backed by the EMS reporting endpoints" /><Suspense fallback={<Skeleton className="h-64" />}><Report searchParams={searchParams} /></Suspense></>; }
