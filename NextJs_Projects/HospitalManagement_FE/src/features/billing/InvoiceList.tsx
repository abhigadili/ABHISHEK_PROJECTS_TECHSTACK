import Link from 'next/link';
import { billingService } from '@/server/services/billing.service';
import { invoiceQuery } from '@/lib/validations/billing';
import { FilterBar } from '@/components/common/FilterBar';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { fmtDate, fmtMoney } from '@/lib/utilities/format';
import type { Principal } from '@/server/authorization/principal';
export async function InvoiceList({ p, searchParams, base }: { p: Principal; searchParams: Record<string, string | string[] | undefined>; base: string }) {
  const q = invoiceQuery.parse(searchParams); const r = await billingService.list(p, q);
  return <><FilterBar placeholder="Search invoice or patient" selects={[{ name: 'status', label: 'Any status', options: ['ISSUED', 'PAID', 'PARTIALLY_PAID', 'CANCELLED', 'REFUNDED'].map((s) => ({ value: s, label: s.replace('_', ' ').toLowerCase() })) }]} />{r.items.length === 0 ? <EmptyState title="No invoices" /> : <Table><THead><TR><TH>Invoice</TH><TH>Patient</TH><TH>Date</TH><TH>Total</TH><TH>Paid</TH><TH>Status</TH></TR></THead><TBody>{r.items.map((i) => <TR key={i.id}><TD><Link className="font-mono text-xs font-medium text-primary hover:underline" href={`${base}/${i.id}`}>{i.number}</Link></TD><TD>{i.patient.user.firstName} {i.patient.user.lastName}</TD><TD>{fmtDate(i.createdAt)}</TD><TD className="num">{fmtMoney(i.total)}</TD><TD className="num">{fmtMoney(i.paidAmount)}</TD><TD><StatusBadge status={i.status} /></TD></TR>)}</TBody></Table>}<Pagination page={q.page} size={q.size} total={r.total} basePath={base} params={{ q: q.q, status: q.status }} /></>;
}
