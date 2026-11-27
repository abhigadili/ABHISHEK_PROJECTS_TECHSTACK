import { Link } from 'react-router-dom';
import { AlertCircle, BadgeCheck, Clock, IndianRupee, Receipt, Wallet } from 'lucide-react';
import { useBillingStatusCounts, usePatientBills } from '../hooks/useBilling';
import { StatCard } from '@/components/common/StatCard';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/ErrorState';
import { Notice } from '@/components/common/Notice';
import { BillStatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth, useCan } from '@/contexts/AuthContext';
import { useCurrentPatient } from '@/features/authentication/hooks/useCurrentIdentity';
import { useBillPage } from '../hooks/useBilling';
import { formatCurrency, formatDate } from '@/utils/format';

/** Billing dashboard (Tailwind): staff see system-wide figures (four parallel status queries), patients see their own account. */
export default function BillingDashboardPage() {
  const { role } = useAuth();
  const canManage = useCan('billing:manage');
  return (
    <>
      <PageHeader title="Billing" subtitle={canManage ? 'Invoices, payments and outstanding balances' : 'Your invoices and payments'} icon={<Receipt className="h-5 w-5" />}
        actions={<><Button variant="outline" asChild><Link to="/billing/invoices">All invoices</Link></Button><Button variant="outline" asChild><Link to="/billing/payments">Payment history</Link></Button>{canManage && <Button asChild><Link to="/billing/generate">Generate bill</Link></Button>}</>} />
      {role === 'PATIENT' ? <PatientSummary /> : <StaffSummary />}
    </>
  );
}

function StaffSummary() {
  const s = useBillingStatusCounts(true);
  const recent = useBillPage({ page: 0, size: 6 });
  if (s.isError) return <ErrorState error={s.error} onRetry={s.refetch} />;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pending invoices" value={s.counts.PENDING} icon={<Clock className="h-5 w-5" />} tone="amber" loading={s.isPending} to="/billing/invoices?status=PENDING" />
        <StatCard label="Overdue" value={s.counts.OVERDUE} icon={<AlertCircle className="h-5 w-5" />} tone="red" loading={s.isPending} to="/billing/invoices?status=OVERDUE" hint={s.overdueAmount ? `${formatCurrency(s.overdueAmount)} overdue` : undefined} />
        <StatCard label="Paid invoices" value={s.counts.PAID} icon={<BadgeCheck className="h-5 w-5" />} tone="green" loading={s.isPending} to="/billing/invoices?status=PAID" />
        <StatCard label="Outstanding amount" value={formatCurrency(s.outstanding)} icon={<IndianRupee className="h-5 w-5" />} tone="violet" loading={s.isPending} hint={`Collected ${formatCurrency(s.collected)}`} />
      </div>
      {s.truncated && <Notice>Amounts are summed over the 100 most recent invoices of each status (counts are exact).</Notice>}
      <Card className="p-5">
        <h2 className="mb-3 font-semibold">Recent invoices</h2>
        {recent.isPending ? <Skeleton className="h-24" /> : (
          <ul className="divide-y divide-[var(--hms-border)]">{recent.data?.content.map((b) => <li key={b.id}><Link to={`/billing/invoices/${b.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:underline"><span><b>{b.billNumber}</b> <span className="text-muted">· {b.patientName} · due {formatDate(b.dueDate)}</span></span><span className="flex items-center gap-3">{formatCurrency(b.totalAmount, b.currency)}<BillStatusBadge status={b.status} /></span></Link></li>)}</ul>
        )}
      </Card>
    </div>
  );
}

function PatientSummary() {
  const own = useCurrentPatient();
  const bills = usePatientBills(own.patient?.id ?? 0);
  if (own.missingProfile) return <Notice tone="warning">Create your patient profile to see invoices.</Notice>;
  if (bills.isError) return <ErrorState error={bills.error} onRetry={() => void bills.refetch()} />;
  const list = bills.data ?? [];
  const due = list.filter((b) => b.status === 'PENDING' || b.status === 'OVERDUE');
  const outstanding = due.reduce((a, b) => a + b.totalAmount - b.paidAmount, 0);
  const paid = list.reduce((a, b) => a + b.paidAmount, 0);
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Outstanding" value={formatCurrency(outstanding)} icon={<Wallet className="h-5 w-5" />} tone="amber" loading={bills.isPending} hint={`${due.length} unpaid invoice${due.length === 1 ? '' : 's'}`} to="/billing/invoices?status=PENDING" />
        <StatCard label="Paid so far" value={formatCurrency(paid)} icon={<BadgeCheck className="h-5 w-5" />} tone="green" loading={bills.isPending} />
        <StatCard label="Invoices" value={list.length} icon={<Receipt className="h-5 w-5" />} loading={bills.isPending} to="/billing/invoices" />
      </div>
      {due.length > 0 && <Card className="p-5"><h2 className="mb-3 font-semibold">Needs your attention</h2><ul className="divide-y divide-[var(--hms-border)]">{due.map((b) => <li key={b.id} className="flex items-center justify-between py-2.5 text-sm"><span><b>{b.billNumber}</b> <span className="text-muted">· due {formatDate(b.dueDate)}</span></span><span className="flex items-center gap-3">{formatCurrency(b.totalAmount - b.paidAmount, b.currency)}<BillStatusBadge status={b.status} /><Button size="sm" asChild><Link to={`/billing/invoices/${b.id}`}>Pay</Link></Button></span></li>)}</ul></Card>}
    </div>
  );
}
