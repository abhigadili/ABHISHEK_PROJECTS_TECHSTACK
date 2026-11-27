import type { Metadata } from 'next';
import Link from 'next/link';
import { FlaskConical, Plus } from 'lucide-react';
import { requirePermission } from '@/lib/auth/session';
import { labService } from '@/services/backend/laboratory';
import { patientService } from '@/services/backend/patients';
import { load, loadOptional } from '@/lib/api/guards';
import { PageHeader } from '@/components/common/PageHeader';
import { LabRequestsInfinite } from '@/features/laboratory/LabRequestsInfinite';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/badge';
import { can } from '@/constants/permissions';
import { formatDateTime } from '@/lib/utilities/format';

export const metadata: Metadata = { title: 'Laboratory', robots: { index: false } };
export default async function LaboratoryPage() {
  const s = await requirePermission('lab:read');
  const actions = <>{can(s.role, 'lab:request') && <Button asChild><Link href="/laboratory/request"><Plus className="size-4" />Request test</Link></Button>}<Button asChild variant="outline"><Link href="/laboratory/tests"><FlaskConical className="size-4" />Test catalogue</Link></Button></>;
  if (s.role === 'PATIENT') {
    const me = await loadOptional(patientService.byUser(s.userId));
    const mine = me ? await load(labService.byPatient(me.id)) : [];
    return <><PageHeader title="My lab reports" description="Your laboratory history." actions={actions} />{mine.length === 0 ? <EmptyState title="No lab requests yet" /> : <Table><THead><TR><TH>Test</TH><TH>Requested</TH><TH>Status</TH></TR></THead><TBody>{mine.map((r) => <TR key={r.id}><TD><Link className="font-medium text-primary hover:underline" href={`/laboratory/${r.id}`}>{r.testName}</Link></TD><TD>{formatDateTime(r.requestedAt)}</TD><TD><StatusBadge status={r.status} /></TD></TR>)}</TBody></Table>}</>;
  }
  return <><PageHeader title="Laboratory" description="Lab requests across all patients - scroll to load more." actions={actions} /><LabRequestsInfinite /></>;
}
