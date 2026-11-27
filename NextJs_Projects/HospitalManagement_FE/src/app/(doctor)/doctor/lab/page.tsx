import Link from 'next/link';
import { requireRole } from '@/server/auth/guard';
import { labService } from '@/server/services/laboratory.service';
import { PageHeader } from '@/components/common/PageHeader';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { Button } from '@/components/ui/button';
import { fmtDateTime } from '@/lib/utilities/format';
export const metadata = { title: 'Lab requests', robots: { index: false } };
export default async function Page({ searchParams }: PageProps<'/doctor/lab'>) {
  const p = await requireRole(['DOCTOR']); const page = Number((await searchParams).page ?? 0) || 0; const r = await labService.list(p, { page, size: 15 });
  return <><PageHeader title="Laboratory requests & reports" actions={<Button asChild size="sm"><Link href="/doctor/patients">New request (via patient)</Link></Button>} />{r.items.length === 0 ? <EmptyState title="No lab requests yet" /> : <Table><THead><TR><TH>Test</TH><TH>Patient</TH><TH>Requested</TH><TH>Priority</TH><TH>Status</TH><TH>Report</TH></TR></THead><TBody>{r.items.map((x) => <TR key={x.id}><TD><Link className="font-medium text-primary hover:underline" href={`/doctor/lab/${x.id}`}>{x.test.name}</Link></TD><TD>{x.patient.user.firstName} {x.patient.user.lastName}</TD><TD>{fmtDateTime(x.requestedAt)}</TD><TD><StatusBadge status={x.priority} /></TD><TD><StatusBadge status={x.status} /></TD><TD>{x.report?.published ? (x.report.abnormal ? <Badge tone="danger">Abnormal</Badge> : <Badge tone="ok">Published</Badge>) : '—'}</TD></TR>)}</TBody></Table>}<Pagination page={page} size={15} total={r.total} basePath="/doctor/lab" /></>;
}
