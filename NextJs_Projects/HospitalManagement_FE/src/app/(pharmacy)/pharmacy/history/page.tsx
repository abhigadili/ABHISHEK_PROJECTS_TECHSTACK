import { requireRole } from '@/server/auth/guard';
import { pharmacyService } from '@/server/services/pharmacy.service';
import { PageHeader } from '@/components/common/PageHeader';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { fmtDateTime } from '@/lib/utilities/format';
export const metadata = { title: 'Dispensing history', robots: { index: false } };
export default async function Page({ searchParams }: PageProps<'/pharmacy/history'>) {
  const p = await requireRole(['PHARMACIST']); const page = Number((await searchParams).page ?? 0) || 0; const r = await pharmacyService.history(p, { page, size: 15 });
  return <><PageHeader title="Dispensing history" />{r.items.length === 0 ? <EmptyState title="Nothing dispensed yet" /> : <Table><THead><TR><TH>When</TH><TH>Prescription</TH><TH>Patient</TH><TH>Items (batch)</TH></TR></THead><TBody>{r.items.map((d) => <TR key={d.id}><TD>{fmtDateTime(d.dispensedAt)}</TD><TD>#{d.prescription.id}</TD><TD>{d.prescription.patient.user.firstName} {d.prescription.patient.user.lastName}</TD><TD>{d.items.map((i) => `${i.inventory.medicine.name} ×${i.quantity} (${i.inventory.batchNumber})`).join(', ')}</TD></TR>)}</TBody></Table>}<Pagination page={page} size={15} total={r.total} basePath="/pharmacy/history" /></>;
}
