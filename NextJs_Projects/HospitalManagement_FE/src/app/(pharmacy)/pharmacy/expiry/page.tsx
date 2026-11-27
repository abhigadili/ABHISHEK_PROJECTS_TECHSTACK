import { requireRole } from '@/server/auth/guard';
import { PageHeader } from '@/components/common/PageHeader';
import { InventoryTable } from '@/features/pharmacy/InventoryTable';
export const metadata = { title: 'Expiry management', robots: { index: false } };
export default async function Page({ searchParams }: PageProps<'/pharmacy/expiry'>) { const p = await requireRole(['PHARMACIST']); return <><PageHeader title="Expiry management" description="Batches that expired or expire within 90 days (earliest first). Expired stock can never be dispensed." /><InventoryTable p={p} filter="expiring" page={Number((await searchParams).page ?? 0) || 0} base="/pharmacy/expiry" adjust /></>; }
