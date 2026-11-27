import { useReducer } from 'react';
import { Modal } from '@/components/dialogs/Modal';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/utils/format';
import type { Bill, PaymentMethod } from '@/types';

/**
 * Payment dialog whose state machine is a useReducer: choose method -> (optional) simulated outcome -> submit -> done/error.
 * Reducer state is explicit so impossible combinations (e.g. submitting twice) cannot occur.
 */
export const METHODS: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'UPI', label: 'UPI' }, { value: 'CARD', label: 'Card' }, { value: 'NET_BANKING', label: 'Net banking' }, { value: 'CASH', label: 'Cash (front desk)' }, { value: 'INSURANCE', label: 'Insurance' },
];

type State = { method: PaymentMethod; outcome: 'DEFAULT' | 'SUCCESS' | 'FAILURE'; phase: 'idle' | 'submitting' | 'error'; error?: string };
type Action = { type: 'method'; method: PaymentMethod } | { type: 'outcome'; outcome: State['outcome'] } | { type: 'submit' } | { type: 'fail'; error: string } | { type: 'reset' };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'method': return { ...s, method: a.method, phase: 'idle', error: undefined };
    case 'outcome': return { ...s, outcome: a.outcome };
    case 'submit': return s.phase === 'submitting' ? s : { ...s, phase: 'submitting', error: undefined };
    case 'fail': return { ...s, phase: 'error', error: a.error };
    case 'reset': return { method: 'UPI', outcome: 'DEFAULT', phase: 'idle' };
  }
}

export function PayDialog({ bill, open, onClose, onPay }: { bill: Bill | null; open: boolean; onClose: () => void; onPay: (method: PaymentMethod, outcome?: 'SUCCESS' | 'FAILURE') => Promise<void> }) {
  const [s, dispatch] = useReducer(reducer, { method: 'UPI', outcome: 'DEFAULT', phase: 'idle' });
  if (!bill) return null;
  const due = Math.max(bill.totalAmount - bill.paidAmount, 0);
  const submit = async () => {
    dispatch({ type: 'submit' });
    try {
      await onPay(s.method, s.outcome === 'DEFAULT' ? undefined : s.outcome);
      dispatch({ type: 'reset' });
      onClose();
    } catch (e) {
      dispatch({ type: 'fail', error: e instanceof Error ? e.message : 'Payment failed' });
    }
  };
  return (
    <Modal open={open} onClose={() => { if (s.phase !== 'submitting') { dispatch({ type: 'reset' }); onClose(); } }} title={`Pay invoice ${bill.billNumber}`} size="sm"
      footer={<><Button variant="outline" disabled={s.phase === 'submitting'} onClick={() => { dispatch({ type: 'reset' }); onClose(); }}>Cancel</Button><Button disabled={s.phase === 'submitting'} onClick={() => void submit()}>{s.phase === 'submitting' ? 'Processing…' : `Pay ${formatCurrency(due, bill.currency)}`}</Button></>}>
      <div className="space-y-4">
        <p className="text-muted">Amount due <b className="text-fg">{formatCurrency(due, bill.currency)}</b>. No card details are collected: the backend accepts only the payment method and simulates the gateway.</p>
        <fieldset><legend className="mb-1.5 text-sm font-medium">Payment method</legend>
          <div className="grid grid-cols-2 gap-2">{METHODS.map((m) => <label key={m.value} className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${s.method === m.value ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/20' : 'border-line'}`}><input type="radio" name="method" checked={s.method === m.value} onChange={() => dispatch({ type: 'method', method: m.value })} /> {m.label}</label>)}</div>
        </fieldset>
        <label className="block text-sm font-medium">Simulated gateway result<select value={s.outcome} onChange={(e) => dispatch({ type: 'outcome', outcome: e.target.value as State['outcome'] })} className="mt-1 h-9 w-full rounded-md border border-line bg-surface px-2 text-sm"><option value="DEFAULT">Default (pending confirmation)</option><option value="SUCCESS">Force success</option><option value="FAILURE">Force failure (decline)</option></select><span className="mt-1 block text-xs font-normal text-muted">Supported by the backend for demonstrations only.</span></label>
        {s.error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-800">{s.error}</div>}
      </div>
    </Modal>
  );
}
