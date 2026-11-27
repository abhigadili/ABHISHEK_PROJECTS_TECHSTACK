import Link from 'next/link';
import { requirePermission } from '@/lib/auth/session';
import { prescriptionService } from '@/services/backend/prescriptions';
import { load, parseId } from '@/lib/api/guards';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate } from '@/lib/utilities/format';

export const metadata = { title: 'Patient prescriptions', robots: { index: false } };
export default async function PatientPrescriptions({ params }: PageProps<'/patients/[patientId]/prescriptions'>) {
  await requirePermission('prescriptions:read');
  const list = await load(prescriptionService.byPatient(parseId((await params).patientId)));
  if (!list.length) return <EmptyState title="No prescriptions" />;
  return <Table><THead><TR><TH>#</TH><TH>Issued</TH><TH>Doctor</TH><TH>Diagnosis</TH><TH>Medicines</TH><TH>Status</TH></TR></THead><TBody>{list.map((r) => <TR key={r.id}><TD><Link className="font-medium text-primary hover:underline" href={`/prescriptions/${r.id}`}>#{r.id}</Link></TD><TD>{formatDate(r.issuedAt)}</TD><TD>{r.doctorName}</TD><TD className="max-w-60 truncate">{r.diagnosis ?? '—'}</TD><TD className="num">{r.items.length}</TD><TD><StatusBadge status={r.status} /></TD></TR>)}</TBody></Table>;
}
