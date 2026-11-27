import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requirePermission } from '@/lib/auth/session';
import { pharmacyService } from '@/services/backend/pharmacy';
import { load, parseId } from '@/lib/api/guards';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardBody } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utilities/format';

export const metadata: Metadata = { title: 'Medicine', robots: { index: false } };
/** The backend only offers the medicine LIST, so the details page finds the item in the (30 s cached) list. */
export default async function MedicinePage({ params }: PageProps<'/pharmacy/medicines/[medicineId]'>) {
  await requirePermission('pharmacy:access');
  const id = parseId((await params).medicineId);
  const m = (await load(pharmacyService.medicines())).find((x) => x.id === id);
  if (!m) notFound();
  const low = m.stockQuantity <= m.reorderLevel;
  return <><PageHeader title={m.name} description={m.genericName ?? undefined} actions={<Link className="text-sm text-primary hover:underline" href="/pharmacy">← Catalogue</Link>} /><Card className="max-w-xl"><CardBody><dl className="grid grid-cols-2 gap-4 text-sm"><div><dt className="text-xs text-muted uppercase">SKU</dt><dd className="font-mono">{m.sku}</dd></div><div><dt className="text-xs text-muted uppercase">Unit price</dt><dd>{formatCurrency(m.unitPrice)}</dd></div><div><dt className="text-xs text-muted uppercase">Stock</dt><dd className="num">{m.stockQuantity}</dd></div><div><dt className="text-xs text-muted uppercase">Reorder level</dt><dd className="num">{m.reorderLevel}</dd></div><div><dt className="text-xs text-muted uppercase">Availability</dt><dd><Badge tone={m.stockQuantity <= 0 ? 'danger' : low ? 'warn' : 'ok'}>{m.stockQuantity <= 0 ? 'Out of stock' : low ? 'Low stock' : 'In stock'}</Badge></dd></div><div><dt className="text-xs text-muted uppercase">Status</dt><dd>{m.active ? 'Active' : 'Inactive'}</dd></div></dl></CardBody></Card></>;
}
