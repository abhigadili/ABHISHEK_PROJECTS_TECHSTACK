import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, PackageCheck, XCircle, Check } from 'lucide-react';
import { useDispatchOrder, useOrdersInfinite, useRejectOrder } from '../hooks/usePharmacy';
import { PageHeader } from '@/components/common/PageHeader';
import { PharmacyOrderBadge } from '@/components/common/StatusBadge';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useThrottledCallback } from '@/hooks/useThrottle';
import { useCan } from '@/contexts/AuthContext';
import { formatCurrency, formatDateTime } from '@/utils/format';
import type { PharmacyOrder, PharmacyOrderStatus } from '@/types';

/** Pharmacy orders (shadcn/ui): infinite query with status tabs; auto-loads the next page (throttled IntersectionObserver); dispense / reject for pharmacists. */
export default function PharmacyOrdersPage() {
  const canManage = useCan('pharmacy:manage');
  const [status, setStatus] = useState<PharmacyOrderStatus | 'ALL'>('PENDING');
  const q = useOrdersInfinite(status === 'ALL' ? undefined : status);
  const dispense = useDispatchOrder();
  const reject = useRejectOrder();
  const [rejecting, setRejecting] = useState<PharmacyOrder | null>(null);
  const [reason, setReason] = useState('');
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = q;
  const more = useThrottledCallback(() => { if (hasNextPage && !isFetchingNextPage) void fetchNextPage(); }, 700);
  useEffect(() => { const el = sentinel.current; if (!el) return; const io = new IntersectionObserver((e) => e[0]?.isIntersecting && more(), { rootMargin: '100px' }); io.observe(el); return () => io.disconnect(); }, [more, q.data]);
  const rows = useMemo(() => q.data?.pages.flatMap((p) => p.content) ?? [], [q.data]);
  const total = q.data?.pages[0]?.totalElements ?? 0;

  return (
    <>
      <PageHeader title="Pharmacy orders" subtitle={`${total} order${total === 1 ? '' : 's'}`} icon={<PackageCheck className="h-5 w-5" />} />
      <Tabs value={status} onValueChange={(v) => setStatus(v as typeof status)} className="mb-4"><TabsList>{(['PENDING', 'DISPENSED', 'REJECTED', 'ALL'] as const).map((s) => <TabsTrigger key={s} value={s}>{s === 'ALL' ? 'All' : s[0] + s.slice(1).toLowerCase()}</TabsTrigger>)}</TabsList></Tabs>
      {q.isPending ? <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div> : q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : rows.length === 0 ? <EmptyState title="No orders" description={status === 'PENDING' ? 'Orders are created automatically when a prescription is issued.' : 'Nothing in this status.'} /> : (
        <div className="grid gap-3">
          {rows.map((o) => {
            const blocked = o.items.some((i) => !i.inStock);
            return (
              <Card key={o.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><div className="flex items-center gap-2 font-semibold">Order #{o.id} <PharmacyOrderBadge status={o.status} /></div><div className="text-xs text-muted">{o.patientName} · {o.doctorName} · <Link className="text-brand-600 hover:underline" to={`/prescriptions/${o.prescriptionId}`}>Rx #{o.prescriptionId}</Link> · {formatDateTime(o.createdAt)}</div></div>
                  <div className="text-right text-sm"><div className="font-bold">{formatCurrency(o.totalAmount)}</div>{o.dispensedBy && <div className="text-xs text-muted">by {o.dispensedBy}</div>}</div>
                </div>
                <ul className="mt-3 space-y-1 text-sm">{o.items.map((i, idx) => <li key={idx} className="flex justify-between"><span>{i.medicineName} {i.dosage} × {i.quantity}</span><span className={i.inStock ? 'text-emerald-600' : 'text-red-600'}>{i.inStock ? 'in stock' : 'not in inventory'}</span></li>)}</ul>
                {o.rejectionReason && <p className="mt-2 text-sm text-red-700">Rejected: {o.rejectionReason}</p>}
                {canManage && o.status === 'PENDING' && <div className="mt-3 flex gap-2 border-t border-line pt-3"><Button size="sm" disabled={blocked || dispense.isPending} title={blocked ? 'An item is not in inventory' : undefined} onClick={() => dispense.mutate(o.id)}><Check className="h-4 w-4" /> Dispense</Button><Button size="sm" variant="outline" onClick={() => { setReason(''); setRejecting(o); }}><XCircle className="h-4 w-4" /> Reject</Button></div>}
              </Card>
            );
          })}
          <div ref={sentinel} className="flex justify-center py-2">{hasNextPage ? <Button variant="outline" disabled={isFetchingNextPage} onClick={() => void fetchNextPage()}>{isFetchingNextPage ? <><Loader2 className="h-4 w-4 animate-spin" /> Loading…</> : 'Load more'}</Button> : <span className="text-xs text-muted">All orders loaded</span>}</div>
        </div>
      )}
      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent><DialogHeader><DialogTitle>Reject order #{rejecting?.id}</DialogTitle><DialogDescription>The prescription stays active; the reason is stored with the order.</DialogDescription></DialogHeader>
          <Input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} placeholder="Reason for rejection" aria-label="Rejection reason" />
          <DialogFooter><Button variant="outline" onClick={() => setRejecting(null)}>Cancel</Button><Button variant="destructive" disabled={!reason.trim() || reject.isPending} onClick={() => rejecting && reject.mutate({ id: rejecting.id, reason: reason.trim() }, { onSuccess: () => setRejecting(null) })}>Reject order</Button></DialogFooter></DialogContent>
      </Dialog>
    </>
  );
}
