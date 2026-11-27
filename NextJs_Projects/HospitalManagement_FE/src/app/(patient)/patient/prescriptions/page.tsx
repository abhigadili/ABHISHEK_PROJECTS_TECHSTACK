import Link from 'next/link';
import { requireRole } from '@/server/auth/guard';
import { prescriptionService } from '@/server/services/prescription.service';
import { PageHeader } from '@/components/common/PageHeader';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { fmtDate } from '@/lib/utilities/format';
export const metadata = { title: 'Prescriptions', robots: { index: false } };
export default async function Page({ searchParams }: PageProps<'/patient/prescriptions'>) {
  const p = await requireRole(['PATIENT']); const page = Number((await searchParams).page ?? 0) || 0; const r = await prescriptionService.list(p, { page, size: 15 });
  return <><PageHeader title="Prescriptions" />{r.items.length === 0 ? <EmptyState title="No prescriptions" /> : <Table><THead><TR><TH>#</TH><TH>Issued</TH><TH>Doctor</TH><TH>Diagnosis</TH><TH>Medicines</TH><TH>Status</TH></TR></THead><TBody>{r.items.map((x) => <TR key={x.id}><TD><Link className="font-medium text-primary hover:underline" href={`/patient/prescriptions/${x.id}`}>#{x.id}</Link></TD><TD>{fmtDate(x.createdAt)}</TD><TD>Dr. {x.doctor.user.lastName}</TD><TD className="max-w-60 truncate">{x.diagnosis}</TD><TD className="num">{x.items.length}</TD><TD><StatusBadge status={x.status} /></TD></TR>)}</TBody></Table>}<Pagination page={page} size={15} total={r.total} basePath="/patient/prescriptions" /></>;
}
