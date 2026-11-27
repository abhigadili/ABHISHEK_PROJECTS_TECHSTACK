import Link from 'next/link';
import { requirePermission } from '@/lib/auth/session';
import { billingService } from '@/services/backend/billing';
import { load, parseId } from '@/lib/api/guards';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCurrency, formatDate } from '@/lib/utilities/format';

export const metadata = { title: 'Patient billing', robots: { index: false } };
/** Billing data is sensitive: dynamic (SSR), never stored in a shared cache. */
export default async function PatientBilling({ params }: PageProps<'/patients/[patientId]/billing'>) {
  await requirePermission('billing:read');
  const list = await load(billingService.byPatient(parseId((await params).patientId)));
  if (!list.length) return <EmptyState title="No bills" />;
  return <Table><THead><TR><TH>Bill</TH><TH>Date</TH><TH>Type</TH><TH>Total</TH><TH>Paid</TH><TH>Status</TH></TR></THead><TBody>{list.map((b) => <TR key={b.id}><TD><Link className="font-mono text-xs font-medium text-primary hover:underline" href={`/billing/invoices/${b.id}`}>{b.billNumber}</Link></TD><TD>{formatDate(b.createdAt)}</TD><TD>{b.billType}</TD><TD className="num">{formatCurrency(b.totalAmount, b.currency)}</TD><TD className="num">{formatCurrency(b.paidAmount, b.currency)}</TD><TD><StatusBadge status={b.status} /></TD></TR>)}</TBody></Table>;
}
