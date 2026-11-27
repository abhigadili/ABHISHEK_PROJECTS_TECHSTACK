'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ErrorMessage, Field, Form, Formik } from 'formik';
import { z } from 'zod';
import { payInvoiceAction } from './actions';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/empty-state';
import { emitToast } from '@/components/ui/toast';
import { fmtMoney } from '@/lib/utilities/format';

/** Luhn check (client side only) - the card number itself NEVER leaves the browser; only its last four digits are submitted. */
const luhn = (n: string) => { let s = 0, alt = false; for (let i = n.length - 1; i >= 0; i--) { let d = Number(n[i]); if (alt) { d *= 2; if (d > 9) d -= 9; } s += d; alt = !alt; } return s % 10 === 0; };
const schema = z.object({ method: z.enum(['CARD', 'UPI', 'NET_BANKING', 'CASH']), amount: z.coerce.number().positive('Enter an amount'), cardNumber: z.string(), expiry: z.string(), cvv: z.string(), upiId: z.string() }).superRefine((v, ctx) => {
  if (v.method === 'CARD') {
    const n = v.cardNumber.replace(/\s/g, '');
    if (!/^\d{13,19}$/.test(n) || !luhn(n)) ctx.addIssue({ code: 'custom', path: ['cardNumber'], message: 'Enter a valid card number' });
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(v.expiry)) ctx.addIssue({ code: 'custom', path: ['expiry'], message: 'MM/YY' });
    if (!/^\d{3,4}$/.test(v.cvv)) ctx.addIssue({ code: 'custom', path: ['cvv'], message: '3-4 digits' });
  }
  if (v.method === 'UPI' && !/^[\w.-]+@[\w]+$/.test(v.upiId)) ctx.addIssue({ code: 'custom', path: ['upiId'], message: 'Enter a UPI id like name@bank' });
});
const validate = (values: unknown) => { const r = schema.safeParse(values); const e: Record<string, string> = {}; if (!r.success) for (const i of r.error.issues) e[String(i.path[0])] ??= i.message; return e; };
const input = 'h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm';
/** Formik + Zod payment form (conditional validation per method). Only { method, amount, cardLast4 } reach the Server Action - no PAN/CVV. */
export function PayPanel({ invoiceId, outstanding }: { invoiceId: number; outstanding: number }) {
  const router = useRouter(); const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <Formik initialValues={{ method: 'CARD', amount: outstanding, cardNumber: '', expiry: '', cvv: '', upiId: '' }} validate={validate} onSubmit={async (v, h) => {
      const digits = v.cardNumber.replace(/\s/g, '');
      const r = await payInvoiceAction(invoiceId, { method: v.method, amount: v.amount, ...(v.method === 'CARD' ? { cardLast4: digits.slice(-4) } : {}) });
      setMsg({ ok: r.ok, text: r.message ?? '' }); emitToast({ kind: r.ok ? 'success' : 'error', text: r.message ?? '' });
      h.resetForm({ values: { method: v.method, amount: outstanding, cardNumber: '', expiry: '', cvv: '', upiId: '' } }); router.refresh(); // form reset after submit
    }}>
      {({ values, isSubmitting }) => (
        <Form className="space-y-3" noValidate>
          {msg && <Alert tone={msg.ok ? 'ok' : 'danger'}>{msg.text}</Alert>}
          <div><label className="mb-1 block text-sm font-medium" htmlFor="method">Payment method</label><Field as="select" id="method" name="method" className={input}>{['CARD', 'UPI', 'NET_BANKING', 'CASH'].map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}</Field></div>
          <div><label className="mb-1 block text-sm font-medium" htmlFor="amount">Amount (max {fmtMoney(outstanding)})</label><Field id="amount" name="amount" type="number" step="0.01" className={input} /><ErrorMessage name="amount" component="p" className="mt-1 text-xs text-danger" /></div>
          {values.method === 'CARD' && <><div><label className="mb-1 block text-sm font-medium" htmlFor="cardNumber">Card number</label><Field id="cardNumber" name="cardNumber" inputMode="numeric" autoComplete="off" placeholder="4242 4242 4242 4242" className={input} /><ErrorMessage name="cardNumber" component="p" className="mt-1 text-xs text-danger" /></div><div className="grid grid-cols-2 gap-3"><div><label className="mb-1 block text-sm font-medium" htmlFor="expiry">Expiry</label><Field id="expiry" name="expiry" placeholder="MM/YY" autoComplete="off" className={input} /><ErrorMessage name="expiry" component="p" className="mt-1 text-xs text-danger" /></div><div><label className="mb-1 block text-sm font-medium" htmlFor="cvv">CVV</label><Field id="cvv" name="cvv" type="password" autoComplete="off" className={input} /><ErrorMessage name="cvv" component="p" className="mt-1 text-xs text-danger" /></div></div><p className="text-xs text-muted">Demo gateway: card details stay in your browser, only the last 4 digits are sent. Use a card ending 0002 to simulate a decline.</p></>}
          {values.method === 'UPI' && <div><label className="mb-1 block text-sm font-medium" htmlFor="upiId">UPI id</label><Field id="upiId" name="upiId" className={input} /><ErrorMessage name="upiId" component="p" className="mt-1 text-xs text-danger" /></div>}
          <Button type="submit" className="w-full" loading={isSubmitting}>Pay now</Button>
        </Form>
      )}
    </Formik>
  );
}
