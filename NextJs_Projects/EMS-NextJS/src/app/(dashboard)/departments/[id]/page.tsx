import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getDepartment } from '@/lib/server/departments';
import { listEmployees } from '@/lib/server/employees';
import { requireSession } from '@/lib/server/session';
import { isApiError } from '@/lib/server/api-client';
import { can } from '@/constants/roles';
import { Card, DescriptionList, PageHeader, Skeleton, StatusBadge } from '@/components/common/ui';
import { DepartmentForm } from '@/features/departments/DepartmentForm';
import { StatusSwitch } from '@/features/departments/StatusSwitch';
import { setDepartmentStatusAction } from '@/actions/departments';

export const metadata: Metadata = { title: 'Department' };

async function Detail({ params }: { params: PageProps<'/departments/[id]'>['params'] }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const [d, u] = await Promise.all([getDepartment(Number(id)).catch((e) => { if (isApiError(e) && e.status === 404) notFound(); throw e; }), requireSession()]);
  const team = await listEmployees({ department: String(d.id), limit: 50, sort: 'firstName' });
  const manage = can(u.role, 'department:manage');
  return (
    <>
      <PageHeader title={d.name} subtitle={`${d.code} · ${d.headcount} people`} actions={manage ? <StatusSwitch action={setDepartmentStatusAction} id={d.id} active={d.isActive} label="department" /> : undefined} />
      <div className="space-y-4">
        <Card><DescriptionList items={[['Status', <StatusBadge key="s" status={d.isActive ? 'ACTIVE' : 'INACTIVE'} />], ['Head', d.headName], ['Description', d.description]]} /></Card>
        {manage && <Card><h2 className="mb-3 font-semibold">Edit</h2><DepartmentForm dept={d} /></Card>}
        <Card><h2 className="mb-3 font-semibold">People</h2>{team.items.length === 0 ? <p className="text-sm text-muted">No employees in this department.</p> : <ul className="grid gap-1 sm:grid-cols-2">{team.items.map((e) => <li key={e.id}><Link className="text-primary hover:underline" href={`/employees/${e.id}`}>{e.fullName}</Link> <span className="text-xs text-muted">{e.jobTitle}</span></li>)}</ul>}</Card>
      </div>
    </>
  );
}
export default function DepartmentPage(props: PageProps<'/departments/[id]'>) { return <Suspense fallback={<Skeleton className="h-96" />}><Detail params={props.params} /></Suspense>; }
