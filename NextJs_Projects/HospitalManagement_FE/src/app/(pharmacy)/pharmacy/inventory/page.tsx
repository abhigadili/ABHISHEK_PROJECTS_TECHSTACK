import { requireRole } from '@/server/auth/guard';
import { pharmacyService } from '@/server/services/pharmacy.service';
import { PageHeader } from '@/components/common/PageHeader';
import { InventoryTable } from '@/features/pharmacy/InventoryTable';
import { ReceiveStockDialog } from '@/features/pharmacy/PharmacyForms';
export const metadata = { title: 'Inventory', robots: { index: false } };
export default async function Page({ searchParams }: PageProps<'/pharmacy/inventory'>) {
  const p = await requireRole(['PHARMACIST']); const meds = await pharmacyService.medicines(p, { page: 0, size: 100 });
  return <><PageHeader title="Inventory & stock management" description="Batches with expiry dates. Receive new stock or adjust a batch (audited)." actions={<ReceiveStockDialog medicines={meds.items.map((m) => ({ id: m.id, name: m.name }))} />} /><InventoryTable p={p} page={Number((await searchParams).page ?? 0) || 0} base="/pharmacy/inventory" adjust /></>;
}
