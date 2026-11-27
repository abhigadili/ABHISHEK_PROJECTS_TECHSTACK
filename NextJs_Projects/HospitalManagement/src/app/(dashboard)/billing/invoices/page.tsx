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
import { Pagination } from '@/components/ui/pagination';
import { Button } from '@/components/ui/button';
import { can } from '@/constants/permissions';
import { formatCurrency, formatDate } from '@/lib/utilities/format';
import type { Bill, BillStatus } from '@/types';

export const metadata: Metadata = { title: 'Invoices', robots: { index: false } };
const STATUSES: BillStatus[] = ['PENDING', 'PAID', 'OVERDUE', 'CANCELLED'];
export default async function Invoices({ searchParams }: PageProps<'/billing/invoices'>) {
  const s = await requirePermission('billing:read');
  const sp = await searchParams;
  const status = STATUSES.find((x) => x === sp.status);
  const page = Math.max(0, Number(sp.page ?? 0) || 0);
  let rows: Bill[] = []; let totalPages = 1; let total = 0;
  if (s.role === 'PATIENT') { const me = await loadOptional(patientService.byUser(s.userId)); rows = me ? (await load(billingService.byPatient(me.id))).filter((b) => !status || b.status === status) : []; total = rows.length; }
  else { const r = await load(billingService.list({ status, page, size: 15 })); rows = r.content; totalPages = r.totalPages; total = r.totalElements; }
  return (
    <>
      <PageHeader title="Invoices" actions={can(s.role, 'billing:manage') && <Button asChild><Link href="/billing/generate">Generate bill</Link></Button>} />
      <div className="mb-4 flex flex-wrap gap-2 text-sm"><Link href="/billing/invoices" className={`rounded-full border px-3 py-1 ${!status ? 'border-primary text-primary' : 'border-line text-muted'}`}>All</Link>{STATUSES.map((x) => <Link key={x} href={`/billing/invoices?status=${x}`} className={`rounded-full border px-3 py-1 ${status === x ? 'border-primary text-primary' : 'border-line text-muted'}`}>{x.charAt(0) + x.slice(1).toLowerCase()}</Link>)}</div>
      {rows.length === 0 ? <EmptyState title="No invoices" /> : <Table><THead><TR><TH>Invoice</TH><TH>Patient</TH><TH>Date</TH><TH>Due</TH><TH>Total</TH><TH>Paid</TH><TH>Status</TH></TR></THead><TBody>{rows.map((b) => <TR key={b.id}><TD><Link className="font-mono text-xs font-medium text-primary hover:underline" href={`/billing/invoices/${b.id}`}>{b.billNumber}</Link></TD><TD>{b.patientName}</TD><TD>{formatDate(b.createdAt)}</TD><TD>{formatDate(b.dueDate)}</TD><TD className="num">{formatCurrency(b.totalAmount, b.currency)}</TD><TD className="num">{formatCurrency(b.paidAmount, b.currency)}</TD><TD><StatusBadge status={b.status} /></TD></TR>)}</TBody></Table>}
      {s.role !== 'PATIENT' && <Pagination page={page} totalPages={totalPages} total={total} basePath="/billing/invoices" params={{ status }} />}
    </>
  );
}
