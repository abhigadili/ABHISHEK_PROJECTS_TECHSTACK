import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Download, FileCheck2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { NEXT_STATUS } from '../constants';
import { useCancelLabRequest, useLabReport, useLabRequest, useSetLabStatus, useSubmitLabReport, useUploadAttachment } from '../hooks/useLab';
import { laboratoryApi } from '@/services/endpoints/laboratoryApi';
import { labReportSchema, type LabReportFormValues } from '@/schemas/laboratory';
import { QueryBoundary } from '@/components/common/QueryBoundary';
import { PageHeader } from '@/components/common/PageHeader';
import { DetailList } from '@/components/common/DetailList';
import { Notice } from '@/components/common/Notice';
import { LabPriorityBadge, LabStatusBadge } from '@/components/common/StatusBadge';
import { ConfirmDialog, type ConfirmDialogHandle } from '@/components/dialogs/ConfirmDialog';
import { FileDropzone, type FileDropzoneHandle } from '@/components/forms/FileDropzone';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useCan } from '@/contexts/AuthContext';
import { useFileDownload } from '@/hooks/useFileDownload';
import { errorMessage } from '@/services/axios/errors';
import { formatBytes, formatCurrency, formatDateTime, emptyToNull } from '@/utils/format';
import type { LabRequest } from '@/types';

/** Scenario 4 (part 2) - request details, status workflow, report entry, attachment upload/download, report retrieval. */
export default function LabRequestDetailsPage() {
  const id = Number(useParams().requestId);
  const query = useLabRequest(id);
  return <QueryBoundary query={query}>{(r) => <Details request={r} />}</QueryBoundary>;
}

function Details({ request: r }: { request: LabRequest }) {
  const canProcess = useCan('lab:process');
  const canCancel = useCan('lab:request') || canProcess;
  const setStatus = useSetLabStatus();
  const cancel = useCancelLabRequest();
  const confirm = useRef<ConfirmDialogHandle>(null);
  const report = useLabReport(r.id, r.status === 'COMPLETED'); // a report can only exist once the request is completed
  const next = NEXT_STATUS[r.status];
  const open = r.status !== 'COMPLETED' && r.status !== 'CANCELLED';

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title={r.testName} subtitle={`Lab request #${r.id} · ${r.accessionNumber ?? 'accession number pending'}`} actions={<><LabPriorityBadge status={r.priority} /><LabStatusBadge status={r.status} /></>} />
      <Card><CardContent className="pt-5">
        <DetailList columns={3} items={[
          { label: 'Patient', value: <Link className="text-brand-600 hover:underline" to={`/patients/${r.patientId}`}>{r.patientName}</Link> }, { label: 'Requested', value: formatDateTime(r.requestedAt) }, { label: 'Price', value: formatCurrency(r.price) },
          { label: 'Test code', value: r.testCode }, { label: 'Doctor id', value: `#${r.doctorId}` }, { label: 'Appointment', value: r.appointmentId ? <Link className="text-brand-600 hover:underline" to={`/appointments/${r.appointmentId}`}>#{r.appointmentId}</Link> : null },
          { label: 'Clinical notes', value: r.clinicalNotes, wide: true },
        ]} />
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Progress</CardTitle></CardHeader><CardContent><ol className="flex flex-wrap items-center gap-2 text-sm">{(['REQUESTED', 'SAMPLE_COLLECTED', 'IN_PROGRESS', 'COMPLETED'] as const).map((s, i, a) => { const idx = a.indexOf(r.status as typeof a[number]); const done = r.status === 'COMPLETED' || (idx >= 0 && i <= idx); return <li key={s} className="flex items-center gap-2"><Badge variant={done ? 'success' : 'neutral'}>{s.replace('_', ' ').toLowerCase()}</Badge>{i < a.length - 1 && <span className="text-muted">→</span>}</li>; })}{r.status === 'CANCELLED' && <li><Badge variant="danger">cancelled</Badge></li>}</ol></CardContent></Card>

      {open && (canProcess || canCancel) && (
        <div className="flex flex-wrap gap-2">
          {canProcess && next && <Button disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: r.id, status: next.to })}>{next.label}</Button>}
          {canCancel && <Button variant="destructive" onClick={() => confirm.current?.ask({ title: 'Cancel this lab request?', message: 'An unpaid lab bill is cancelled as well. Completed reports cannot be cancelled.', destructive: true, confirmLabel: 'Cancel request', onConfirm: () => cancel.mutateAsync(r.id).then(() => undefined) })}>Cancel request</Button>}
        </div>
      )}
      {r.status === 'IN_PROGRESS' && canProcess && !report.data && <ReportForm requestId={r.id} />}
      {report.data && <ReportCard requestId={r.id} canUpload={canProcess} />}
      {r.status === 'COMPLETED' && report.isError && <Notice tone="warning">The request is completed but the report could not be loaded: {errorMessage(report.error)}</Notice>}
      {(r.status === 'REQUESTED' || r.status === 'SAMPLE_COLLECTED') && <Notice>A report can be entered once the sample is being processed.</Notice>}
      <ConfirmDialog ref={confirm} />
    </div>
  );
}

function ReportForm({ requestId }: { requestId: number }) {
  const submit = useSubmitLabReport(requestId);
  const { register, control, handleSubmit, setError, formState: { errors } } = useForm<LabReportFormValues>({ resolver: zodResolver(labReportSchema), defaultValues: { resultSummary: '', resultDetails: '', referenceRange: '', abnormal: false } });
  return (
    <Card><CardHeader><CardTitle>Enter report</CardTitle></CardHeader><CardContent>
      <form noValidate className="grid gap-4" aria-label="Lab report form" onSubmit={handleSubmit(async (v) => {
        try { await submit.mutateAsync({ resultSummary: v.resultSummary.trim(), resultDetails: emptyToNull(v.resultDetails), referenceRange: emptyToNull(v.referenceRange), abnormal: v.abnormal }); toast.success('Report submitted - request completed'); }
        catch (e) { setError('root', { message: errorMessage(e) }); }
      })}>
        {errors.root && <p role="alert" className="text-sm text-red-600">{errors.root.message}</p>}
        <div className="grid gap-1.5"><Label htmlFor="rs">Result summary</Label><Input id="rs" {...register('resultSummary')} aria-invalid={!!errors.resultSummary} placeholder="e.g. Hemoglobin 9.1 g/dL (low)" />{errors.resultSummary && <p className="text-xs text-red-600">{errors.resultSummary.message}</p>}</div>
        <div className="grid gap-1.5"><Label htmlFor="rd">Details</Label><Textarea id="rd" rows={3} {...register('resultDetails')} /></div>
        <div className="grid gap-1.5"><Label htmlFor="rr">Reference range</Label><Input id="rr" {...register('referenceRange')} /></div>
        <Controller control={control} name="abnormal" render={({ field }) => (<label className="flex items-center gap-2 text-sm"><Checkbox checked={field.value} onCheckedChange={(c) => field.onChange(c === true)} aria-label="Abnormal result" /> Mark result as abnormal</label>)} />
        <div className="flex justify-end"><Button type="submit" disabled={submit.isPending}>{submit.isPending ? 'Submitting…' : 'Submit report'}</Button></div>
      </form>
    </CardContent></Card>
  );
}

function ReportCard({ requestId, canUpload }: { requestId: number; canUpload: boolean }) {
  const { data: report } = useLabReport(requestId, true);
  const upload = useUploadAttachment(requestId);
  const { download, isBusy } = useFileDownload();
  const dz = useRef<FileDropzoneHandle>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pct, setPct] = useState(0);
  if (!report) return null;
  const att = report.attachment;
  return (
    <Card>
      <CardHeader><div className="flex items-center justify-between"><CardTitle className="flex items-center gap-2"><FileCheck2 className="h-5 w-5 text-emerald-600" /> Report</CardTitle>{report.abnormal && <Badge variant="danger"><AlertTriangle className="h-3 w-3" /> Abnormal</Badge>}</div></CardHeader>
      <CardContent className="space-y-4">
        <DetailList items={[{ label: 'Result', value: report.resultSummary, wide: true }, { label: 'Details', value: report.resultDetails, wide: true }, { label: 'Reference range', value: report.referenceRange }, { label: 'Reported by', value: `${report.reportedBy} · ${formatDateTime(report.reportedAt)}` }]} />
        <div className="rounded-lg border border-line p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>{att ? <><b>{att.name}</b> <span className="text-muted">· {att.mimeType} · {formatBytes(att.sizeBytes)}</span></> : <span className="text-muted">No attachment uploaded</span>}</span>
            {att && <Button size="sm" variant="outline" disabled={isBusy('att')} onClick={() => void download('att', () => laboratoryApi.downloadAttachment(requestId).then((blob) => ({ blob, fileName: att.name })))}><Download className="h-4 w-4" /> {isBusy('att') ? 'Downloading…' : 'Download report'}</Button>}
          </div>
          {canUpload && (
            <div className="mt-3 space-y-2"><FileDropzone ref={dz} onFileChange={(f) => { setFile(f); setPct(0); }} disabled={upload.isPending} />
              {upload.isPending && <Progress value={pct} />}
              <div className="flex justify-end"><Button size="sm" disabled={!file || upload.isPending} onClick={() => file && upload.mutate({ file, onProgress: setPct }, { onSuccess: () => { dz.current?.clear(); setFile(null); } })}><Upload className="h-4 w-4" /> {att ? 'Replace attachment' : 'Upload attachment'}</Button></div></div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
