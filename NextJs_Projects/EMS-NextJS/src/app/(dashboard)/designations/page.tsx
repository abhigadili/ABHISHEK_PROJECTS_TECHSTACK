import { Suspense } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getDesignations } from '@/lib/server/departments';
import { requireSession } from '@/lib/server/session';
import { can } from '@/constants/roles';
import { DataTable } from '@/components/common/DataTable';
import { Card, PageHeader, Skeleton, StatusBadge } from '@/components/common/ui';
import { DesignationForm } from '@/features/departments/DesignationForm';
import { StatusSwitch } from '@/features/departments/StatusSwitch';
import { setDesignationActiveAction } from '@/actions/departments';
import { one, type RawSearchParams } from '@/lib/utils/search-params';
import type { Designation } from '@/schemas/api';

export const metadata: Metadata = { title: 'Designations' };

async function Body({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const [sp, u, all] = await Promise.all([searchParams, requireSession(), getDesignations()]); // all three in parallel; the list itself comes from the tagged cache
  const manage = can(u.role, 'designation:manage');
  const editing = all.find((d) => String(d.id) === one(sp.edit));
  const rows = [...all].sort((a, b) => a.jobLevel - b.jobLevel || a.name.localeCompare(b.name));
  return (
    <div className="space-y-4">
      {manage && <Card><h2 className="mb-3 font-semibold">{editing ? `Edit ${editing.name}` : 'Add a designation'}</h2><DesignationForm item={editing} /></Card>}
      <DataTable<Designation> rows={rows} rowKey={(d) => d.id} caption="Designations" columns={[
        { key: 'l', header: 'Level', render: (d) => d.jobLevel }, { key: 'n', header: 'Name', render: (d) => d.name }, { key: 'k', header: 'Headcount', render: (d) => d.headcount },
        { key: 's', header: 'Status', render: (d) => <StatusBadge status={d.isActive ? 'ACTIVE' : 'INACTIVE'} /> },
        ...(manage ? [{ key: 'a', header: 'Actions', render: (d: Designation) => <div className="flex items-center gap-2"><Link href={`/designations?edit=${d.id}`} className="text-primary hover:underline">Edit</Link><StatusSwitch action={setDesignationActiveAction} id={d.id} active={d.isActive} label="" /></div> }] : [])]} />
    </div>
  );
}
export default function DesignationsPage({ searchParams }: PageProps<'/designations'>) {
  return <><PageHeader title="Designations" subtitle="Job titles and levels" /><Suspense fallback={<Skeleton className="h-64" />}><Body searchParams={searchParams} /></Suspense></>;
}
