import Link from 'next/link';
import { requireRole } from '@/server/auth/guard';
import { InvoiceList } from '@/features/billing/InvoiceList';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
export const metadata = { title: 'Invoices', robots: { index: false } };
export default async function Page({ searchParams }: PageProps<'/billing/invoices'>) { const p = await requireRole(['BILLING_STAFF']); return <><PageHeader title="Invoices" description="Printable invoices; generated automatically after consultations and dispensing." actions={<Button asChild><Link href="/billing/invoices/new">New invoice</Link></Button>} /><InvoiceList p={p} searchParams={await searchParams} base="/billing/invoices" /></>; }
