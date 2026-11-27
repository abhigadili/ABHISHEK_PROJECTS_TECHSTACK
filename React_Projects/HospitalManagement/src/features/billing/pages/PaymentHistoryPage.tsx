import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import { useManyBillPayments, usePatientBills } from '../hooks/useBilling';
import { PageHeader } from '@/components/common/PageHeader';
import { PatientPicker } from '@/components/common/PatientPicker';
import { Notice } from '@/components/common/Notice';
import { QueryBoundary } from '@/components/common/QueryBoundary';
import { PaymentStatusBadge } from '@/components/common/StatusBadge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentPatient } from '@/features/authentication/hooks/useCurrentIdentity';
import { formatCurrency, formatDateTime, humanize } from '@/utils/format';
import type { Patient, Payment } from '@/types';

/**
 * Payment history. The backend lists payments per invoice only, so the page loads the patient's invoices first
 * (dependent query) and then every invoice's payments in parallel (dynamic useQueries), merged newest first.
 */
export default function PaymentHistoryPage() {
  const { role } = useAuth();
  const own = useCurrentPatient();
  const [picked, setPicked] = useState<Patient | null>(null);
  const patientId = role === 'PATIENT' ? (own.patient?.id ?? 0) : (picked?.id ?? 0);
  const bills = usePatientBills(patientId);
  const payQs = useManyBillPayments((bills.data ?? []).map((b) => b.id));
  const all = useMemo<Payment[]>(() => payQs.flatMap((q) => q.data ?? []).sort((a, b) => b.initiatedAt.localeCompare(a.initiatedAt)), [payQs]);
  const loading = bills.isPending || payQs.some((q) => q.isPending);
  const totalPaid = all.filter((p) => p.status === 'SUCCESS').reduce((s, p) => s + p.amount, 0);
  const billOf = (p: Payment) => bills.data?.find((b) => b.id === p.billId);
  return (
    <>
      <PageHeader title="Payment history" subtitle="Every payment attempt and its outcome" icon={<Wallet className="h-5 w-5" />} />
      {role !== 'PATIENT' && <div className="mb-4 max-w-sm"><PatientPicker value={picked} onChange={setPicked} /></div>}
      {patientId === 0 ? (role === 'PATIENT' ? (own.missingProfile ? <Notice tone="warning">Create your patient profile first.</Notice> : null) : <Notice>Select a patient to see their payments.</Notice>) : (
        <QueryBoundary query={bills} isEmpty={() => false}>
          {() => loading ? <Skeleton className="h-32" /> : all.length === 0 ? <Notice>No payments have been made against this patient's invoices.</Notice> : (
            <Card className="p-5"><p className="mb-3 text-sm text-muted">{all.length} transaction{all.length === 1 ? '' : 's'} · successfully paid <b className="text-fg">{formatCurrency(totalPaid)}</b></p>
              <ul className="divide-y divide-[var(--hms-border)] text-sm">{all.map((p) => <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5"><span><span className="font-mono text-xs">{p.transactionRef}</span><span className="block text-xs text-muted"><Link className="hover:underline" to={`/billing/invoices/${p.billId}`}>{p.billNumber}</Link> · {humanize(billOf(p)?.billType ?? '')} · {humanize(p.method)} · {formatDateTime(p.initiatedAt)}</span></span><span className="flex items-center gap-3">{formatCurrency(p.amount)}<PaymentStatusBadge status={p.status} /></span></li>)}</ul></Card>
          )}
        </QueryBoundary>
      )}
    </>
  );
}
