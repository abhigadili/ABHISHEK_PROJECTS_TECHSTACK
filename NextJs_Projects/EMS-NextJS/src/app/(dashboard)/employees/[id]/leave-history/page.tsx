import { Suspense } from 'react';
import Link from 'next/link';
import { leaveHistory, listLeaves } from '@/lib/server/leaves';
import { DataTable } from '@/components/common/DataTable';
import { Skeleton, StatusBadge, EmptyState } from '@/components/common/ui';
import { formatDate } from '@/lib/utils/format';
import { requireSession } from '@/lib/server/session';
import { can } from '@/constants/roles';
import type { LeaveRequest } from '@/schemas/api';

async function Rows({ params }: { params: PageProps<'/employees/[id]/leave-history'>['params'] }) {
  const { id } = await params;
  const u = await requireSession();
  const mine = u.employeeId === Number(id);
  if (!mine && !can(u.role, 'leave:approve')) return <EmptyState title="Leave history is private" hint="You can see your own leave, and your team's if you are a manager." />;
  const items: LeaveRequest[] = mine ? (await listLeaves('me', { limit: 50 })).items : await leaveHistory(Number(id)); // per-user, never cached
  return items.length === 0 ? <EmptyState title="No leave requests" /> : (
    <DataTable<LeaveRequest> rows={items} rowKey={(r) => r.id} caption="Leave history" columns={[
      { key: 't', header: 'Type', render: (r) => <Link className="text-primary hover:underline" href={`/leaves/${r.id}`}>{r.leaveType.name}</Link> },
      { key: 'd', header: 'Dates', render: (r) => `${formatDate(r.startDate)}${r.endDate !== r.startDate ? ` – ${formatDate(r.endDate)}` : ''}` }, { key: 'n', header: 'Days', render: (r) => r.days },
      { key: 'r', header: 'Reason', hideBelow: 'md', render: (r) => r.reason }, { key: 's', header: 'Status', render: (r) => <StatusBadge status={r.status} /> }]} />
  );
}
export default function EmployeeLeaveHistory(props: PageProps<'/employees/[id]/leave-history'>) { return <Suspense fallback={<Skeleton className="h-64" />}><Rows params={props.params} /></Suspense>; }
