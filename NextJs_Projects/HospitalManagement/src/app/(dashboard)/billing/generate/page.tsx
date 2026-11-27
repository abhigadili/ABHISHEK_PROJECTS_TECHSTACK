import { requirePermission } from '@/lib/auth/session';
import { PageHeader } from '@/components/common/PageHeader';
import { BillForm } from '@/features/billing/BillForm';
export const metadata = { title: 'Generate bill' };
export default async function GenerateBill() { await requirePermission('billing:manage'); return <><PageHeader title="Generate bill" description="Create a manual bill (appointment and prescription bills are created automatically by events)." /><BillForm /></>; }
