import Link from 'next/link';
import { requireRole } from '@/server/auth/guard';
import { hospitalService } from '@/server/services/hospital.service';
import { hospitalQuery } from '@/lib/validations/hospital';
import { PageHeader } from '@/components/common/PageHeader';
import { FilterBar } from '@/components/common/FilterBar';
import { Card, CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
export const metadata = { title: 'Search hospitals', robots: { index: false } };
export default async function Page({ searchParams }: PageProps<'/patient/hospitals'>) {
  const p = await requireRole(['PATIENT']); const q = hospitalQuery.parse(await searchParams); const r = await hospitalService.list(p, { ...q, size: 9 });
  return <><PageHeader title="Hospitals" description="Search by name or city." /><FilterBar placeholder="Search hospitals" />{r.items.length === 0 ? <EmptyState title="No hospitals found" /> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{r.items.map((h) => <Card key={h.id}><CardBody className="space-y-2"><h2 className="font-semibold">{h.name}</h2><p className="text-sm text-muted">{h.city} · {h._count.departments} departments · {h._count.assignments} doctors</p><div className="flex gap-2"><Button asChild size="sm"><Link href={`/patient/book?hospitalId=${h.id}`}>Book here</Link></Button><Button asChild size="sm" variant="outline"><Link href={`/hospitals/${h.slug}`}>Details</Link></Button></div></CardBody></Card>)}</div>}<Pagination page={q.page} size={9} total={r.total} basePath="/patient/hospitals" params={{ q: q.q }} /></>;
}
