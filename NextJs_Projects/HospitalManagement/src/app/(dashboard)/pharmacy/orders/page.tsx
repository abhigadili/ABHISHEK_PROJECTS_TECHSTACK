import { requirePermission } from '@/lib/auth/session';
import { PageHeader } from '@/components/common/PageHeader';
import { OrdersInfinite } from '@/features/pharmacy/OrdersInfinite';
export const metadata = { title: 'Pharmacy orders', robots: { index: false } };
export default async function OrdersPage() { await requirePermission('pharmacy:manage'); return <><PageHeader title="Pharmacy orders" description="Created automatically from prescriptions; auto-refreshes every 20 s." /><OrdersInfinite /></>; }
