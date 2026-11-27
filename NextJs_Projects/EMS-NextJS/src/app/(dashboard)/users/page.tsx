import { Suspense } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { listEmployees } from '@/lib/server/employees';
import { requirePermission } from '@/lib/server/permissions';
import { can } from '@/constants/roles';
import { DataTable } from '@/components/common/DataTable';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState, PageHeader, Skeleton, StatusBadge, buttonClass } from '@/components/common/ui';
import { ChangeRole, CreateLogin } from '@/features/users/UserForms';
import { int, one, type RawSearchParams } from '@/lib/utils/search-params';
import type { Employee } from '@/schemas/api';

export const metadata: Metadata = { title: 'Users & roles' };
/** The backend has no /users endpoint, so logins are derived from the employee records (their `account` block). */
async function Body({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const sp = await searchParams;
  const u = await requirePermission('users:manage');
  const { items, meta } = await listEmployees({ page: int(sp.page, 1), limit: 15, search: one(sp.q), status: 'ACTIVE', sort: 'firstName' });
  const superAdmin = can(u.role, 'users:set-role');
  return (
    <>
      <form role="search" className="mb-4 flex gap-2"><input name="q" type="search" defaultValue={one(sp.q)} placeholder="Search employees" aria-label="Search employees" className="w-full max-w-xs rounded-lg border border-border bg-surface px-3 py-2 text-sm" /><button className={buttonClass('secondary')}>Search</button></form>
      {items.length === 0 ? <EmptyState title="No employees found" /> : <><DataTable<Employee> rows={items} rowKey={(e) => e.id} caption="Users" columns={[
        { key: 'n', header: 'Employee', render: (e) => <Link href={`/employees/${e.id}`} className="text-primary hover:underline">{e.fullName}</Link> }, { key: 'e', header: 'Email', hideBelow: 'md', render: (e) => e.workEmail },
        { key: 'r', header: 'Login / role', render: (e) => (e.account ? (superAdmin ? <ChangeRole id={e.id} role={e.account.role} /> : <StatusBadge status={e.account.role} />) : <span className="text-muted">No login</span>) },
        { key: 'a', header: 'Create login', render: (e) => (e.account ? '' : <CreateLogin id={e.id} canSuper={superAdmin} />) }]} /><Pagination base="/users" meta={meta} params={sp} /></>}
    </>
  );
}
export default function Page({ searchParams }: PageProps<'/users'>) { return <><PageHeader title="Users & roles" subtitle="Who can sign in, and as what" /><Suspense fallback={<Skeleton className="h-64" />}><Body searchParams={searchParams} /></Suspense></>; }
