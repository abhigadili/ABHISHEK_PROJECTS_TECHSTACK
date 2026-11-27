import Link from 'next/link';
import { requireRole } from '@/server/auth/guard';
import { pharmacyService } from '@/server/services/pharmacy.service';
import { PageHeader } from '@/components/common/PageHeader';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { fmtDateTime } from '@/lib/utilities/format';
export const metadata = { title: 'Prescription queue', robots: { index: false } };
export default async function Page() {
  const p = await requireRole(['PHARMACIST']); const q = await pharmacyService.queue(p);
  return <><PageHeader title="Prescription queue" description="Active prescriptions waiting to be dispensed (oldest first)." />{q.length === 0 ? <EmptyState title="Queue is empty" /> : <Table><THead><TR><TH>#</TH><TH>Issued</TH><TH>Patient</TH><TH>Doctor</TH><TH>Items</TH><TH>Status</TH><TH /></TR></THead><TBody>{q.map((x) => <TR key={x.id}><TD>#{x.id}</TD><TD>{fmtDateTime(x.createdAt)}</TD><TD>{x.patient.user.firstName} {x.patient.user.lastName}</TD><TD>Dr. {x.doctor.user.lastName}</TD><TD className="num">{x.items.length}</TD><TD><StatusBadge status={x.status} /></TD><TD><Button asChild size="sm"><Link href={`/pharmacy/queue/${x.id}`}>Dispense</Link></Button></TD></TR>)}</TBody></Table>}</>;
}
