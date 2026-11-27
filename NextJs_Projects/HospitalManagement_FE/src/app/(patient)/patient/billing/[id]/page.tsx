import { requireRole } from '@/server/auth/guard';
import { InvoiceView } from '@/features/billing/InvoiceView';
import { idOf } from '@/server/http/api';
export const metadata = { title: 'Invoice', robots: { index: false } };
export default async function Page({ params }: PageProps<'/patient/billing/[id]'>) { return <InvoiceView p={await requireRole(['PATIENT'])} id={idOf((await params).id)} />; }
