import Link from 'next/link';
import { requireRole } from '@/server/auth/guard';
import { labService } from '@/server/services/laboratory.service';
import { PageHeader } from '@/components/common/PageHeader';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { fmtDateTime } from '@/lib/utilities/format';
export const metadata = { title: 'Laboratory reports', robots: { index: false } };
/** Patients only ever see PUBLISHED reports of their own (scope enforced in the service). */
export default async function Page({ searchParams }: PageProps<'/patient/lab'>) {
  const p = await requireRole(['PATIENT']); const page = Number((await searchParams).page ?? 0) || 0; const r = await labService.list(p, { page, size: 15 });
  return <><PageHeader title="Laboratory reports" />{r.items.length === 0 ? <EmptyState title="No published reports yet" /> : <Table><THead><TR><TH>Test</TH><TH>Requested</TH><TH>Doctor</TH><TH>Result</TH></TR></THead><TBody>{r.items.map((x) => <TR key={x.id}><TD><Link className="font-medium text-primary hover:underline" href={`/patient/lab/${x.id}`}>{x.test.name}</Link></TD><TD>{fmtDateTime(x.requestedAt)}</TD><TD>Dr. {x.doctor.user.lastName}</TD><TD>{x.report?.abnormal ? <Badge tone="danger">Abnormal</Badge> : <Badge tone="ok">Normal</Badge>}</TD></TR>)}</TBody></Table>}<Pagination page={page} size={15} total={r.total} basePath="/patient/lab" /></>;
}
