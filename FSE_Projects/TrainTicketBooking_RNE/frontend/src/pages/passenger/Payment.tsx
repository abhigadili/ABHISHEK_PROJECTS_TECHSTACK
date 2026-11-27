import { CheckCircle2, CreditCard, Landmark, Smartphone, Wallet, XCircle } from 'lucide-react';
import { useReducer, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Field, FormError, Input } from '@/components/ui/Field';
import { ErrorState, PageLoader } from '@/components/ui/Feedback';
import { useCountdown, useDocumentTitle, useToast } from '@/hooks';
import { toApiError } from '@/services/api';
import { useBooking, usePay } from '@/services/queries';
import { useAppDispatch } from '@/store';
import { flowReset } from '@/store/bookingSlice';
import { fmtDate, fmtTime, inr } from '@/utils/format';

type Method = 'CARD' | 'UPI' | 'NET_BANKING' | 'WALLET';
interface PayState { method: Method; outcome: 'SUCCESS' | 'FAILURE'; phase: 'idle' | 'processing' | 'failed'; error?: string }
type Action = { type: 'method'; method: Method } | { type: 'outcome'; outcome: PayState['outcome'] } | { type: 'start' } | { type: 'fail'; error: string };
/** useReducer: the payment screen is a tiny state machine (idle -> processing -> failed/idle). */
const reducer = (s: PayState, a: Action): PayState => {
  switch (a.type) { case 'method': return { ...s, method: a.method, error: undefined }; case 'outcome': return { ...s, outcome: a.outcome }; case 'start': return { ...s, phase: 'processing', error: undefined }; case 'fail': return { ...s, phase: 'failed', error: a.error }; }
};
const luhn = (n: string) => { let sum = 0, alt = false; for (let i = n.length - 1; i >= 0; i--) { let d = +n[i]; if (alt) { d *= 2; if (d > 9) d -= 9; } sum += d; alt = !alt; } return sum % 10 === 0; };
const methods: { id: Method; label: string; icon: typeof CreditCard }[] = [{ id: 'CARD', label: 'Card', icon: CreditCard }, { id: 'UPI', label: 'UPI', icon: Smartphone }, { id: 'NET_BANKING', label: 'Net banking', icon: Landmark }, { id: 'WALLET', label: 'Wallet', icon: Wallet }];

export default function Payment() {
  useDocumentTitle('Payment'); const { bookingId } = useParams(); const nav = useNavigate(); const toast = useToast(); const dispatch = useAppDispatch();
  const { data: b, isLoading, error, refetch } = useBooking(bookingId); const pay = usePay(); const left = useCountdown(b?.expiresAt);
  const [s, d] = useReducer(reducer, { method: 'CARD', outcome: 'SUCCESS', phase: 'idle' });
  const cardRef = useRef<HTMLInputElement>(null); const expRef = useRef<HTMLInputElement>(null); const cvvRef = useRef<HTMLInputElement>(null); const upiRef = useRef<HTMLInputElement>(null);
  const [fieldError, setFieldError] = useState<string>(); const paidNow = useRef(false); // the refetch after a successful payment flips status to CONFIRMED before our own navigate runs
  if (isLoading) return <PageLoader />; if (error || !b) return <ErrorState error={error} onRetry={refetch} />;
  if (b.status === 'CONFIRMED') return <Navigate to={`/account/bookings/${b.id}`} replace state={{ justBooked: paidNow.current }} />;
  const expired = b.status !== 'PENDING_PAYMENT' || (!!b.expiresAt && left === 0);
  const validate = (): string | undefined => {
    if (s.method === 'CARD') {
      const n = (cardRef.current?.value ?? '').replace(/\s/g, ''); if (!/^\d{13,19}$/.test(n) || !luhn(n)) return 'Enter a valid card number (try 4242 4242 4242 4242).';
      if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expRef.current?.value ?? '')) return 'Expiry must be MM/YY.'; if (!/^\d{3,4}$/.test(cvvRef.current?.value ?? '')) return 'Enter the 3-4 digit CVV.';
    }
    if (s.method === 'UPI' && !/^[\w.-]{2,}@[\w]{2,}$/.test(upiRef.current?.value ?? '')) return 'Enter a valid UPI id like name@bank.';
  };
  const submit = async () => {
    const msg = validate(); setFieldError(msg); if (msg) return;
    // Only the last four digits ever leave this component; the full number and the CVV are cleared right away and never stored or sent.
    const last4 = s.method === 'CARD' ? (cardRef.current!.value.replace(/\s/g, '')).slice(-4) : undefined;
    if (cardRef.current) cardRef.current.value = ''; if (cvvRef.current) cvvRef.current.value = ''; if (expRef.current) expRef.current.value = '';
    d({ type: 'start' }); paidNow.current = true;
    try {
      const p = await pay.mutateAsync({ bookingId: b.id, method: s.method, cardLast4: last4, outcome: s.outcome });
      if (p.status === 'SUCCEEDED') { dispatch(flowReset()); toast('success', 'Payment successful', 'Your ticket is confirmed.'); nav(`/account/bookings/${b.id}`, { replace: true, state: { justBooked: true } }); }
      else { paidNow.current = false; d({ type: 'fail', error: 'The payment was declined. You can retry while your seats are held.' }); }
    } catch (e) { paidNow.current = false; d({ type: 'fail', error: toApiError(e).message }); }
  };
  const mm = String(Math.floor(left / 60)).padStart(2, '0'), ss = String(left % 60).padStart(2, '0');
  return (
    <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-[1fr_300px]">
      <Card><CardHeader><CardTitle>Pay securely</CardTitle>{!expired && b.expiresAt && <span role="timer" className={`rounded-full px-3 py-1 text-sm font-medium ${left < 60 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>Seats held {mm}:{ss}</span>}</CardHeader>
        <CardBody className="space-y-4">
          {expired ? <div className="space-y-3 py-6 text-center"><XCircle className="mx-auto text-red-500" size={36} /><p className="font-medium">This booking is no longer open for payment ({b.status.replace('_', ' ').toLowerCase()}).</p><Button asChild><Link to="/">Search again</Link></Button></div> : <>
            <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-2 gap-2 sm:grid-cols-4">{methods.map(({ id, label, icon: I }) => <button key={id} type="button" role="radio" aria-checked={s.method === id} onClick={() => { d({ type: 'method', method: id }); setFieldError(undefined); }} className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border p-3 text-sm ${s.method === id ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200'}`}><I size={20} />{label}</button>)}</div>
            {s.method === 'CARD' && <div className="grid gap-3 sm:grid-cols-2"><Field className="sm:col-span-2" label="Card number"><Input ref={cardRef} inputMode="numeric" autoComplete="cc-number" placeholder="4242 4242 4242 4242" maxLength={23} /></Field><Field label="Expiry (MM/YY)"><Input ref={expRef} autoComplete="cc-exp" placeholder="12/29" maxLength={5} /></Field><Field label="CVV"><Input ref={cvvRef} type="password" inputMode="numeric" autoComplete="cc-csc" maxLength={4} /></Field></div>}
            {s.method === 'UPI' && <Field label="UPI ID"><Input ref={upiRef} placeholder="name@bank" /></Field>}
            {s.method === 'NET_BANKING' && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">You'll be sent to your bank (simulated). Nothing leaves this demo.</p>}
            {s.method === 'WALLET' && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Pay from your wallet balance (simulated).</p>}
            <fieldset className="rounded-lg border border-dashed border-slate-300 p-3 text-sm"><legend className="px-1 text-xs text-slate-500">Simulator - pick the gateway outcome</legend>
              {(['SUCCESS', 'FAILURE'] as const).map((o) => <label key={o} className="mr-4 inline-flex cursor-pointer items-center gap-1.5"><input type="radio" name="outcome" checked={s.outcome === o} onChange={() => d({ type: 'outcome', outcome: o })} />{o === 'SUCCESS' ? 'Payment succeeds' : 'Payment fails'}</label>)}</fieldset>
            <FormError>{fieldError ?? s.error}</FormError>
            <Button className="w-full" size="lg" loading={s.phase === 'processing'} onClick={submit}>{s.phase === 'failed' ? 'Retry payment' : `Pay ${inr(b.totalAmount)}`}</Button>
            <p className="text-center text-xs text-slate-500">Demo gateway - no real money moves. Card numbers and CVV are never stored.</p></>}
        </CardBody></Card>
      <Card className="h-fit"><CardHeader><CardTitle>Booking summary</CardTitle></CardHeader><CardBody className="space-y-2 text-sm">
        <p className="font-semibold">{b.train.name} <span className="text-slate-400">#{b.train.number}</span></p><p>{b.fromStation.name} → {b.toStation.name}</p><p className="text-slate-500">{fmtDate(b.journeyDate)} · {fmtTime(b.departureAt)}</p>
        <ul className="border-t pt-2">{b.passengers.map((p) => <li key={p.id} className="flex justify-between"><span>{p.name}</span><span>{inr(p.fare)}</span></li>)}</ul>
        <p className="flex justify-between border-t pt-2 text-base font-semibold"><span>Total</span><span>{inr(b.totalAmount)}</span></p>
        {s.phase === 'idle' && <CheckCircle2 className="hidden" />}
      </CardBody></Card>
    </div>
  );
}
