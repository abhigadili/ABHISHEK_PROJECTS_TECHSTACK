import type { Metadata } from 'next';
import Link from 'next/link';
import { ReceiptText, Wallet } from 'lucide-react';
import { requirePermission } from '@/lib/auth/session';
import { getBillingStats, getMyPatientSnapshot } from '@/lib/dashboard/metrics';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { billingService } from '@/services/backend/billing';
import { load } from '@/lib/api/guards';
import { can } from '@/constants/permissions';
import { formatCurrency, formatDate } from '@/lib/utilities/format';
import type { Bill } from '@/types';

export const metadata: Metadata = { title: 'Billing', robots: { index: false } };
export default async function BillingDashboard() {
  const s = await requirePermission('billing:read');
  let pending: Bill[] = []; let paidAmount: number | null = null;
  if (s.role === 'PATIENT') { const snap = await getMyPatientSnapshot(s.userId); const bills = snap?.bills ?? []; pending = bills.filter((b) => b.status === 'PENDING'); paidAmount = bills.reduce((a, b) => a + b.paidAmount, 0); }
  else { const [stats, list] = await Promise.all([getBillingStats(s.role), load(billingService.list({ status: 'PENDING', size: 8 }))]); pending = list.content; paidAmount = stats?.paidAmount ?? null; }
  const due = pending.reduce((a, b) => a + b.totalAmount - b.paidAmount, 0);
  return (
    <>
      <PageHeader title="Billing" actions={<><Button asChild variant="outline"><Link href="/billing/invoices">All invoices</Link></Button><Button asChild variant="outline"><Link href="/billing/payments">Payment history</Link></Button>{can(s.role, 'billing:manage') && <Button asChild><Link href="/billing/generate">Generate bill</Link></Button>}</>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3"><StatCard label="Pending bills" value={pending.length} icon={<ReceiptText className="size-5" />} tone="warn" /><StatCard label="Outstanding" value={formatCurrency(due)} icon={<Wallet className="size-5" />} tone="warn" /><StatCard label="Collected" value={paidAmount === null ? 'n/a' : formatCurrency(paidAmount)} icon={<Wallet className="size-5" />} tone="ok" /></div>
      <Card><CardHeader><CardTitle>Outstanding invoices</CardTitle></CardHeader><CardBody className="p-0">{pending.length === 0 ? <div className="p-5"><EmptyState title="Nothing outstanding" /></div> : <Table><THead><TR><TH>Invoice</TH><TH>Patient</TH><TH>Due</TH><TH>Balance</TH><TH>Status</TH></TR></THead><TBody>{pending.map((b) => <TR key={b.id}><TD><Link className="font-mono text-xs text-primary hover:underline" href={`/billing/invoices/${b.id}`}>{b.billNumber}</Link></TD><TD>{b.patientName}</TD><TD>{formatDate(b.dueDate)}</TD><TD className="num">{formatCurrency(b.totalAmount - b.paidAmount, b.currency)}</TD><TD><StatusBadge status={b.status} /></TD></TR>)}</TBody></Table>}</CardBody></Card>
    </>
  );
}
