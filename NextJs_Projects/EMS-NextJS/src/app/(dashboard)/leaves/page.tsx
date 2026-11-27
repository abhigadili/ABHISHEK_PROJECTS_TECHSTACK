import { Suspense } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getBalances, listLeaves } from '@/lib/server/leaves';
import { requireSession } from '@/lib/server/session';
import { can } from '@/constants/roles';
import { DataTable } from '@/components/common/DataTable';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState, PageHeader, Skeleton, StatCard, StatusBadge, buttonClass } from '@/components/common/ui';
import { formatDate } from '@/lib/utils/format';
import { int, one, type RawSearchParams } from '@/lib/utils/search-params';
import type { LeaveRequest } from '@/schemas/api';

export const metadata: Metadata = { title: 'Leave' };

async function Body({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const sp = await searchParams;
  const [bal, { items, meta }] = await Promise.all([getBalances(), listLeaves('me', { page: int(sp.page, 1), limit: 10, status: one(sp.status) })]);
  return (
    <>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{bal.balances.map((b) => <StatCard key={b.leaveTypeId} label={b.leaveTypeName} value={`${b.available} left`} hint={`${b.used} used of ${b.entitled + b.adjusted}`} />)}</div>
      <form className="mb-4 flex items-center gap-2"><label className="text-sm" htmlFor="st">Status</label><select id="st" name="status" defaultValue={one(sp.status) ?? ''} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"><option value="">All</option>{['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map((s) => <option key={s}>{s}</option>)}</select><button className={buttonClass('secondary')}>Filter</button></form>
      {items.length === 0 ? <EmptyState title="No leave requests yet" action={<Link href="/leaves/apply" className={buttonClass('primary')}>Apply for leave</Link>} /> : (
        <><DataTable<LeaveRequest> rows={items} rowKey={(r) => r.id} caption="My leave requests" columns={[
          { key: 't', header: 'Type', render: (r) => <Link className="text-primary hover:underline" href={`/leaves/${r.id}`}>{r.leaveType.name}</Link> },
          { key: 'd', header: 'Dates', render: (r) => `${formatDate(r.startDate)}${r.endDate !== r.startDate ? ` – ${formatDate(r.endDate)}` : ''}` }, { key: 'n', header: 'Days', render: (r) => r.days },
          { key: 's', header: 'Status', render: (r) => <StatusBadge status={r.status} /> }]} /><Pagination base="/leaves" meta={meta} params={sp} /></>)}
    </>
  );
}
async function Actions() {
  const u = await requireSession();
  return <div className="flex flex-wrap gap-2"><Link href="/leaves/apply" className={buttonClass('primary')}>Apply for leave</Link><Link href="/leaves/calendar" className={buttonClass('secondary')}>Team calendar</Link>
    {can(u.role, 'leave:approve') && <Link href="/leaves/approvals" className={buttonClass('secondary')}>Approvals</Link>}{can(u.role, 'leave:administer') && <Link href="/leaves/admin" className={buttonClass('secondary')}>Administer</Link>}</div>;
}
export default function LeavesPage({ searchParams }: PageProps<'/leaves'>) {
  return <><PageHeader title="Leave" actions={<Suspense><Actions /></Suspense>} /><Suspense fallback={<Skeleton className="h-64" />}><Body searchParams={searchParams} /></Suspense></>;
}
