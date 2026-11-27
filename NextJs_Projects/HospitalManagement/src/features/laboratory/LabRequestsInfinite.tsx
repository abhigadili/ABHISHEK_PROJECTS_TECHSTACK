'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { labApi } from '@/services/api/clientApis';
import { keys } from '@/services/queryKeys';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/skeleton';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDateTime } from '@/lib/utilities/format';

const PAGE = 15;
/**
 * TanStack useInfiniteQuery over the paged `/lab/requests` endpoint: each page is fetched on demand ("Load more" button OR an
 * IntersectionObserver sentinel = infinite scrolling), pages are cached together, and the client filters the loaded rows (debounced search).
 */
export function LabRequestsInfinite() {
  const [status, setStatus] = useState('');
  const [text, setText] = useState('');
  const term = useDebounce(text, 300);
  const q = useInfiniteQuery({
    queryKey: keys.lab.requests(status),
    queryFn: ({ pageParam, signal }) => labApi.requests({ status: status || undefined, page: pageParam, size: PAGE }, signal),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.page + 1 < last.totalPages ? last.page + 1 : undefined),
    staleTime: 15_000,
  });
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage(); }, { rootMargin: '200px' });
    io.observe(el); return () => io.disconnect();
  }, [q]);
  const rows = useMemo(() => (q.data?.pages.flatMap((p) => p.content) ?? []).filter((r) => !term || `${r.patientName} ${r.testName} ${r.accessionNumber ?? ''}`.toLowerCase().includes(term.toLowerCase())), [q.data, term]);
  const total = q.data?.pages[0]?.totalElements ?? 0;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2"><Input className="w-64" placeholder="Filter loaded rows…" aria-label="Filter lab requests" value={text} onChange={(e) => setText(e.target.value)} /><Select className="w-52" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{['REQUESTED', 'SAMPLE_COLLECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ').toLowerCase()}</option>)}</Select><span className="num ml-auto self-center text-sm text-muted">{rows.length} shown · {total} total</span></div>
      {q.isPending ? <TableSkeleton /> : q.isError ? <ErrorState message={q.error.message} action={<Button onClick={() => void q.refetch()}>Retry</Button>} /> : rows.length === 0 ? <EmptyState title="No lab requests" /> : (
        <Table><THead><TR><TH>Test</TH><TH>Patient</TH><TH>Priority</TH><TH>Requested</TH><TH>Accession</TH><TH>Status</TH></TR></THead><TBody>{rows.map((r) => <TR key={r.id}><TD><Link className="font-medium text-primary hover:underline" href={`/laboratory/${r.id}`}>{r.testName}</Link></TD><TD>{r.patientName}</TD><TD><StatusBadge status={r.priority} /></TD><TD>{formatDateTime(r.requestedAt)}</TD><TD className="font-mono text-xs">{r.accessionNumber ?? '—'}</TD><TD><StatusBadge status={r.status} /></TD></TR>)}</TBody></Table>
      )}
      <div ref={sentinel} className="flex justify-center py-2">{q.hasNextPage ? <Button variant="outline" loading={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>Load more</Button> : rows.length > 0 && <span className="text-xs text-muted">All requests loaded</span>}</div>
    </div>
  );
}
