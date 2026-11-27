import { Suspense } from 'react';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { teamLeave } from '@/lib/server/leaves';
import { DataTable } from '@/components/common/DataTable';
import { EmptyState, PageHeader, Skeleton, StatusBadge } from '@/components/common/ui';
import { formatDate } from '@/lib/utils/format';
import { one, type RawSearchParams } from '@/lib/utils/search-params';
import type { LeaveRequest } from '@/schemas/api';

export const metadata: Metadata = { title: 'Team leave calendar' };
async function Body({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const sp = await searchParams; await connection();
  const from = one(sp.from) ?? new Date().toISOString().slice(0, 10);
  const to = one(sp.to) ?? (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() + 30); return d.toISOString().slice(0, 10); })();
  const rows = (await teamLeave(from, to)).filter((r) => r.status === 'APPROVED' || r.status === 'PENDING');
  return (
    <>
      <form className="mb-4 flex flex-wrap items-end gap-3"><label className="text-sm">From<input type="date" name="from" defaultValue={from} className="ml-2 rounded-lg border border-border bg-surface px-2 py-1" /></label><label className="text-sm">To<input type="date" name="to" defaultValue={to} className="ml-2 rounded-lg border border-border bg-surface px-2 py-1" /></label><button className="rounded-lg border border-border px-3 py-1.5 text-sm">Apply</button></form>
      {rows.length === 0 ? <EmptyState title="No one is away in this period" /> : <DataTable<LeaveRequest> rows={rows} rowKey={(r) => r.id} caption="Team leave" columns={[{ key: 'e', header: 'Employee', render: (r) => r.employeeName }, { key: 't', header: 'Type', render: (r) => r.leaveType.name }, { key: 'd', header: 'Dates', render: (r) => `${formatDate(r.startDate)} – ${formatDate(r.endDate)}` }, { key: 's', header: 'Status', render: (r) => <StatusBadge status={r.status} /> }]} />}
    </>
  );
}
export default function Page({ searchParams }: PageProps<'/leaves/calendar'>) { return <><PageHeader title="Team leave calendar" /><Suspense fallback={<Skeleton className="h-64" />}><Body searchParams={searchParams} /></Suspense></>; }
