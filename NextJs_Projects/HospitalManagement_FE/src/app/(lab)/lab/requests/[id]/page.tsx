import { requireRole } from '@/server/auth/guard';
import { labService } from '@/server/services/laboratory.service';
import { idOf } from '@/server/http/api';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/badge';
import { ReportForm } from '@/features/laboratory/ReportForm';
import { LabQueueButtons } from '@/features/laboratory/LabQueueButtons';
import { fmtDateTime } from '@/lib/utilities/format';
export const metadata = { title: 'Lab request', robots: { index: false } };
export default async function Page({ params }: PageProps<'/lab/requests/[id]'>) {
  const p = await requireRole(['LAB_STAFF']); const r = await labService.get(p, idOf((await params).id));
  return <><PageHeader title={r.test.name} description={`${r.patient.user.firstName} ${r.patient.user.lastName} · Dr. ${r.doctor.user.lastName} · ${fmtDateTime(r.requestedAt)}`} actions={<><StatusBadge status={r.status} /><LabQueueButtons id={r.id} status={r.status} /></>} />
    <div className="grid gap-6 lg:grid-cols-3"><Card><CardHeader><CardTitle>Request</CardTitle></CardHeader><CardBody className="space-y-2 text-sm"><p><b>Priority:</b> <StatusBadge status={r.priority} /></p><p><b>Sample:</b> {r.test.sampleType ?? '—'}</p><p><b>Clinical notes:</b> {r.clinicalNotes ?? '—'}</p><p><b>Sample collected:</b> {fmtDateTime(r.sampleCollectedAt)}</p></CardBody></Card>
      <div className="lg:col-span-2">{['PROCESSING', 'COMPLETED'].includes(r.status) ? <Card><CardHeader><CardTitle>{r.report ? 'Edit report' : 'Enter report'}</CardTitle></CardHeader><CardBody><ReportForm id={r.id} defaults={r.report ? { resultSummary: r.report.resultSummary, resultDetails: r.report.resultDetails ?? '', referenceRange: r.report.referenceRange ?? '', abnormal: r.report.abnormal } : undefined} /></CardBody></Card> : <Alert tone="info">Collect the sample and start processing before entering results.</Alert>}</div></div></>;
}
