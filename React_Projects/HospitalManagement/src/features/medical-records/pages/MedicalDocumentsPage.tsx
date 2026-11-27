import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, FileText, Upload } from 'lucide-react';
import { useDocumentCandidates, useLabReportFetch, useUploadDocument } from '../hooks/useRecords';
import { recordsApi } from '@/services/endpoints/recordsApi';
import { usePatient } from '@/features/patients/hooks/usePatients';
import { useCurrentPatient } from '@/features/authentication/hooks/useCurrentIdentity';
import { FileDropzone, type FileDropzoneHandle } from '@/components/forms/FileDropzone';
import { PatientPicker } from '@/components/common/PatientPicker';
import { PageHeader } from '@/components/common/PageHeader';
import { QueryBoundary } from '@/components/common/QueryBoundary';
import { Notice } from '@/components/common/Notice';
import { LabStatusBadge } from '@/components/common/StatusBadge';
import { useFileDownload } from '@/hooks/useFileDownload';
import { useAuth, useCan } from '@/contexts/AuthContext';
import { formatBytes, formatDateTime } from '@/utils/format';
import type { LabRequest, Patient } from '@/types';
import styles from '../records.module.css';

/**
 * Medical documents. The backend stores exactly one kind of document: the PDF/PNG/JPEG attached to a lab report
 * (/lab/requests/{id}/report/attachment). This page lists them per patient and downloads/uploads them with the FETCH API
 * (blob download, multipart upload); the Laboratory module does the same with Axios.
 */
export default function MedicalDocumentsPage() {
  const { role } = useAuth();
  const [params, setParams] = useSearchParams();
  const own = useCurrentPatient();
  const [picked, setPicked] = useState<Patient | null>(null);
  const urlId = Number(params.get('patientId')) || 0;
  const patientId = role === 'PATIENT' ? (own.patient?.id ?? 0) : (picked?.id ?? urlId);
  const patient = usePatient(patientId, patientId > 0 && role !== 'PATIENT');

  return (
    <div className={styles.page}>
      <PageHeader title="Medical documents" subtitle="Report attachments stored with lab reports" icon={<FileText className="h-5 w-5" />} />
      {role !== 'PATIENT' && (
        <div className={styles.card} style={{ maxWidth: 560 }}>
          <PatientPicker value={picked ?? (patient.data ?? null)} onChange={(p) => { setPicked(p); setParams(p ? { patientId: String(p.id) } : {}); }} />
        </div>
      )}
      {patientId > 0 ? <DocumentList patientId={patientId} /> : role !== 'PATIENT' ? <Notice>Select a patient to list their documents.</Notice> : null}
    </div>
  );
}

function DocumentList({ patientId }: { patientId: number }) {
  const query = useDocumentCandidates(patientId);
  return (
    <div className={styles.card} style={{ padding: 0 }}>
      <QueryBoundary query={query} emptyTitle="No lab requests" emptyDescription="Documents appear here once a lab report has an attachment.">
        {(rows) => <>{rows.map((r) => <DocumentRow key={r.id} request={r} />)}</>}
      </QueryBoundary>
    </div>
  );
}

function DocumentRow({ request: r }: { request: LabRequest }) {
  const canUpload = useCan('lab:process');
  const report = useLabReportFetch(r.id, r.status === 'COMPLETED');
  const { download, cancel, isBusy } = useFileDownload();
  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const dz = useRef<FileDropzoneHandle>(null);
  const upload = useUploadDocument(r.id);
  const att = report.data?.attachment;

  return (
    <div className={styles.docRow} style={{ alignItems: 'flex-start', flexDirection: 'column' }}>
      <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 600 }}>{r.testName} <span className={styles.muted}>· {r.accessionNumber ?? 'accession pending'}</span></div>
          <div className={styles.muted}>Requested {formatDateTime(r.requestedAt)} · <LabStatusBadge status={r.status} /></div>
          {att ? <div className={styles.muted}>{att.name} · {att.mimeType} · {formatBytes(att.sizeBytes)}</div> : <div className={styles.muted}>{r.status !== 'COMPLETED' ? 'Report not ready' : report.isPending ? 'Checking…' : 'No attachment on this report'}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {att && <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => (isBusy(`d${r.id}`) ? cancel(`d${r.id}`) : void download(`d${r.id}`, (signal) => recordsApi.downloadDocument(r.id, signal).then((d) => ({ blob: d.blob, fileName: att.name || d.fileName }))))}><Download size={14} /> {isBusy(`d${r.id}`) ? 'Cancel download' : 'Download'}</button>}
          {canUpload && report.data && <button type="button" className={styles.btn} onClick={() => setShowUpload((v) => !v)}><Upload size={14} /> {att ? 'Replace' : 'Upload'}</button>}
        </div>
      </div>
      {showUpload && (
        <div style={{ width: '100%', marginTop: 8 }}>
          <FileDropzone ref={dz} onFileChange={setFile} disabled={upload.isPending} />
          <div className={styles.dialogActions}><button type="button" className={`${styles.btn} ${styles.btnPrimary}`} disabled={!file || upload.isPending} onClick={() => file && upload.mutate(file, { onSuccess: () => { dz.current?.clear(); setShowUpload(false); } })}>{upload.isPending ? 'Uploading…' : 'Upload document'}</button></div>
        </div>
      )}
    </div>
  );
}
