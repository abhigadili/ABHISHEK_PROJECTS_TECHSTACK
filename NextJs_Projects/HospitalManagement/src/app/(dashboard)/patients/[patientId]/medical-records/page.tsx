import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { FileDown, FlaskConical, Pill, Stethoscope } from 'lucide-react';
import { requirePermission } from '@/lib/auth/session';
import { recordsService } from '@/services/backend/records';
import { labService } from '@/services/backend/laboratory';
import { load, loadOptional, parseId } from '@/lib/api/guards';
import { RecordsTabs } from '@/features/records/RecordsTabs';
import { AddRecordEntry, ConditionsForm } from '@/features/records/RecordForms';
import { Card, CardBody } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { TableSkeleton } from '@/components/ui/skeleton';
import { can } from '@/constants/permissions';
import { formatDateTime, humanize } from '@/lib/utilities/format';
import { RECORD_ENTRY_TYPES, type RecordEntryType } from '@/types';
import Image from 'next/image';

export const metadata: Metadata = { title: 'Medical records', robots: { index: false } };
const icons: Record<string, typeof Pill> = { LAB_REPORT: FlaskConical, PRESCRIPTION: Pill };

/** SSR + Suspense: the page shell renders at once; each tab panel streams in behind its own <Suspense> boundary. */
async function Timeline({ patientId, type, page }: { patientId: number; type?: RecordEntryType; page: number }) {
  const res = await load(recordsService.entries(patientId, { type, page, size: 10 }));
  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2 text-sm"><Link href="?" className={`rounded-full border px-3 py-1 ${!type ? 'border-primary text-primary' : 'border-line text-muted'}`}>All</Link>{RECORD_ENTRY_TYPES.map((t) => <Link key={t} href={`?type=${t}`} className={`rounded-full border px-3 py-1 ${type === t ? 'border-primary text-primary' : 'border-line text-muted'}`}>{humanize(t)}</Link>)}</div>
      {res.content.length === 0 ? <EmptyState title="No entries" description="Diagnoses, visits and lab results will appear here." /> : (
        <ol className="space-y-3">{res.content.map((e) => { const I = icons[e.entryType] ?? Stethoscope; return (
          <li key={e.id}><Link href={`/medical-records/${e.id}`}><Card className="hover:border-primary"><CardBody className="flex gap-3"><I className="mt-1 size-5 shrink-0 text-primary" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{e.title}</p><Badge>{humanize(e.entryType)}</Badge>{e.source === 'EVENT' && <Badge tone="info">Automatic</Badge>}</div>{e.details && <p className="mt-1 line-clamp-2 text-sm text-muted">{e.details}</p>}<time className="num mt-1 block text-xs text-muted">{formatDateTime(e.recordedAt)}</time></div></CardBody></Card></Link></li>); })}</ol>
      )}
      <Pagination page={res.page} totalPages={res.totalPages} total={res.totalElements} basePath={`/patients/${patientId}/medical-records`} params={{ type }} />
    </>
  );
}
async function Conditions({ patientId, canEdit }: { patientId: number; canEdit: boolean }) {
  const summary = await load(recordsService.summary(patientId));
  return <ConditionsForm patientId={patientId} value={summary.chronicConditions ?? ''} canEdit={canEdit} />;
}
async function Documents({ patientId }: { patientId: number }) {
  const lab = await loadOptional(labService.byPatient(patientId));
  const completed = (lab ?? []).filter((r) => r.status === 'COMPLETED');
  const reports = await Promise.all(completed.map(async (r) => ({ r, report: await loadOptional(labService.report(r.id)).catch(() => null) }))); // parallel fetches
  const withFiles = reports.filter((x) => x.report?.attachment);
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_260px]">
      <div>{withFiles.length === 0 ? <EmptyState title="No documents" description="Only laboratory-report attachments are stored by the backend. Upload one from the Laboratory module." /> : <ul className="space-y-2">{withFiles.map(({ r, report }) => <li key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface p-3"><div><p className="font-medium">{r.testName}</p><p className="text-xs text-muted">{report!.attachment!.name} · {formatDateTime(report!.reportedAt)}</p></div><a className="inline-flex items-center gap-1 text-sm text-primary hover:underline" href={`/api/lab/requests/${r.id}/attachment`}><FileDown className="size-4" />Download</a></li>)}</ul>}</div>
      <figure className="hidden md:block"><Image src="/images/document-preview.png" alt="Illustration of a document preview" width={900} height={600} sizes="260px" quality={60} className="rounded-lg border border-line" /><figcaption className="mt-1 text-xs text-muted">Illustration only - not a patient document.</figcaption></figure>
    </div>
  );
}

export default async function PatientRecordsPage({ params, searchParams }: PageProps<'/patients/[patientId]/medical-records'>) {
  const patientId = parseId((await params).patientId);
  const s = await requirePermission('records:read');
  const sp = await searchParams;
  const type = RECORD_ENTRY_TYPES.find((t) => t === sp.type);
  const page = Math.max(0, Number(sp.page ?? 0) || 0);
  const canWrite = can(s.role, 'records:write');
  return (
    <>
      {canWrite && <div className="mb-3 flex justify-end"><AddRecordEntry patientId={patientId} /></div>}
      <RecordsTabs
        timeline={<Suspense key={`${type}-${page}`} fallback={<TableSkeleton rows={4} />}><Timeline patientId={patientId} type={type} page={page} /></Suspense>}
        conditions={<Suspense fallback={<TableSkeleton rows={2} />}><Conditions patientId={patientId} canEdit={canWrite} /></Suspense>}
        documents={<Suspense fallback={<TableSkeleton rows={3} />}><Documents patientId={patientId} /></Suspense>}
      />
    </>
  );
}
