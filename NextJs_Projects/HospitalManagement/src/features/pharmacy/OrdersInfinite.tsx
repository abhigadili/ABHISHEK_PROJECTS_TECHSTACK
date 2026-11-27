'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { pharmacyApi } from '@/services/api/clientApis';
import { keys } from '@/services/queryKeys';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatDateTime } from '@/lib/utilities/format';

/** Infinite Query over the paged pharmacy orders endpoint ("Load more"); the status filter is part of the query key so each filter has its own cache. */
export function OrdersInfinite() {
  const [status, setStatus] = useState('');
  const q = useInfiniteQuery({ queryKey: keys.pharmacy.orders(status), queryFn: ({ pageParam, signal }) => pharmacyApi.orders({ status: status || undefined, page: pageParam, size: 15 }, signal), initialPageParam: 0, getNextPageParam: (l) => (l.page + 1 < l.totalPages ? l.page + 1 : undefined), refetchInterval: 20_000 });
  const rows = q.data?.pages.flatMap((p) => p.content) ?? [];
  return (
    <div className="space-y-4">
      <Select className="w-48" aria-label="Order status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All orders</option><option value="PENDING">Pending</option><option value="DISPENSED">Dispensed</option><option value="REJECTED">Rejected</option></Select>
      {q.isPending ? <TableSkeleton /> : q.isError ? <ErrorState message={q.error.message} action={<Button onClick={() => void q.refetch()}>Retry</Button>} /> : rows.length === 0 ? <EmptyState title="No pharmacy orders" description="Orders are created automatically when a prescription is issued." /> : (
        <Table><THead><TR><TH>Order</TH><TH>Prescription</TH><TH>Patient</TH><TH>Doctor</TH><TH>Total</TH><TH>Created</TH><TH>Status</TH></TR></THead><TBody>{rows.map((o) => <TR key={o.id}><TD><Link className="font-medium text-primary hover:underline" href={`/pharmacy/orders/${o.id}`}>#{o.id}</Link></TD><TD>#{o.prescriptionId}</TD><TD>{o.patientName}</TD><TD>{o.doctorName}</TD><TD className="num">{formatCurrency(o.totalAmount)}</TD><TD>{formatDateTime(o.createdAt)}</TD><TD><StatusBadge status={o.status} /></TD></TR>)}</TBody></Table>
      )}
      {q.hasNextPage && <div className="text-center"><Button variant="outline" loading={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>Load more</Button></div>}
    </div>
  );
}
