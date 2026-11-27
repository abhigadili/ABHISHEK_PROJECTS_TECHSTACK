import { requireRole } from '@/server/auth/guard';
import { InvoiceList } from '@/features/billing/InvoiceList';
import { PageHeader } from '@/components/common/PageHeader';
export const metadata = { title: 'Billing', robots: { index: false } };
export default async function Page({ searchParams }: PageProps<'/patient/billing'>) { const p = await requireRole(['PATIENT']); return <><PageHeader title="Billing" description="Your invoices. Billing data is private and never cached." /><InvoiceList p={p} searchParams={await searchParams} base="/patient/billing" /></>; }
