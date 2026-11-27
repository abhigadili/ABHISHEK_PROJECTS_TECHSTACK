import Link from 'next/link';
import { CircleDollarSign, Percent, ReceiptText, Undo2, Wallet } from 'lucide-react';
import { requireRole } from '@/server/auth/guard';
import { billingService } from '@/server/services/billing.service';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { Button } from '@/components/ui/button';
import { fmtMoney } from '@/lib/utilities/format';
export const metadata = { title: 'Billing dashboard', robots: { index: false } };
export default async function Page() {
  const p = await requireRole(['BILLING_STAFF']); const r = await billingService.report(p); const open = r.byStatus.filter((s) => ['ISSUED', 'PARTIALLY_PAID'].includes(s.status));
  return <><PageHeader title="Billing" actions={<Button asChild><Link href="/billing/invoices/new">New invoice</Link></Button>} /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><StatCard label="Billed" value={fmtMoney(r.billed)} icon={<ReceiptText className="size-5" />} /><StatCard label="Collected" value={fmtMoney(r.collected)} icon={<Wallet className="size-5" />} tone="ok" /><StatCard label="Open invoices" value={open.reduce((s, x) => s + x.count, 0)} icon={<CircleDollarSign className="size-5" />} tone="warn" /><StatCard label="Tax collected" value={fmtMoney(r.tax)} icon={<Percent className="size-5" />} tone="info" /><StatCard label="Refunded" value={fmtMoney(r.refunded)} hint={`${r.refundCount} refund(s)`} icon={<Undo2 className="size-5" />} tone="danger" /></div></>;
}
