import Link from 'next/link';
import { billingService } from '@/server/services/billing.service';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { fmtDateTime, fmtMoney } from '@/lib/utilities/format';
import type { Principal } from '@/server/authorization/principal';
export async function PaymentList({ p, page, base, invoiceBase }: { p: Principal; page: number; base: string; invoiceBase: string }) {
  const r = await billingService.payments(p, { page, size: 15 });
  return <>{r.items.length === 0 ? <EmptyState title="No payments yet" /> : <Table><THead><TR><TH>Reference</TH><TH>Invoice</TH><TH>Patient</TH><TH>Method</TH><TH>Amount</TH><TH>Date</TH><TH>Status</TH></TR></THead><TBody>{r.items.map((x) => <TR key={x.id}><TD className="font-mono text-xs">{x.reference}</TD><TD><Link className="font-mono text-xs text-primary hover:underline" href={`${invoiceBase}/${x.invoice.id}`}>{x.invoice.number}</Link></TD><TD>{x.invoice.patient.user.firstName} {x.invoice.patient.user.lastName}</TD><TD>{x.method.replace('_', ' ')}</TD><TD className="num">{fmtMoney(x.amount)}</TD><TD>{fmtDateTime(x.createdAt)}</TD><TD><StatusBadge status={x.status} />{x.refunds.length > 0 && <span className="ml-1 text-xs text-muted">refunded {fmtMoney(x.refunds.reduce((s, y) => s + Number(y.amount), 0))}</span>}</TD></TR>)}</TBody></Table>}<Pagination page={page} size={15} total={r.total} basePath={base} /></>;
}
