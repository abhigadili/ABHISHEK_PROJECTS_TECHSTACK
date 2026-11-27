import { useMemo, useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, Loader2 } from 'lucide-react';
import { useLabRequestsInfinite, usePatientLab } from '../hooks/useLab';
import { LabPriorityBadge, LabStatusBadge } from '@/components/common/StatusBadge';
import { PageHeader } from '@/components/common/PageHeader';
import { QueryBoundary } from '@/components/common/QueryBoundary';
import { PatientPicker } from '@/components/common/PatientPicker';
import { ErrorState } from '@/components/common/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useThrottledCallback } from '@/hooks/useThrottle';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentPatient } from '@/features/authentication/hooks/useCurrentIdentity';
import { formatDateTime, humanize } from '@/utils/format';
import { LAB_STATUSES } from '../constants';
import type { LabRequest, LabStatus, Patient } from '@/types';

/**
 * Lab test history (shadcn/ui). Staff: useInfiniteQuery - pages are appended with "Load more" and automatically when the
 * sentinel scrolls into view (IntersectionObserver, throttled). A patient filter narrows the view to one patient's history.
 */
export default function LabHistoryPage() {
  const { role } = useAuth();
  const own = useCurrentPatient();
  const [status, setStatus] = useState<LabStatus | 'all'>('all');
  const [patient, setPatient] = useState<Patient | null>(null);
  const infinite = useLabRequestsInfinite(status === 'all' ? undefined : status, 10, role !== 'PATIENT');
  const byPatient = usePatientLab(role === 'PATIENT' ? (own.patient?.id ?? 0) : (patient?.id ?? 0));
  const navigate = useNavigate();
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = infinite;
  const loadMore = useThrottledCallback(() => { if (hasNextPage && !isFetchingNextPage) void fetchNextPage(); }, 600);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || role === 'PATIENT' || patient) return;
    const io = new IntersectionObserver((e) => e[0]?.isIntersecting && loadMore(), { rootMargin: '120px' });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, role, patient, infinite.data]);

  const rows = useMemo(() => infinite.data?.pages.flatMap((p) => p.content) ?? [], [infinite.data]);
  const total = infinite.data?.pages[0]?.totalElements ?? 0;
  const item = (r: LabRequest) => (
    <li key={r.id}><button type="button" onClick={() => navigate(`/lab/requests/${r.id}`)} className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left text-sm hover:bg-black/[0.03] dark:hover:bg-white/5">
      <span><b>{r.testName}</b> <span className="text-muted">· {r.patientName} · {r.accessionNumber ?? 'accession pending'}</span><span className="block text-xs text-muted">{formatDateTime(r.requestedAt)}</span></span>
      <span className="flex gap-2"><LabPriorityBadge status={r.priority} /><LabStatusBadge status={r.status} /></span></button></li>
  );

  return (
    <>
      <PageHeader title="Lab test history" subtitle={role === 'PATIENT' ? 'Everything requested for you' : `${total} requests · newest first`} icon={<History className="h-5 w-5" />} />
      {role !== 'PATIENT' && (
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <div className="w-full max-w-xs"><PatientPicker value={patient} onChange={setPatient} label="Filter by patient (optional)" /></div>
          {!patient && <div className="grid gap-1.5 text-sm font-medium">Status<Select value={status} onValueChange={(v) => setStatus(v as LabStatus | 'all')}><SelectTrigger className="w-44" aria-label="Status filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{LAB_STATUSES.map((s) => <SelectItem key={s} value={s}>{humanize(s)}</SelectItem>)}</SelectContent></Select></div>}
        </div>
      )}
      {role === 'PATIENT' || patient ? (
        <QueryBoundary query={byPatient} emptyTitle="No lab history">{(rows2) => <Card><ul className="divide-y divide-[var(--hms-border)]">{rows2.map(item)}</ul></Card>}</QueryBoundary>
      ) : infinite.isPending ? <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>
        : infinite.isError ? <ErrorState error={infinite.error} onRetry={() => void infinite.refetch()} />
        : rows.length === 0 ? <p className="text-sm text-muted">No lab requests found.</p>
        : (<><Card><ul className="divide-y divide-[var(--hms-border)]" aria-label="Lab history">{rows.map(item)}</ul></Card>
          <div ref={sentinel} className="flex justify-center py-4">{hasNextPage ? <Button variant="outline" onClick={() => void fetchNextPage()} disabled={isFetchingNextPage}>{isFetchingNextPage ? <><Loader2 className="h-4 w-4 animate-spin" /> Loading…</> : 'Load more'}</Button> : <span className="text-xs text-muted">All {total} requests loaded</span>}</div></>)}
    </>
  );
}
