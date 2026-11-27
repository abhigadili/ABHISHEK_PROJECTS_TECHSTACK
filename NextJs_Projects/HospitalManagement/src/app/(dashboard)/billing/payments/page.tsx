import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePermission } from '@/lib/auth/session';
import { billingService } from '@/services/backend/billing';
import { patientService } from '@/services/backend/patients';
import { load, loadOptional } from '@/lib/api/guards';
import { PageHeader } from '@/components/common/PageHeader';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCurrency, formatDateTime } from '@/lib/utilities/format';
import type { Bill } from '@/types';

export const metadata: Metadata = { title: 'Payment history', robots: { index: false } };
/** Dependent + parallel: the backend has no "all payments" endpoint, so payments of the most recent bills are fetched in parallel. */
export default async function PaymentHistory() {
  const s = await requirePermission('billing:read');
  let bills: Bill[] = [];
  if (s.role === 'PATIENT') { const me = await loadOptional(patientService.byUser(s.userId)); bills = me ? await load(billingService.byPatient(me.id)) : []; } else bills = (await load(billingService.list({ size: 20 }))).content;
  const all = (await Promise.all(bills.slice(0, 20).map(async (b) => (await billingService.payments(b.id).catch(() => [])).map((p) => ({ ...p, bill: b }))))).flat().sort((a, b) => b.initiatedAt.localeCompare(a.initiatedAt));
  return <><PageHeader title="Payment history" description="Payments for the latest 20 bills." />{all.length === 0 ? <EmptyState title="No payments yet" /> : <Table><THead><TR><TH>Reference</TH><TH>Invoice</TH><TH>Patient</TH><TH>Method</TH><TH>Amount</TH><TH>Started</TH><TH>Status</TH></TR></THead><TBody>{all.map((p) => <TR key={p.id}><TD className="font-mono text-xs">{p.transactionRef}</TD><TD><Link className="font-mono text-xs text-primary hover:underline" href={`/billing/invoices/${p.bill.id}`}>{p.billNumber}</Link></TD><TD>{p.bill.patientName}</TD><TD>{p.method.replace('_', ' ')}</TD><TD className="num">{formatCurrency(p.amount)}</TD><TD>{formatDateTime(p.initiatedAt)}</TD><TD><StatusBadge status={p.status} /></TD></TR>)}</TBody></Table>}</>;
}
