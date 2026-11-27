import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ClipboardCheck, Download, Loader2 } from 'lucide-react';
import { useLabReports, useLabRequestsInfinite, usePatientLab } from '../hooks/useLab';
import { laboratoryApi } from '@/services/endpoints/laboratoryApi';
import { PageHeader } from '@/components/common/PageHeader';
import { QueryBoundary } from '@/components/common/QueryBoundary';
import { ErrorState } from '@/components/common/ErrorState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentPatient } from '@/features/authentication/hooks/useCurrentIdentity';
import { useFileDownload } from '@/hooks/useFileDownload';
import { formatDateTime } from '@/utils/format';
import type { LabRequest } from '@/types';

/**
 * Completed lab reports (shadcn/ui). Completed requests come from an infinite query; the report of every loaded row is
 * fetched in parallel (dynamic useQueries) so the summary and the abnormal flag are visible without opening each request.
 */
export default function LabReportsPage() {
  const { role } = useAuth();
  const own = useCurrentPatient();
  const inf = useLabRequestsInfinite('COMPLETED', 8, role !== 'PATIENT');
  const mine = usePatientLab(role === 'PATIENT' ? (own.patient?.id ?? 0) : 0);
  const rows = useMemo<LabRequest[]>(() => (role === 'PATIENT' ? (mine.data ?? []).filter((r) => r.status === 'COMPLETED') : (inf.data?.pages.flatMap((p) => p.content) ?? [])), [role, mine.data, inf.data]);
  return (
    <>
      <PageHeader title="Lab reports" subtitle="Completed investigations and their results" icon={<ClipboardCheck className="h-5 w-5" />} />
      {role === 'PATIENT' ? (
        <QueryBoundary query={mine} isEmpty={() => rows.length === 0} emptyTitle="No completed reports yet">{() => <ReportList rows={rows} />}</QueryBoundary>
      ) : inf.isPending ? <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div> : inf.isError ? <ErrorState error={inf.error} onRetry={() => void inf.refetch()} /> : rows.length === 0 ? <p className="text-sm text-muted">No reports have been completed yet.</p> : (
        <>
          <ReportList rows={rows} />
          <div className="flex justify-center py-4">{inf.hasNextPage ? <Button variant="outline" disabled={inf.isFetchingNextPage} onClick={() => void inf.fetchNextPage()}>{inf.isFetchingNextPage ? <><Loader2 className="h-4 w-4 animate-spin" /> Loading…</> : 'Load more reports'}</Button> : <span className="text-xs text-muted">All reports loaded</span>}</div>
        </>
      )}
    </>
  );
}

function ReportList({ rows }: { rows: LabRequest[] }) {
  const navigate = useNavigate();
  const reports = useLabReports(rows.map((r) => r.id));
  const { download, isBusy } = useFileDownload();
  return (
    <div className="grid gap-3">
      {rows.map((r, i) => {
        const q = reports[i];
        const rep = q?.data;
        return (
          <Card key={r.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => navigate(`/lab/requests/${r.id}`)}>
                <div className="flex flex-wrap items-center gap-2"><b>{r.testName}</b>{rep?.abnormal && <Badge variant="danger"><AlertTriangle className="h-3 w-3" /> Abnormal</Badge>}</div>
                <div className="text-xs text-muted">{r.patientName} · {r.accessionNumber ?? '—'} · reported {rep ? formatDateTime(rep.reportedAt) : '…'}</div>
                <p className="mt-1 text-sm">{q?.isPending ? <Skeleton className="h-4 w-64" /> : rep ? rep.resultSummary : <span className="text-muted">Report not available</span>}</p>
              </button>
              {rep?.attachment && <Button size="sm" variant="outline" disabled={isBusy(`r${r.id}`)} onClick={() => void download(`r${r.id}`, () => laboratoryApi.downloadAttachment(r.id).then((blob) => ({ blob, fileName: rep.attachment!.name })))}><Download className="h-4 w-4" /> {isBusy(`r${r.id}`) ? '…' : 'Download'}</Button>}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
