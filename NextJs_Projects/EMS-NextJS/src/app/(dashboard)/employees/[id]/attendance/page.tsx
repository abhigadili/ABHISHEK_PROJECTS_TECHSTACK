import { Suspense } from 'react';
import { listAttendance } from '@/lib/server/attendance';
import { DataTable } from '@/components/common/DataTable';
import { Skeleton, StatusBadge, EmptyState } from '@/components/common/ui';
import { formatDate, formatHours, formatTime } from '@/lib/utils/format';
import { requireSession } from '@/lib/server/session';
import { can } from '@/constants/roles';
import type { AttendanceRecord } from '@/schemas/api';

/** SSR + per-user: attendance is private data → fetched per request, never cached. */
async function Rows({ params }: { params: PageProps<'/employees/[id]/attendance'>['params'] }) {
  const { id } = await params;
  const u = await requireSession();
  const mine = u.employeeId === Number(id);
  if (!mine && !can(u.role, 'attendance:reports')) return <EmptyState title="Attendance is private" hint="You can see your own attendance, and your team's if you are a manager." />;
  const { items } = await (mine ? listAttendance('me', { limit: 31 }) : listAttendance('all', { employeeId: Number(id), limit: 31 }));
  return items.length === 0 ? <EmptyState title="No attendance records yet" /> : (
    <DataTable<AttendanceRecord> rows={items} rowKey={(r) => r.id} caption="Attendance" columns={[
      { key: 'd', header: 'Date', render: (r) => formatDate(r.workDate) }, { key: 'in', header: 'In', render: (r) => formatTime(r.checkInAt) }, { key: 'out', header: 'Out', render: (r) => formatTime(r.checkOutAt) },
      { key: 'h', header: 'Hours', hideBelow: 'sm', render: (r) => formatHours(r.workingHours) }, { key: 's', header: 'Status', render: (r) => <StatusBadge status={r.status} /> }]} />
  );
}
export default function EmployeeAttendance(props: PageProps<'/employees/[id]/attendance'>) { return <Suspense fallback={<Skeleton className="h-64" />}><Rows params={props.params} /></Suspense>; }
