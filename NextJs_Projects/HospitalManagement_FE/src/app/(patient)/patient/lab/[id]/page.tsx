import { FileDown } from 'lucide-react';
import { requireRole } from '@/server/auth/guard';
import { labService } from '@/server/services/laboratory.service';
import { idOf } from '@/server/http/api';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PrintButton } from '@/features/prescriptions/PrintButton';
import { fmtDateTime } from '@/lib/utilities/format';
export const metadata = { title: 'Lab report', robots: { index: false } };
export default async function Page({ params }: PageProps<'/patient/lab/[id]'>) {
  const p = await requireRole(['PATIENT']); const r = await labService.get(p, idOf((await params).id)); const rep = r.report!;
  return <><PageHeader title={r.test.name} description={`${r.test.category.name} · requested ${fmtDateTime(r.requestedAt)} by Dr. ${r.doctor.user.lastName}`} actions={<PrintButton />} /><Card className="max-w-3xl"><CardHeader><CardTitle>Result</CardTitle>{rep.abnormal ? <Badge tone="danger">Abnormal</Badge> : <Badge tone="ok">Within range</Badge>}</CardHeader><CardBody className="space-y-3 text-sm"><p className="text-base font-medium">{rep.resultSummary}</p>{rep.resultDetails && <p className="whitespace-pre-wrap text-muted">{rep.resultDetails}</p>}<p><b>Reference range:</b> {rep.referenceRange ?? '—'}</p><p><b>Published:</b> {fmtDateTime(rep.publishedAt)}</p>{rep.fileName && <a className="inline-flex items-center gap-2 text-primary hover:underline" href={`/api/v1/lab/requests/${r.id}/report`}><FileDown className="size-4" />{rep.fileName}</a>}</CardBody></Card></>;
}
