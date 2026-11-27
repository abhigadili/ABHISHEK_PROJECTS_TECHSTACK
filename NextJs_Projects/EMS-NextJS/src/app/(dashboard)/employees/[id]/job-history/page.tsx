import { Suspense } from 'react';
import { getJobHistory } from '@/lib/server/employees';
import { getDepartments, getDesignations } from '@/lib/server/departments';
import { DataTable } from '@/components/common/DataTable';
import { Card, Skeleton, StatusBadge, EmptyState } from '@/components/common/ui';
import { JobChangeForm } from '@/features/employees/JobChangeForm';
import { requireSession } from '@/lib/server/session';
import { can } from '@/constants/roles';
import { formatDate, humanize } from '@/lib/utils/format';
import type { JobHistoryEntry } from '@/schemas/api';

const arrow = (a: string | null, b: string | null) => (a === b ? (b ?? '—') : `${a ?? '—'} → ${b ?? '—'}`);
async function Rows({ params }: { params: PageProps<'/employees/[id]/job-history'>['params'] }) {
  const { id } = await params;
  const u = await requireSession();
  const [history, depts, desigs] = await Promise.all([getJobHistory(Number(id)), can(u.role, 'employee:manage') ? getDepartments() : [], can(u.role, 'employee:manage') ? getDesignations() : []]);
  return (
    <div className="space-y-4">
      {can(u.role, 'employee:manage') && <Card><h2 className="mb-3 font-semibold">Record a promotion or transfer</h2><JobChangeForm employeeId={Number(id)} departments={depts.filter((d) => d.isActive).map((d) => ({ id: d.id, name: d.name }))} designations={desigs.filter((d) => d.isActive).map((d) => ({ id: d.id, name: d.name }))} /></Card>}
      {history.length === 0 ? <EmptyState title="No job history yet" /> : (
        <DataTable<JobHistoryEntry> rows={history} rowKey={(h) => h.id} caption="Job history" columns={[
          { key: 'e', header: 'Effective', render: (h) => formatDate(h.effectiveDate) }, { key: 'c', header: 'Change', render: (h) => <StatusBadge status={h.changeType === 'JOINED' ? 'ACTIVE' : 'PENDING'} label={humanize(h.changeType)} /> },
          { key: 't', header: 'Title', render: (h) => arrow(h.fromJobTitle, h.toJobTitle) }, { key: 'd', header: 'Designation', hideBelow: 'sm', render: (h) => arrow(h.fromDesignation, h.toDesignation) },
          { key: 'p', header: 'Department', hideBelow: 'md', render: (h) => arrow(h.fromDepartment, h.toDepartment) }, { key: 'm', header: 'Manager', hideBelow: 'md', render: (h) => arrow(h.fromManager, h.toManager) }]} />)}
    </div>
  );
}
export default function JobHistory(props: PageProps<'/employees/[id]/job-history'>) { return <Suspense fallback={<Skeleton className="h-64" />}><Rows params={props.params} /></Suspense>; }
