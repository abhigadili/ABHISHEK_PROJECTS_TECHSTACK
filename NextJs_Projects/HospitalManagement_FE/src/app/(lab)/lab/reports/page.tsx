import Link from 'next/link';
import { requireRole } from '@/server/auth/guard';
import { labService } from '@/server/services/laboratory.service';
import { PageHeader } from '@/components/common/PageHeader';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { fmtDateTime } from '@/lib/utilities/format';
export const metadata = { title: 'Published reports', robots: { index: false } };
export default async function Page({ searchParams }: PageProps<'/lab/reports'>) {
  const p = await requireRole(['LAB_STAFF']); const page = Number((await searchParams).page ?? 0) || 0; const r = await labService.list(p, { status: 'COMPLETED', page, size: 15 });
  return <><PageHeader title="Reports" />{r.items.length === 0 ? <EmptyState title="No completed reports" /> : <Table><THead><TR><TH>Test</TH><TH>Patient</TH><TH>Published</TH><TH>Result</TH></TR></THead><TBody>{r.items.map((x) => <TR key={x.id}><TD><Link className="font-medium text-primary hover:underline" href={`/lab/requests/${x.id}`}>{x.test.name}</Link></TD><TD>{x.patient.user.firstName} {x.patient.user.lastName}</TD><TD>{x.report?.published ? fmtDateTime(x.report.publishedAt) : <Badge tone="warn">Draft</Badge>}</TD><TD>{x.report?.abnormal ? <Badge tone="danger">Abnormal</Badge> : <Badge tone="ok">Normal</Badge>}</TD></TR>)}</TBody></Table>}<Pagination page={page} size={15} total={r.total} basePath="/lab/reports" /></>;
}
