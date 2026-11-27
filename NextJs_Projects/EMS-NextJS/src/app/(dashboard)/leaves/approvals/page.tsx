import { Suspense } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { listLeaves } from '@/lib/server/leaves';
import { requirePermission } from '@/lib/server/permissions';
import { DataTable } from '@/components/common/DataTable';
import { EmptyState, PageHeader, Skeleton } from '@/components/common/ui';
import { DecisionForm } from '@/features/leaves/DecisionForm';
import { formatDate } from '@/lib/utils/format';
import type { LeaveRequest } from '@/schemas/api';

export const metadata: Metadata = { title: 'Leave approvals' };
async function Body() {
  await requirePermission('leave:approve');
  const { items } = await listLeaves('pending', { limit: 50 });
  return items.length === 0 ? <EmptyState title="Nothing waiting for approval" /> : (
    <DataTable<LeaveRequest> rows={items} rowKey={(r) => r.id} caption="Pending approvals" columns={[
      { key: 'e', header: 'Employee', render: (r) => r.employeeName }, { key: 't', header: 'Type', render: (r) => <Link className="text-primary hover:underline" href={`/leaves/${r.id}`}>{r.leaveType.name}</Link> },
      { key: 'd', header: 'Dates', render: (r) => `${formatDate(r.startDate)} – ${formatDate(r.endDate)}` }, { key: 'r', header: 'Reason', hideBelow: 'md', render: (r) => r.reason },
      { key: 'a', header: 'Decision', render: (r) => <DecisionForm id={r.id} /> }]} />
  );
}
export default function Page() { return <><PageHeader title="Leave approvals" subtitle="Requests from your team" /><Suspense fallback={<Skeleton className="h-64" />}><Body /></Suspense></>; }
