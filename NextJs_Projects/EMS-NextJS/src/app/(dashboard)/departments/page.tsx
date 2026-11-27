import { Suspense } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { listDepartments } from '@/lib/server/departments';
import { requireSession } from '@/lib/server/session';
import { can } from '@/constants/roles';
import { DataTable } from '@/components/common/DataTable';
import { Pagination } from '@/components/common/Pagination';
import { PageHeader, Skeleton, StatusBadge, buttonClass, EmptyState } from '@/components/common/ui';
import { int, one, type RawSearchParams } from '@/lib/utils/search-params';
import type { Department } from '@/schemas/api';

export const metadata: Metadata = { title: 'Departments' };

async function List({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const sp = await searchParams;
  const page = int(sp.page, 1);
  const search = one(sp.q);
  const { items, meta } = await listDepartments({ search, page, limit: 15 });
  return items.length === 0 ? <EmptyState title="No departments found" hint={search ? 'Try a different search.' : undefined} /> : (
    <>
      <DataTable<Department> rows={items} rowKey={(d) => d.id} caption="Departments" columns={[
        { key: 'c', header: 'Code', render: (d) => d.code }, { key: 'n', header: 'Name', render: (d) => <Link href={`/departments/${d.id}`} className="font-medium text-primary hover:underline">{d.name}</Link> },
        { key: 'h', header: 'Head', hideBelow: 'sm', render: (d) => d.headName ?? '—' }, { key: 'k', header: 'Headcount', render: (d) => d.headcount }, { key: 's', header: 'Status', render: (d) => <StatusBadge status={d.isActive ? 'ACTIVE' : 'INACTIVE'} /> }]} />
      <Pagination base="/departments" meta={meta} params={sp} />
    </>
  );
}

export default async function DepartmentsPage({ searchParams }: PageProps<'/departments'>) {
  return (
    <>
      <Suspense fallback={<PageHeader title="Departments" />}><Header /></Suspense>
      {/* plain GET form: works without JavaScript, state lives in the URL */}
      <form role="search" className="mb-4 flex gap-2"><input name="q" type="search" placeholder="Search departments" aria-label="Search departments" className="w-full max-w-xs rounded-lg border border-border bg-surface px-3 py-2 text-sm" /><button className={buttonClass('secondary')}>Search</button></form>
      <Suspense fallback={<Skeleton className="h-64" />}><List searchParams={searchParams} /></Suspense>
    </>
  );
}
async function Header() {
  const u = await requireSession();
  return <PageHeader title="Departments" subtitle="Organisation units and their heads" actions={can(u.role, 'department:manage') ? <Link href="/departments/new" className={buttonClass('primary')}>New department</Link> : undefined} />;
}
