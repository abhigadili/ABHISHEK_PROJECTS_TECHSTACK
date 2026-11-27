import { requireRole } from '@/server/auth/guard';
import { billingService } from '@/server/services/billing.service';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/common/StatCard';
import { StatusBadge } from '@/components/ui/badge';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { fmtMoney } from '@/lib/utilities/format';
export const metadata = { title: 'Billing reports', robots: { index: false } };
export default async function Page() {
  const p = await requireRole(['BILLING_STAFF']); const r = await billingService.report(p);
  return <><PageHeader title="Billing reports" /><div className="mb-6 grid gap-4 sm:grid-cols-4"><StatCard label="Billed" value={fmtMoney(r.billed)} /><StatCard label="Collected" value={fmtMoney(r.collected)} tone="ok" /><StatCard label="Discounts" value={fmtMoney(r.discounts)} tone="info" /><StatCard label="Refunded" value={fmtMoney(r.refunded)} tone="warn" /></div><div className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><CardTitle>Invoices by status</CardTitle></CardHeader><CardBody className="p-0"><Table><THead><TR><TH>Status</TH><TH>Count</TH><TH>Total</TH></TR></THead><TBody>{r.byStatus.map((s) => <TR key={s.status}><TD><StatusBadge status={s.status} /></TD><TD className="num">{s.count}</TD><TD className="num">{fmtMoney(s.total)}</TD></TR>)}</TBody></Table></CardBody></Card><Card><CardHeader><CardTitle>Collections by method</CardTitle></CardHeader><CardBody className="p-0"><Table><THead><TR><TH>Method</TH><TH>Payments</TH><TH>Amount</TH></TR></THead><TBody>{r.byMethod.map((m) => <TR key={m.method}><TD>{m.method.replace('_', ' ')}</TD><TD className="num">{m.count}</TD><TD className="num">{fmtMoney(m.amount)}</TD></TR>)}</TBody></Table></CardBody></Card></div></>;
}
