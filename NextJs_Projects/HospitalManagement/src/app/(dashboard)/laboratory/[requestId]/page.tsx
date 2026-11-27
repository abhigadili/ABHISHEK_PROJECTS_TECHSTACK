import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { FileDown } from 'lucide-react';
import { requirePermission } from '@/lib/auth/session';
import { labService } from '@/services/backend/laboratory';
import { load, loadOptional, parseId } from '@/lib/api/guards';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { AttachmentUpload, ReportForm, StatusAdvance } from '@/features/laboratory/LabWorkflow';
import { CardSkeleton } from '@/components/ui/skeleton';
import { Alert } from '@/components/ui/empty-state';
import { can } from '@/constants/permissions';
import { formatBytes, formatCurrency, formatDateTime } from '@/lib/utilities/format';

export const metadata: Metadata = { title: 'Lab request', robots: { index: false } };
async function Report({ id, canProcess }: { id: number; canProcess: boolean }) {
  const report = await loadOptional(labService.report(id));
  if (!report) return null;
  return (
    <Card><CardHeader><CardTitle>Report</CardTitle>{report.abnormal ? <StatusBadge status="STAT" /> : <StatusBadge status="COMPLETED" />}</CardHeader><CardBody className="space-y-3 text-sm">
      <p className="text-base font-medium">{report.resultSummary}</p>{report.resultDetails && <p className="whitespace-pre-wrap text-muted">{report.resultDetails}</p>}
      <dl className="grid grid-cols-2 gap-3"><div><dt className="text-xs text-muted uppercase">Reference range</dt><dd>{report.referenceRange ?? '—'}</dd></div><div><dt className="text-xs text-muted uppercase">Reported</dt><dd>{formatDateTime(report.reportedAt)} by {report.reportedBy}</dd></div></dl>
      {report.attachment ? <a className="inline-flex items-center gap-2 text-primary hover:underline" href={`/api/lab/requests/${id}/attachment`}><FileDown className="size-4" />{report.attachment.name} ({formatBytes(report.attachment.sizeBytes)})</a> : <p className="text-muted">No attachment.</p>}
      {canProcess && <div className="border-t border-line pt-3"><p className="mb-2 text-sm font-medium">Attach a file</p><AttachmentUpload requestId={id} /></div>}
    </CardBody></Card>
  );
}
export default async function LabRequestPage({ params }: PageProps<'/laboratory/[requestId]'>) {
  const s = await requirePermission('lab:read');
  const id = parseId((await params).requestId);
  const r = await load(labService.request(id));
  const canProcess = can(s.role, 'lab:process');
  return (
    <>
      <PageHeader title={r.testName} description={`Request #${r.id} · ${r.testCode}`} actions={canProcess ? <StatusAdvance id={r.id} status={r.status} /> : undefined} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card><CardHeader><CardTitle>Details</CardTitle><StatusBadge status={r.status} /></CardHeader><CardBody className="space-y-2 text-sm"><p><b>Patient:</b> {can(s.role, 'patients:read') ? <Link className="text-primary hover:underline" href={`/patients/${r.patientId}`}>{r.patientName}</Link> : r.patientName}</p><p><b>Priority:</b> <StatusBadge status={r.priority} /></p><p><b>Price:</b> {formatCurrency(r.price)}</p><p><b>Accession:</b> <span className="font-mono">{r.accessionNumber ?? 'pending'}</span></p><p><b>Requested:</b> {formatDateTime(r.requestedAt)}</p>{r.clinicalNotes && <p><b>Clinical notes:</b> {r.clinicalNotes}</p>}</CardBody></Card>
        <div className="space-y-6 lg:col-span-2">
          {r.status === 'COMPLETED' ? <Suspense fallback={<CardSkeleton rows={4} />}><Report id={id} canProcess={canProcess} /></Suspense>
            : r.status === 'IN_PROGRESS' && canProcess ? <Card><CardHeader><CardTitle>Enter report</CardTitle></CardHeader><CardBody><ReportForm requestId={id} /></CardBody></Card>
            : <Alert tone="info">{r.status === 'CANCELLED' ? 'This request was cancelled.' : 'The report will appear here once the laboratory completes the test.'}</Alert>}
        </div>
      </div>
    </>
  );
}
