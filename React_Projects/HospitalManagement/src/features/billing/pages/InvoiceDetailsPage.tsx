import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CreditCard, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useBill, useBillPayments, useCancelBill, useConfirmPayment, usePayBill } from '../hooks/useBilling';
import { PayDialog } from '../components/PayDialog';
import { QueryBoundary } from '@/components/common/QueryBoundary';
import { PageHeader } from '@/components/common/PageHeader';
import { DetailList } from '@/components/common/DetailList';
import { BillStatusBadge, PaymentStatusBadge } from '@/components/common/StatusBadge';
import { ConfirmDialog, type ConfirmDialogHandle } from '@/components/dialogs/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useCan } from '@/contexts/AuthContext';
import { errorMessage } from '@/services/axios/errors';
import { formatCurrency, formatDate, formatDateTime, humanize } from '@/utils/format';
import type { Bill, PaymentMethod } from '@/types';

export default function InvoiceDetailsPage() {
  const id = Number(useParams().billId);
  const query = useBill(id);
  return <QueryBoundary query={query}>{(b) => <Invoice bill={b} />}</QueryBoundary>;
}

function Invoice({ bill: b }: { bill: Bill }) {
  const canManage = useCan('billing:manage');
  const canPay = useCan('billing:pay');
  const payments = useBillPayments(b.id);
  const pay = usePayBill(b.id);
  const confirmPayment = useConfirmPayment(b.id);
  const cancel = useCancelBill();
  const confirm = useRef<ConfirmDialogHandle>(null);
  const [payOpen, setPayOpen] = useState(false);
  const due = Math.max(b.totalAmount - b.paidAmount, 0);
  const payable = b.status === 'PENDING' || b.status === 'OVERDUE';
  const inFlight = payments.data?.some((p) => p.status === 'PENDING');

  const startPay = async (method: PaymentMethod, outcome?: 'SUCCESS' | 'FAILURE') => {
    try {
      const p = await pay.mutateAsync({ method, simulateOutcome: outcome });
      toast[p.status === 'FAILED' ? 'error' : 'success'](p.status === 'FAILED' ? `Payment declined: ${p.failureReason ?? 'failed'}` : p.status === 'SUCCESS' ? 'Payment successful' : `Payment ${p.transactionRef} initiated - awaiting confirmation`);
    } catch (e) { throw new Error(errorMessage(e)); }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title={`Invoice ${b.billNumber}`} subtitle={`${humanize(b.billType)} · issued ${formatDate(b.createdAt)}`} actions={<BillStatusBadge status={b.status} />} />
      <Card className="p-5">
        <DetailList columns={3} items={[
          { label: 'Patient', value: <Link className="text-brand-600 hover:underline" to={`/patients/${b.patientId}`}>{b.patientName}</Link> }, { label: 'Due date', value: formatDate(b.dueDate) },
          { label: 'Reference', value: b.referenceType ? `${humanize(b.referenceType)} #${b.referenceId}` : null }, { label: 'Total', value: formatCurrency(b.totalAmount, b.currency) }, { label: 'Paid', value: formatCurrency(b.paidAmount, b.currency) }, { label: 'Balance', value: <b>{formatCurrency(due, b.currency)}</b> }, { label: 'Note', value: b.note, wide: true },
        ]} />
      </Card>
      <Card className="p-5"><h2 className="mb-3 font-semibold">Line items</h2>
        <table className="w-full text-sm"><thead><tr className="border-b border-line text-left text-xs uppercase text-muted"><th className="pb-2">Description</th><th className="pb-2 text-right">Qty</th><th className="pb-2 text-right">Unit price</th><th className="pb-2 text-right">Amount</th></tr></thead>
          <tbody>{b.items.map((it, i) => <tr key={i} className="border-b border-line last:border-0"><td className="py-2">{it.description}</td><td className="py-2 text-right">{it.quantity}</td><td className="py-2 text-right">{formatCurrency(it.unitPrice, b.currency)}</td><td className="py-2 text-right">{formatCurrency(it.amount, b.currency)}</td></tr>)}</tbody>
          <tfoot><tr><td colSpan={3} className="pt-3 text-right font-semibold">Total</td><td className="pt-3 text-right font-bold">{formatCurrency(b.totalAmount, b.currency)}</td></tr></tfoot></table>
      </Card>
      <Card className="p-5"><h2 className="mb-3 font-semibold">Payments</h2>
        <QueryBoundary query={payments} emptyTitle="No payments yet" emptyDescription={payable ? 'Pay this invoice to see the transaction here.' : undefined}>
          {(rows) => <ul className="divide-y divide-[var(--hms-border)] text-sm">{rows.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5"><span><span className="font-mono text-xs">{p.transactionRef}</span><span className="block text-xs text-muted">{humanize(p.method)} · {formatDateTime(p.initiatedAt)}{p.failureReason ? ` · ${p.failureReason}` : ''}</span></span>
              <span className="flex items-center gap-3">{formatCurrency(p.amount, b.currency)}<PaymentStatusBadge status={p.status} />
                {canManage && p.status === 'PENDING' && <><Button size="sm" variant="success" disabled={confirmPayment.isPending} onClick={() => confirmPayment.mutate({ ref: p.transactionRef, status: 'SUCCESS' })}>Confirm</Button><Button size="sm" variant="outline" disabled={confirmPayment.isPending} onClick={() => confirmPayment.mutate({ ref: p.transactionRef, status: 'FAILED', reason: 'Rejected by billing staff' })}>Fail</Button></>}</span></li>))}</ul>}
        </QueryBoundary>
      </Card>
      <div className="flex flex-wrap gap-2">
        {payable && canPay && <Button onClick={() => setPayOpen(true)} disabled={!!inFlight || pay.isPending}><CreditCard className="h-4 w-4" /> {inFlight ? 'Payment in progress' : `Pay ${formatCurrency(due, b.currency)}`}</Button>}
        {payable && canManage && <Button variant="destructive" onClick={() => confirm.current?.ask({ title: 'Cancel this invoice?', message: 'The patient will no longer be asked to pay it.', destructive: true, confirmLabel: 'Cancel invoice', onConfirm: () => cancel.mutateAsync(b.id).then(() => undefined) })}><XCircle className="h-4 w-4" /> Cancel invoice</Button>}
        <Button variant="outline" asChild><Link to="/billing/invoices">Back to invoices</Link></Button>
      </div>
      <PayDialog bill={b} open={payOpen} onClose={() => setPayOpen(false)} onPay={startPay} />
      <ConfirmDialog ref={confirm} />
    </div>
  );
}
