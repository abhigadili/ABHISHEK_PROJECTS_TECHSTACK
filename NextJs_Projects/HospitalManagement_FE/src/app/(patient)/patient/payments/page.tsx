import { requireRole } from '@/server/auth/guard';
import { PaymentList } from '@/features/billing/PaymentList';
import { PageHeader } from '@/components/common/PageHeader';
export const metadata = { title: 'Payments', robots: { index: false } };
export default async function Page({ searchParams }: PageProps<'/patient/payments'>) { const p = await requireRole(['PATIENT']); return <><PageHeader title="Payment history" /><PaymentList p={p} page={Number((await searchParams).page ?? 0) || 0} base="/patient/payments" invoiceBase="/patient/billing" /></>; }
