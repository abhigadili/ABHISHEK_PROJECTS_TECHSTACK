import { requireRole } from '@/server/auth/guard';
import { labService } from '@/server/services/laboratory.service';
import { PageHeader } from '@/components/common/PageHeader';
import { FilterBar } from '@/components/common/FilterBar';
import { Suspense } from 'react';
import { CatalogTable } from '@/features/laboratory/CatalogTable';
import { TableSkeleton } from '@/components/ui/skeleton';
import { AddTestDialog } from '@/features/laboratory/CatalogForm';
export const metadata = { title: 'Test catalogue', robots: { index: false } };
export default async function Page({ searchParams }: PageProps<'/lab/catalog'>) {
  const p = await requireRole(['LAB_STAFF']); const sp = await searchParams; const cats = await labService.categories();
  const tests = labService.catalog(p, { q: typeof sp.q === 'string' ? sp.q : undefined, categoryId: Number(sp.categoryId) || undefined }).then((x) => x.map((t) => ({ id: t.id, code: t.code, name: t.name, category: t.category.name, sampleType: t.sampleType, turnaroundHours: t.turnaroundHours, price: Number(t.price) }))); // not awaited: streamed into the client component via use()
  return <><PageHeader title="Test catalogue" actions={<AddTestDialog categories={cats} />} /><FilterBar placeholder="Search tests" selects={[{ name: 'categoryId', label: 'All categories', options: cats.map((c) => ({ value: String(c.id), label: c.name })) }]} /><Suspense fallback={<TableSkeleton rows={5} />}><CatalogTable tests={tests} /></Suspense></>;
}
