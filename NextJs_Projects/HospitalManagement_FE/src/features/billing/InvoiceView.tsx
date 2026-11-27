import { billingService } from '@/server/services/billing.service';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/badge';
import { PrintButton } from '@/features/prescriptions/PrintButton';
import { InfoPopover } from '@/components/ui/radix-extras';
import { PayPanel } from './PayPanel';
import { RefundButton, CancelInvoiceButton } from './StaffButtons';
import { fmtDate, fmtDateTime, fmtMoney } from '@/lib/utilities/format';
import type { Principal } from '@/server/authorization/principal';
/** Printable invoice (print stylesheet hides the shell) + payment panel for patients + refund/cancel for billing staff. Never cached. */
export async function InvoiceView({ p, id }: { p: Principal; id: number }) {
  const inv = await billingService.get(p, id); const outstanding = Number(inv.total) - Number(inv.paidAmount); const staff = p.role === 'BILLING_STAFF';
  return (<>
    <PageHeader title={`Invoice ${inv.number}`} description={`${inv.hospital.name} · issued ${fmtDate(inv.createdAt)} · due ${fmtDate(inv.dueDate)}`} actions={<><StatusBadge status={inv.status} /><PrintButton label="Print invoice" />{staff && inv.status !== 'CANCELLED' && Number(inv.paidAmount) === 0 && <CancelInvoiceButton id={inv.id} />}</>} />
    <div className="grid gap-6 lg:grid-cols-3"><div className="space-y-6 lg:col-span-2">
      <Card><CardHeader><CardTitle>Bill to</CardTitle></CardHeader><CardBody className="text-sm">{inv.patient.user.firstName} {inv.patient.user.lastName} · {inv.patient.user.email}</CardBody></Card>
      <Card><CardHeader><CardTitle>Items</CardTitle></CardHeader><CardBody className="p-0"><Table><THead><TR><TH>Description</TH><TH>Type</TH><TH>Qty</TH><TH>Unit</TH><TH>Amount</TH></TR></THead><TBody>{inv.items.map((i) => <TR key={i.id}><TD>{i.description}</TD><TD className="text-xs text-muted">{i.type.toLowerCase()}</TD><TD className="num">{i.quantity}</TD><TD className="num">{fmtMoney(i.unitPrice)}</TD><TD className="num">{fmtMoney(i.amount)}</TD></TR>)}<TR><TD colSpan={4} className="text-right text-muted">Subtotal</TD><TD className="num">{fmtMoney(inv.subtotal)}</TD></TR>{Number(inv.discount) > 0 && <TR><TD colSpan={4} className="text-right text-muted">Discount</TD><TD className="num">−{fmtMoney(inv.discount)}</TD></TR>}<TR><TD colSpan={4} className="text-right text-muted"><span className="inline-flex items-center gap-1">Tax ({String(inv.taxRate)}%)<InfoPopover title="How tax is calculated"><p>Tax is applied to the subtotal <b>after</b> the discount: (subtotal − discount) × rate. The rate comes from the INVOICE_TAX_RATE setting at the time the invoice is issued.</p></InfoPopover></span></TD><TD className="num">{fmtMoney(inv.tax)}</TD></TR><TR><TD colSpan={4} className="text-right font-semibold">Total</TD><TD className="num font-semibold">{fmtMoney(inv.total)}</TD></TR></TBody></Table></CardBody></Card>
      <Card><CardHeader><CardTitle>Payments</CardTitle></CardHeader><CardBody className="p-0">{inv.payments.length === 0 ? <p className="p-5 text-sm text-muted">No payments yet.</p> : <Table><THead><TR><TH>Reference</TH><TH>Method</TH><TH>Amount</TH><TH>Date</TH><TH>Status</TH><TH /></TR></THead><TBody>{inv.payments.map((x) => <TR key={x.id}><TD className="font-mono text-xs">{x.reference}</TD><TD>{x.method.replace('_', ' ')}{x.cardLast4 && ` •••• ${x.cardLast4}`}</TD><TD className="num">{fmtMoney(x.amount)}</TD><TD>{fmtDateTime(x.createdAt)}</TD><TD><StatusBadge status={x.status} />{x.failureReason && <span className="ml-1 text-xs text-muted">{x.failureReason}</span>}{x.refunds.map((r) => <div key={r.id} className="text-xs text-muted">refund {fmtMoney(r.amount)} · {r.reason}</div>)}</TD><TD>{staff && x.status === 'SUCCEEDED' && <RefundButton paymentId={x.id} max={Number(x.amount) - x.refunds.reduce((s, r) => s + Number(r.amount), 0)} />}</TD></TR>)}</TBody></Table>}</CardBody></Card>
    </div>
    {p.role === 'PATIENT' && ['ISSUED', 'PARTIALLY_PAID'].includes(inv.status) && outstanding > 0 && <Card className="no-print h-fit"><CardHeader><CardTitle>Pay this invoice</CardTitle></CardHeader><CardBody><PayPanel invoiceId={inv.id} outstanding={outstanding} /></CardBody></Card>}</div>
  </>);
}
