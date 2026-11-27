import Link from 'next/link';
import { requireRole } from '@/server/auth/guard';
import { labService } from '@/server/services/laboratory.service';
import { PageHeader } from '@/components/common/PageHeader';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { LabQueueButtons } from '@/features/laboratory/LabQueueButtons';
import { fmtDateTime } from '@/lib/utilities/format';
export const metadata = { title: 'Lab requests', robots: { index: false } };
const TABS = [['', 'All'], ['REQUESTED', 'Pending'], ['SAMPLE_COLLECTED', 'Sample collected'], ['PROCESSING', 'Processing'], ['COMPLETED', 'Completed']] as const;
export default async function Page({ searchParams }: PageProps<'/lab/requests'>) {
  const p = await requireRole(['LAB_STAFF']); const sp = await searchParams; const status = typeof sp.status === 'string' ? sp.status : ''; const page = Number(sp.page ?? 0) || 0; const r = await labService.list(p, { status: status || undefined, page, size: 15 });
  return <><PageHeader title="Laboratory requests" /><nav className="mb-4 flex flex-wrap gap-2 text-sm">{TABS.map(([v, l]) => <Link key={v} href={v ? `/lab/requests?status=${v}` : '/lab/requests'} className={`rounded-full border px-3 py-1 ${status === v ? 'border-primary text-primary' : 'border-line text-muted'}`}>{l}</Link>)}</nav>{r.items.length === 0 ? <EmptyState title="No requests" /> : <Table><THead><TR><TH>Requested</TH><TH>Test</TH><TH>Patient</TH><TH>Doctor</TH><TH>Priority</TH><TH>Status</TH><TH /></TR></THead><TBody>{r.items.map((x) => <TR key={x.id}><TD>{fmtDateTime(x.requestedAt)}</TD><TD className="font-medium">{x.test.name}</TD><TD>{x.patient.user.firstName} {x.patient.user.lastName}</TD><TD>Dr. {x.doctor.user.lastName}</TD><TD><StatusBadge status={x.priority} /></TD><TD><StatusBadge status={x.status} /></TD><TD><LabQueueButtons id={x.id} status={x.status} /></TD></TR>)}</TBody></Table>}<Pagination page={page} size={15} total={r.total} basePath="/lab/requests" params={{ status: status || undefined }} /></>;
}
