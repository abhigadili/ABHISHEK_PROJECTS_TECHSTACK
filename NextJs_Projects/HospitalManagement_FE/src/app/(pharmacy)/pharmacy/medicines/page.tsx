import { requireRole } from '@/server/auth/guard';
import { pharmacyService } from '@/server/services/pharmacy.service';
import { PageHeader } from '@/components/common/PageHeader';
import { FilterBar } from '@/components/common/FilterBar';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { AddMedicineDialog } from '@/features/pharmacy/PharmacyForms';
import { pageQuery } from '@/lib/validations/common';
import { fmtMoney } from '@/lib/utilities/format';
export const metadata = { title: 'Medicine catalogue', robots: { index: false } };
export default async function Page({ searchParams }: PageProps<'/pharmacy/medicines'>) {
  const p = await requireRole(['PHARMACIST']); const sp = await searchParams; const q = pageQuery.parse(sp); const cat = Number(sp.categoryId) || undefined; const [r, cats] = await Promise.all([pharmacyService.medicines(p, { ...q, categoryId: cat }), pharmacyService.categories()]);
  return <><PageHeader title="Medicine catalogue" description="Availability = non-expired stock at your hospital." actions={<AddMedicineDialog categories={cats} />} /><FilterBar placeholder="Search name, generic or SKU" selects={[{ name: 'categoryId', label: 'All categories', options: cats.map((c) => ({ value: String(c.id), label: c.name })) }]} />{r.items.length === 0 ? <EmptyState title="No medicines" /> : <Table><THead><TR><TH>Medicine</TH><TH>SKU</TH><TH>Category</TH><TH>Price</TH><TH>Stock</TH><TH>Availability</TH></TR></THead><TBody>{r.items.map((m) => <TR key={m.id}><TD className="font-medium">{m.name}<div className="text-xs font-normal text-muted">{m.genericName}</div></TD><TD className="font-mono text-xs">{m.sku}</TD><TD>{m.category.name}</TD><TD className="num">{fmtMoney(m.unitPrice)}</TD><TD className="num">{m.stock}</TD><TD>{m.stock <= 0 ? <Badge tone="danger">Out of stock</Badge> : m.stock <= m.reorderLevel ? <Badge tone="warn">Low</Badge> : <Badge tone="ok">In stock</Badge>}</TD></TR>)}</TBody></Table>}<Pagination page={q.page} size={q.size} total={r.total} basePath="/pharmacy/medicines" params={{ q: q.q, categoryId: cat?.toString() }} /></>;
}
