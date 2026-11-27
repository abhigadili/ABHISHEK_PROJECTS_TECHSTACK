'use client';
import { useActionState, useEffect, useOptimistic, useTransition } from 'react';
import { confirmPaymentAction, payBillAction, cancelBillAction } from '@/actions/billing';
import { SubmitButton } from '@/features/SubmitButton';
import { Button } from '@/components/ui/button';
import { Field, Select } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/empty-state';
import { emitToast } from '@/components/ui/toast';
import { useAuth } from '@/components/providers/AuthProvider';
import { formatCurrency } from '@/lib/utilities/format';
import type { Bill, Payment } from '@/types';
import type { ActionState } from '@/lib/actions/state';

const METHODS = ['CARD', 'UPI', 'NET_BANKING', 'CASH', 'INSURANCE'];
/** Scenario 6: pay (form action, FormData) → status (sequential). Staff may simulate outcomes and confirm pending payments. Status badge updates optimistically. */
export function PaymentPanel({ bill, payments }: { bill: Bill; payments: Payment[] }) {
  const { can, user } = useAuth();
  const isStaff = user.role !== 'PATIENT';
  const [state, action] = useActionState<ActionState<Payment>, FormData>(payBillAction, { ok: false });
  const [status, setStatus] = useOptimistic(bill.status, (_c, n: Bill['status']) => n);
  const [pending, start] = useTransition();
  useEffect(() => { if (state.message) emitToast({ kind: state.ok && state.data?.status !== 'FAILED' ? 'success' : 'error', text: state.message }); }, [state]);
  const outstanding = bill.totalAmount - bill.paidAmount;
  const pendingPayments = payments.filter((p) => p.status === 'PENDING');
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><span className="text-sm text-muted">Outstanding</span><span className="num text-xl font-semibold">{formatCurrency(Math.max(outstanding, 0), bill.currency)}</span></div>
      <StatusBadge status={status} />
      {status === 'PENDING' && can('billing:pay') && (
        <form action={(fd) => { setStatus('PAID'); action(fd); }} className="space-y-3 border-t border-line pt-3"><input type="hidden" name="billId" value={bill.id} />
          <Field label="Payment method" htmlFor="method" error={state.fieldErrors?.method}><Select id="method" name="method" defaultValue="UPI">{METHODS.map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}</Select></Field>
          {isStaff && <Field label="Simulated outcome (test gateway)" htmlFor="simulateOutcome"><Select id="simulateOutcome" name="simulateOutcome" defaultValue=""><option value="">Gateway default (pending)</option><option value="SUCCESS">Force success</option><option value="FAILURE">Force failure</option></Select></Field>}
          <SubmitButton className="w-full" pendingText="Processing payment…">Pay {formatCurrency(outstanding, bill.currency)}</SubmitButton>
          <p className="text-xs text-muted">The backend simulates the gateway; no card data is collected here.</p></form>
      )}
      {state.message && !state.ok && <Alert tone="danger">{state.message}</Alert>}
      {can('billing:manage') && pendingPayments.map((p) => <div key={p.id} className="rounded-lg border border-warn/40 bg-warn/10 p-3 text-sm"><p className="font-mono text-xs">{p.transactionRef}</p><p>{formatCurrency(p.amount)} via {p.method} awaiting confirmation</p><div className="mt-2 flex gap-2"><Button size="sm" disabled={pending} onClick={() => start(async () => { const r = await confirmPaymentAction(bill.id, p.transactionRef, 'SUCCESS'); emitToast({ kind: r.ok ? 'success' : 'error', text: r.message ?? '' }); })}>Confirm success</Button><Button size="sm" variant="danger" disabled={pending} onClick={() => start(async () => { const r = await confirmPaymentAction(bill.id, p.transactionRef, 'FAILED'); emitToast({ kind: r.ok ? 'success' : 'error', text: r.message ?? '' }); })}>Mark failed</Button></div></div>)}
      {can('billing:manage') && bill.status === 'PENDING' && <Button variant="outline" size="sm" disabled={pending} onClick={() => { if (confirm('Cancel this bill?')) start(async () => { setStatus('CANCELLED'); const r = await cancelBillAction(bill.id); emitToast({ kind: r.ok ? 'success' : 'error', text: r.message ?? '' }); }); }}>Cancel bill</Button>}
    </div>
  );
}
