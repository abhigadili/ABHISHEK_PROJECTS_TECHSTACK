import Link from 'next/link';
import { requirePermission } from '@/lib/auth/session';
import { labService } from '@/services/backend/laboratory';
import { load, parseId } from '@/lib/api/guards';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDateTime } from '@/lib/utilities/format';

export const metadata = { title: 'Patient lab reports', robots: { index: false } };
export default async function PatientLab({ params }: PageProps<'/patients/[patientId]/lab'>) {
  await requirePermission('lab:read');
  const list = await load(labService.byPatient(parseId((await params).patientId)));
  if (!list.length) return <EmptyState title="No laboratory history" />;
  return <Table><THead><TR><TH>Test</TH><TH>Requested</TH><TH>Priority</TH><TH>Accession</TH><TH>Status</TH></TR></THead><TBody>{list.map((r) => <TR key={r.id}><TD><Link className="font-medium text-primary hover:underline" href={`/laboratory/${r.id}`}>{r.testName}</Link></TD><TD>{formatDateTime(r.requestedAt)}</TD><TD><StatusBadge status={r.priority} /></TD><TD className="font-mono text-xs">{r.accessionNumber ?? '—'}</TD><TD><StatusBadge status={r.status} /></TD></TR>)}</TBody></Table>;
}
