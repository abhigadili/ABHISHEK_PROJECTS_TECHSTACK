import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getOrgChart } from '@/lib/server/organization';
import { getDepartments } from '@/lib/server/departments';
import { OrgTree } from '@/features/departments/OrgTree';
import { PageHeader, Skeleton, EmptyState, buttonClass } from '@/components/common/ui';
import { int, one, type RawSearchParams } from '@/lib/utils/search-params';

export const metadata: Metadata = { title: 'Organization chart' };

async function Chart({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const sp = await searchParams;
  const dept = int(sp.department, 0, 0);
  const [chart, depts] = await Promise.all([getOrgChart(dept || undefined), getDepartments()]);
  return (
    <>
      <form className="mb-4 flex items-center gap-2"><label htmlFor="dept" className="text-sm">Department</label>
        <select id="dept" name="department" defaultValue={one(sp.department) ?? ''} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"><option value="">All</option>{depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
        <button className={buttonClass('secondary')}>Apply</button></form>
      {chart.roots.length === 0 ? <EmptyState title="No reporting hierarchy yet" /> : <OrgTree key={dept} roots={chart.roots} />}
      <p className="mt-3 text-xs text-muted">{chart.totalNodes} people in the chart.</p>
    </>
  );
}
export default function OrganizationPage({ searchParams }: PageProps<'/organization'>) {
  return <><PageHeader title="Organization chart" subtitle="Built from the reporting hierarchy in the backend" /><Suspense fallback={<Skeleton className="h-96" />}><Chart searchParams={searchParams} /></Suspense></>;
}
