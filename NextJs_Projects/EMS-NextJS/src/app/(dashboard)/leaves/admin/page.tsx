import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getLeaveTypes } from '@/lib/server/leaves';
import { listEmployees } from '@/lib/server/employees';
import { requirePermission } from '@/lib/server/permissions';
import { DataTable } from '@/components/common/DataTable';
import { Card, PageHeader, Skeleton, StatusBadge } from '@/components/common/ui';
import { AdjustForm, LeaveTypeForm } from '@/features/leaves/AdminForms';
import type { LeaveType } from '@/schemas/api';

export const metadata: Metadata = { title: 'Leave administration' };
async function Body() {
  await requirePermission('leave:administer');
  const [types, emps] = await Promise.all([getLeaveTypes(), listEmployees({ limit: 100, status: 'ACTIVE', sort: 'firstName' })]);
  return (
    <div className="space-y-4">
      <Card><h2 className="mb-3 font-semibold">Add a leave type</h2><LeaveTypeForm /></Card>
      <Card><h2 className="mb-3 font-semibold">Adjust a balance</h2><AdjustForm people={emps.items.map((e) => ({ id: e.id, name: e.fullName }))} types={types.filter((t) => t.isActive).map((t) => ({ id: t.id, name: t.name }))} /></Card>
      <DataTable<LeaveType> rows={types} rowKey={(t) => t.id} caption="Leave types" columns={[{ key: 'c', header: 'Code', render: (t) => t.code }, { key: 'n', header: 'Name', render: (t) => t.name }, { key: 'e', header: 'Days / year', render: (t) => t.policy?.annualEntitlement ?? '—' }, { key: 'p', header: 'Paid', render: (t) => (t.isPaid ? 'Yes' : 'No') }, { key: 's', header: 'Status', render: (t) => <StatusBadge status={t.isActive ? 'ACTIVE' : 'INACTIVE'} /> }]} />
    </div>
  );
}
export default function Page() { return <><PageHeader title="Leave administration" /><Suspense fallback={<Skeleton className="h-64" />}><Body /></Suspense></>; }
