import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePermission } from '@/lib/auth/session';
import { billingService } from '@/services/backend/billing';
import { load, parseId } from '@/lib/api/guards';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/badge';
import { PaymentPanel } from '@/features/billing/PaymentPanel';
import { can } from '@/constants/permissions';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utilities/format';

export const metadata: Metadata = { title: 'Invoice', robots: { index: false } };
/** SSR with authentication + authorization; bill and payments are fetched sequentially-in-parallel (bill first for auth/404, payments next); never cached. */
export default async function InvoicePage({ params }: PageProps<'/billing/invoices/[invoiceId]'>) {
  const s = await requirePermission('billing:read');
  const id = parseId((await params).invoiceId);
  const bill = await load(billingService.get(id));
  const payments = await load(billingService.payments(id)); // sequential: only after the bill is known to exist and be readable
  return (
    <>
      <PageHeader title={`Invoice ${bill.billNumber}`} description={`${bill.patientName} · due ${formatDate(bill.dueDate)}`} actions={<Link className="text-sm text-primary hover:underline" href="/billing/invoices">← All invoices</Link>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card><CardHeader><CardTitle>Items</CardTitle><span className="text-sm text-muted">{bill.billType}</span></CardHeader><CardBody className="p-0"><Table><THead><TR><TH>Description</TH><TH>Qty</TH><TH>Unit price</TH><TH>Amount</TH></TR></THead><TBody>{bill.items.map((i, n) => <TR key={n}><TD>{i.description}</TD><TD className="num">{i.quantity}</TD><TD className="num">{formatCurrency(i.unitPrice, bill.currency)}</TD><TD className="num">{formatCurrency(i.amount, bill.currency)}</TD></TR>)}<TR><TD colSpan={3} className="text-right font-medium">Total</TD><TD className="num font-semibold">{formatCurrency(bill.totalAmount, bill.currency)}</TD></TR></TBody></Table></CardBody></Card>
          <Card><CardHeader><CardTitle>Payments</CardTitle></CardHeader><CardBody className="p-0">{payments.length === 0 ? <p className="p-5 text-sm text-muted">No payments yet.</p> : <Table><THead><TR><TH>Reference</TH><TH>Method</TH><TH>Amount</TH><TH>Started</TH><TH>Status</TH></TR></THead><TBody>{payments.map((p) => <TR key={p.id}><TD className="font-mono text-xs">{p.transactionRef}</TD><TD>{p.method.replace('_', ' ')}</TD><TD className="num">{formatCurrency(p.amount)}</TD><TD>{formatDateTime(p.initiatedAt)}</TD><TD><StatusBadge status={p.status} />{p.failureReason && <span className="ml-2 text-xs text-muted">{p.failureReason}</span>}</TD></TR>)}</TBody></Table>}</CardBody></Card>
        </div>
        <Card><CardHeader><CardTitle>Payment</CardTitle></CardHeader><CardBody><PaymentPanel bill={bill} payments={payments} /></CardBody></Card>
      </div>
      {can(s.role, 'patients:read') && <p className="mt-4 text-sm"><Link className="text-primary hover:underline" href={`/patients/${bill.patientId}/billing`}>All bills for this patient →</Link></p>}
    </>
  );
}
