import Link from 'next/link';
import { requireRole } from '@/server/auth/guard';
import { doctorService } from '@/server/services/doctor.service';
import { doctorQuery } from '@/lib/validations/doctor';
import { PageHeader } from '@/components/common/PageHeader';
import { FilterBar } from '@/components/common/FilterBar';
import { Avatar } from '@/components/common/Avatar';
import { Card, CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { fmtMoney } from '@/lib/utilities/format';
export const metadata = { title: 'Search doctors', robots: { index: false } };
export default async function Page({ searchParams }: PageProps<'/patient/doctors'>) {
  const p = await requireRole(['PATIENT']); const q = doctorQuery.parse(await searchParams); const [r, specs] = await Promise.all([doctorService.list(p, { ...q, size: 12 }), doctorService.specializations()]);
  return <><PageHeader title="Doctors" description="Server-side search, filter and sort." /><FilterBar placeholder="Search by name or specialty" selects={[{ name: 'specializationId', label: 'All specializations', options: specs.map((s) => ({ value: String(s.id), label: s.name })) }, { name: 'sort', label: 'Sort by name', options: [{ value: 'experience', label: 'Experience' }, { value: 'fee', label: 'Fee' }] }]} />
    {r.items.length === 0 ? <EmptyState title="No doctors found" /> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{r.items.map((d) => <Card key={d.id}><CardBody className="flex gap-3"><Avatar name={`Dr. ${d.user.firstName} ${d.user.lastName}`} size={48} /><div className="min-w-0"><p className="truncate font-semibold">Dr. {d.user.firstName} {d.user.lastName}</p><p className="text-sm text-primary">{d.specialization.name}</p><p className="text-xs text-muted">{d.experienceYears} yrs · {fmtMoney(d.consultationFee)}</p><p className="mt-1 flex flex-wrap gap-2 text-xs">{d.assignments.map((a) => <Link key={a.hospitalId} className="text-primary hover:underline" href={`/patient/book?hospitalId=${a.hospitalId}`}>{a.hospital.name}</Link>)}</p></div></CardBody></Card>)}</div>}
    <Pagination page={q.page} size={12} total={r.total} basePath="/patient/doctors" params={{ q: q.q, specializationId: q.specializationId?.toString(), sort: q.sort }} /></>;
}
