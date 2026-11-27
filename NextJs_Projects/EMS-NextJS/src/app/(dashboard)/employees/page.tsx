import { Suspense } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { listEmployees } from '@/lib/server/employees';
import { getDepartments, getDesignations } from '@/lib/server/departments';
import { EmployeeFilters } from '@/features/employees/EmployeeFilters';
import { Avatar } from '@/components/common/Avatar';
import { DataTable, type Column } from '@/components/common/DataTable';
import { Pagination } from '@/components/common/Pagination';
import { Skeleton, StatusBadge, PageHeader, EmptyState, buttonClass, Alert } from '@/components/common/ui';
import { requireSession } from '@/lib/server/session';
import { can } from '@/constants/roles';
import { formatDate } from '@/lib/utils/format';
import { int, one, withParams, type RawSearchParams } from '@/lib/utils/search-params';
import { isApiError } from '@/lib/server/api-client';
import type { Employee } from '@/schemas/api';

export const metadata: Metadata = { title: 'Employees' };

async function Filters() {
  const [d, g] = await Promise.all([getDepartments(), getDesignations()]); // parallel, tagged-cache backed
  return <EmployeeFilters departments={d.filter((x) => x.isActive).map((x) => ({ value: String(x.id), label: x.name }))} designations={g.map((x) => ({ value: String(x.id), label: x.name }))} />;
}

/**
 * SSR: this runs per request with the CURRENT query string (/employees?page=2&search=ali&department=IT&sort=name:desc), calls Express on
 * the server and streams the rendered table. Links (not buttons) drive sort/pagination, so the page works without JavaScript.
 */
async function Table({ sp }: { sp: RawSearchParams }) {
  const page = int(sp.page, 1); const limit = int(sp.limit, 10, 5, 50);
  let result;
  try { result = await listEmployees({ page, limit, search: one(sp.search), department: one(sp.department), status: one(sp.status), sort: one(sp.sort) }); }
  catch (e) { if (isApiError(e) && e.status < 500) return <Alert>{e.message}</Alert>; throw e; } // 5xx → error.tsx boundary
  const { items, meta } = result;
  const sort = one(sp.sort) ?? 'name';
  const sortLink = (key: string, label: string) => { const [f, dir] = sort.split(':'); return <Link className="hover:underline" href={withParams('/employees', sp, { sort: f === key && dir !== 'desc' ? `${key}:desc` : key, page: undefined })}>{label}{f === key ? (dir === 'desc' ? ' ↓' : ' ↑') : ''}</Link>; };
  const columns: Column<Employee>[] = [
    { key: 'name', header: sortLink('name', 'Employee'), render: (e) => (
      <Link href={`/employees/${e.id}`} className="flex items-center gap-3 hover:underline" data-testid={`emp-link-${e.id}`}>
        <Avatar employeeId={e.id} name={e.fullName} hasPicture={!!e.profilePictureUrl} size={34} />
        <span><span className="block font-medium">{e.fullName}</span><span className="block text-xs text-muted">{e.workEmail}</span></span>
      </Link>) },
    { key: 'code', header: 'Code', hideBelow: 'sm', render: (e) => e.employeeCode },
    { key: 'dept', header: sortLink('department', 'Department'), hideBelow: 'md', render: (e) => e.department?.name ?? '—' },
    { key: 'title', header: 'Title', hideBelow: 'md', render: (e) => e.jobTitle ?? '—' },
    { key: 'joined', header: sortLink('joiningDate', 'Joined'), hideBelow: 'lg', render: (e) => formatDate(e.joiningDate) },
    { key: 'status', header: 'Status', render: (e) => <StatusBadge status={e.status} /> },
  ];
  if (items.length === 0) return <EmptyState title="No employees match" hint="Try clearing a filter or searching for something else." />;
  return (<><DataTable<Employee> rows={items} columns={columns} rowKey={(e) => e.id} caption="Employees" /><Pagination base="/employees" meta={meta} params={sp} /></>);
}

async function Actions() {
  const u = await requireSession();
  return can(u.role, 'employee:manage') ? <Link href="/employees/new" className={buttonClass('primary')}>New employee</Link> : null;
}

export default function EmployeesPage(props: PageProps<'/employees'>) {
  return (
    <>
      <PageHeader title="Employees" subtitle="Search, filter and open any profile. Filters live in the URL." actions={<Suspense><Actions /></Suspense>} />
      <Suspense fallback={<Skeleton className="mb-4 h-10" />}><Filters /></Suspense>
      {/* searchParams is a runtime API: awaited inside Suspense; `key` re-suspends when the query changes so the skeleton shows while the new page streams */}
      <Suspense fallback={<div className="space-y-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-12" />)}</div>}><TableFromParams searchParams={props.searchParams} /></Suspense>
    </>
  );
}
async function TableFromParams({ searchParams }: { searchParams: PageProps<'/employees'>['searchParams'] }) {
  const sp = await searchParams;
  return <Table key={JSON.stringify(sp)} sp={sp} />;
}
