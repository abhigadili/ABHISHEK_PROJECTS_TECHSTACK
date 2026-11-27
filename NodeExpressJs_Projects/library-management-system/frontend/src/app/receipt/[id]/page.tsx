'use client';
import { Printer } from 'lucide-react';
import { useParams } from 'next/navigation';
import { Button, ErrorState, Spinner } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { fmtDateTime, titleCase } from '@/lib/format';

interface Receipt { id: number; receiptNumber: string; memberName: string; memberCode: string; kind: string; amount: number; method: string; reference: string | null; notes: string | null; receivedBy: string | null; createdAt: string; allocations: { id: number; fineId: number; amount: number; fineType: string; reason: string | null }[]; library: { name: string; address: string; phone: string; email: string; currency: string } }

// Printable on its own (no app chrome); members see only their receipts, staff any (enforced by the API).
export default function ReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const { data: r, error, reload } = useApi<Receipt>(`/payments/${id}`);
  if (error) return <div className="mx-auto max-w-md p-8"><ErrorState message={error} onRetry={reload} /></div>;
  if (!r) return <Spinner />;
  const c = r.library.currency;
  return (
    <div className="mx-auto max-w-md p-6">
      <div className="no-print mb-4 flex justify-end"><Button onClick={() => window.print()}><Printer className="h-4 w-4" />Print</Button></div>
      <article className="card p-6" aria-label={`Receipt ${r.receiptNumber}`}>
        <header className="border-b border-dashed border-slate-300 pb-4 text-center"><h1 className="text-xl font-bold">{r.library.name}</h1><p className="text-xs text-slate-500">{r.library.address}<br />{r.library.phone} · {r.library.email}</p><p className="mt-3 text-sm font-semibold uppercase tracking-wide">{r.kind === 'refund' ? 'Refund / reversal' : 'Payment receipt'}</p></header>
        <dl className="space-y-1.5 py-4 text-sm">
          {([['Receipt no.', r.receiptNumber], ['Date', fmtDateTime(r.createdAt)], ['Member', `${r.memberName} (${r.memberCode})`], ['Method', titleCase(r.method)], ...(r.reference ? [['Reference', r.reference]] : []), ['Received by', r.receivedBy ?? '—']] as string[][]).map(([k, v]) => <div key={k} className="flex justify-between gap-4"><dt className="text-slate-500">{k}</dt><dd className="text-right font-medium">{v}</dd></div>)}
        </dl>
        {r.allocations.length > 0 && <table className="w-full border-t border-slate-200 text-sm"><thead><tr><th className="py-2 text-left font-medium text-slate-500">Applied to</th><th className="py-2 text-right font-medium text-slate-500">Amount</th></tr></thead><tbody>{r.allocations.map((a) => <tr key={a.id}><td className="py-1">{titleCase(a.fineType)} fine #{a.fineId}{a.reason && <span className="block text-xs text-slate-500">{a.reason}</span>}</td><td className="py-1 text-right">{c}{a.amount.toFixed(2)}</td></tr>)}</tbody></table>}
        {r.notes && <p className="mt-2 text-xs text-slate-500">Note: {r.notes}</p>}
        <p className="mt-4 flex items-baseline justify-between border-t border-slate-300 pt-3 text-lg font-bold"><span>{r.kind === 'refund' ? 'Refunded' : 'Total paid'}</span><span>{c}{r.amount.toFixed(2)}</span></p>
        <p className="mt-4 text-center text-xs text-slate-400">Thank you.</p>
      </article>
    </div>
  );
}
