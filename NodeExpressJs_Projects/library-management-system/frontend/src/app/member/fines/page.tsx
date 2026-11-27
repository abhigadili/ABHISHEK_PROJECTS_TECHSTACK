'use client';
import Link from 'next/link';
import { Printer } from 'lucide-react';
import { useState } from 'react';
import { Alert, Button, Card, DataTable, EmptyState, PageHeader, Pagination, Stat, StatusBadge, Tabs } from '@/components/ui';
import { usePaged } from '@/hooks/useApi';
import { fmtDate, fmtDateTime, money, titleCase } from '@/lib/format';
import type { Fine, Payment } from '@/lib/types';

export default function MyFinesPage() {
  const [tab, setTab] = useState('fines'); const [page, setPage] = useState(1);
  const f = usePaged<Fine>(tab === 'fines' ? `/fines/mine?page=${page}` : null);
  const p = usePaged<Payment>(tab === 'payments' ? `/payments/mine?page=${page}` : null);
  const outstanding = Number((f.meta as any)?.outstanding ?? 0);
  return (
    <>
      <PageHeader title="Dues & payments" subtitle="Fines are paid at the library desk; payments appear here with a printable receipt." />
      <div className="mb-4 grid gap-4 sm:grid-cols-3"><Stat label="Outstanding balance" value={money(outstanding)} tone={outstanding > 0 ? 'red' : 'green'} hint={outstanding > 0 ? 'Please settle at the desk' : 'Nothing owing'} /></div>
      {outstanding > 0 && <div className="mb-4"><Alert tone="amber">Unpaid fines can block new loans once they reach the library’s limit.</Alert></div>}
      <Tabs tabs={[{ key: 'fines', label: 'Fines' }, { key: 'payments', label: 'Payment history' }]} value={tab} onChange={(k) => { setTab(k); setPage(1); }} />
      <Card className="!p-0">
        {tab === 'fines' ? (<>
          <DataTable rows={f.rows} loading={f.loading} error={f.error} onRetry={f.reload} rowKey={(x) => x.id} empty={<EmptyState title="No fines" description="You have no fines on record." />}
            columns={[{ header: 'Date', cell: (x) => fmtDate(x.createdAt) }, { header: 'Type', cell: (x) => titleCase(x.fineType) }, { header: 'Reason', cell: (x) => <span>{x.reason}{x.waiverReason && <span className="block text-xs text-slate-500">Waived: {x.waiverReason}</span>}</span> },
              { header: 'Amount', cell: (x) => money(x.amount) }, { header: 'Paid / waived', cell: (x) => `${money(x.paidAmount)} / ${money(x.waivedAmount)}` }, { header: 'Balance', cell: (x) => <b className={x.outstanding > 0 ? 'text-red-700' : ''}>{money(x.outstanding)}</b> }, { header: 'Status', cell: (x) => <StatusBadge status={x.status} /> }]} />
          <Pagination meta={f.meta} onPage={setPage} /></>) : (<>
          <DataTable rows={p.rows} loading={p.loading} error={p.error} onRetry={p.reload} rowKey={(x) => x.id} empty={<EmptyState title="No payments yet" />}
            columns={[{ header: 'Date', cell: (x) => fmtDateTime(x.createdAt) }, { header: 'Receipt', cell: (x) => <span className="font-mono text-xs">{x.receiptNumber}</span> }, { header: 'Type', cell: (x) => <StatusBadge status={x.kind} /> }, { header: 'Method', cell: (x) => titleCase(x.method) },
              { header: 'Amount', cell: (x) => <b>{x.kind === 'refund' ? '−' : ''}{money(x.amount)}</b> }, { header: '', cell: (x) => <Link href={`/receipt/${x.id}`} target="_blank"><Button size="sm" variant="secondary"><Printer className="h-3.5 w-3.5" />Receipt</Button></Link> }]} />
          <Pagination meta={p.meta} onPage={setPage} /></>)}
      </Card>
    </>
  );
}
