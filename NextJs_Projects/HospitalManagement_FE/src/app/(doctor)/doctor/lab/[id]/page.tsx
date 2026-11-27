import { FileDown } from 'lucide-react';
import { requireRole } from '@/server/auth/guard';
import { labService } from '@/server/services/laboratory.service';
import { idOf } from '@/server/http/api';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/empty-state';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { fmtDateTime } from '@/lib/utilities/format';
export const metadata = { title: 'Lab report', robots: { index: false } };
export default async function Page({ params }: PageProps<'/doctor/lab/[id]'>) {
  const p = await requireRole(['DOCTOR']); const r = await labService.get(p, idOf((await params).id)); const rep = r.report;
  return <><PageHeader title={r.test.name} description={`${r.patient.user.firstName} ${r.patient.user.lastName} · requested ${fmtDateTime(r.requestedAt)}`} actions={<StatusBadge status={r.status} />} />{rep?.published ? <Card className="max-w-3xl"><CardHeader><CardTitle>Report</CardTitle>{rep.abnormal ? <Badge tone="danger">Abnormal</Badge> : <Badge tone="ok">Within range</Badge>}</CardHeader><CardBody className="space-y-3 text-sm"><p className="text-base font-medium">{rep.resultSummary}</p>{rep.resultDetails && <p className="whitespace-pre-wrap text-muted">{rep.resultDetails}</p>}<p><b>Reference:</b> {rep.referenceRange ?? '—'}</p>{rep.fileName && <a className="inline-flex items-center gap-2 text-primary hover:underline" href={`/api/v1/lab/requests/${r.id}/report`}><FileDown className="size-4" />{rep.fileName}</a>}</CardBody></Card> : <Alert tone="info">The report is not published yet (status: {r.status.toLowerCase().replace('_', ' ')}). You will be notified.</Alert>}</>;
}
