import { Suspense } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { listAttendance, attendanceSummary } from '@/lib/server/attendance';
import { requireSession } from '@/lib/server/session';
import { getDepartments } from '@/lib/server/departments';
import { can } from '@/constants/roles';
import { DataTable } from '@/components/common/DataTable';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState, PageHeader, Skeleton, StatCard, StatusBadge, buttonClass } from '@/components/common/ui';
import { CheckCard } from '@/features/attendance/CheckCard';
import { formatDate, formatHours, formatTime, humanize } from '@/lib/utils/format';
import { int, one, withParams, type RawSearchParams } from '@/lib/utils/search-params';
import type { AttendanceRecord } from '@/schemas/api';

export const metadata: Metadata = { title: 'Attendance' };
const STATUSES = ['PRESENT', 'ABSENT', 'HALF_DAY', 'ON_LEAVE', 'HOLIDAY', 'WEEKLY_OFF'];

async function History({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const sp = await searchParams;
  const user = await requireSession();
  const team = can(user.role, 'attendance:reports') && one(sp.scope) === 'all';
  const q = { page: int(sp.page, 1), limit: 15, from: one(sp.from), to: one(sp.to), status: one(sp.status), departmentId: int(sp.department, 0, 0) || undefined };
  const [{ items, meta }, summary, depts] = await Promise.all([listAttendance(team ? 'all' : 'me', q), team ? null : attendanceSummary({ from: q.from, to: q.to }).catch(() => null), team ? getDepartments() : []]);
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {can(user.role, 'attendance:reports') && <><Link href={withParams('/attendance', sp, { scope: undefined, page: 1 })} className={buttonClass(team ? 'secondary' : 'primary')}>My attendance</Link><Link href={withParams('/attendance', sp, { scope: 'all', page: 1 })} className={buttonClass(team ? 'primary' : 'secondary')}>Team</Link></>}
        <Link href="/attendance/calendar" className={buttonClass('secondary')}>Calendar</Link></div>
      <form className="mb-4 flex flex-wrap items-end gap-3" aria-label="Filter attendance">
        {team && <input type="hidden" name="scope" value="all" />}
        <label className="text-sm">From<input type="date" name="from" defaultValue={q.from} className="ml-2 rounded-lg border border-border bg-surface px-2 py-1" /></label>
        <label className="text-sm">To<input type="date" name="to" defaultValue={q.to} className="ml-2 rounded-lg border border-border bg-surface px-2 py-1" /></label>
        <label className="text-sm">Status<select name="status" defaultValue={q.status ?? ''} className="ml-2 rounded-lg border border-border bg-surface px-2 py-1"><option value="">All</option>{STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}</select></label>
        {team && <label className="text-sm">Department<select name="department" defaultValue={one(sp.department) ?? ''} className="ml-2 rounded-lg border border-border bg-surface px-2 py-1"><option value="">All</option>{depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>}
        <button className={buttonClass('secondary')}>Apply</button></form>
      {summary && <div className="mb-4 grid gap-3 sm:grid-cols-3"><StatCard label="Records" value={summary.totalRecords} /><StatCard label="Hours" value={summary.totalHours.toFixed(1)} /><StatCard label="Present days" value={summary.byStatus.PRESENT ?? 0} /></div>}
      {items.length === 0 ? <EmptyState title="No attendance records" hint="Adjust the filters, or check in above." /> : (
        <>
          <DataTable<AttendanceRecord> rows={items} rowKey={(r) => r.id} caption="Attendance history" columns={[
            ...(team ? [{ key: 'e', header: 'Employee', render: (r: AttendanceRecord) => r.employeeName }] : []),
            { key: 'd', header: 'Date', render: (r) => formatDate(r.workDate) }, { key: 'i', header: 'In', render: (r) => formatTime(r.checkInAt) }, { key: 'o', header: 'Out', render: (r) => formatTime(r.checkOutAt) },
            { key: 'h', header: 'Hours', hideBelow: 'sm', render: (r) => formatHours(r.workingHours) }, { key: 'm', header: 'Mode', hideBelow: 'md', render: (r) => r.workMode ?? '—' }, { key: 's', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
            ...(can(user.role, 'attendance:correct') ? [{ key: 'a', header: '', render: (r: AttendanceRecord) => <Link href={`/attendance/${r.id}`} className="text-primary hover:underline">Correct</Link> }] : [])]} />
          <Pagination base="/attendance" meta={meta} params={sp} /></>)}
    </>
  );
}
export default function AttendancePage({ searchParams }: PageProps<'/attendance'>) {
  return <><PageHeader title="Attendance" /><CheckCard /><Suspense fallback={<Skeleton className="h-64" />}><History searchParams={searchParams} /></Suspense></>;
}
