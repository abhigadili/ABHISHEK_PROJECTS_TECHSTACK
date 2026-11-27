import { requireRole } from '@/server/auth/guard';
import { InvoiceView } from '@/features/billing/InvoiceView';
import { idOf } from '@/server/http/api';
export const metadata = { title: 'Invoice', robots: { index: false } };
export default async function Page({ params }: PageProps<'/billing/invoices/[id]'>) { return <InvoiceView p={await requireRole(['BILLING_STAFF'])} id={idOf((await params).id)} />; }
