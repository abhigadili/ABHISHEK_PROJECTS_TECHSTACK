import { requireRole } from '@/server/auth/guard';
import { PaymentList } from '@/features/billing/PaymentList';
import { PageHeader } from '@/components/common/PageHeader';
export const metadata = { title: 'Payments & refunds', robots: { index: false } };
export default async function Page({ searchParams }: PageProps<'/billing/payments'>) { const p = await requireRole(['BILLING_STAFF']); return <><PageHeader title="Payments & refunds" description="Open an invoice to record a refund against a successful payment." /><PaymentList p={p} page={Number((await searchParams).page ?? 0) || 0} base="/billing/payments" invoiceBase="/billing/invoices" /></>; }
