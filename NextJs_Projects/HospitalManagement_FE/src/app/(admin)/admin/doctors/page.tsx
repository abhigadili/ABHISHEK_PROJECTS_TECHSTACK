import Link from 'next/link';
import { requireRole } from '@/server/auth/guard';
import { doctorService } from '@/server/services/doctor.service';
import { doctorQuery } from '@/lib/validations/doctor';
import { can } from '@/server/authorization/rbac';
import { PageHeader } from '@/components/common/PageHeader';
import { FilterBar } from '@/components/common/FilterBar';
import { Pagination } from '@/components/ui/pagination';
import { Button } from '@/components/ui/button';
import { DoctorsTable } from '@/features/admin/AdminTables';
export const metadata = { title: 'Doctors', robots: { index: false } };
export default async function Page({ searchParams }: PageProps<'/admin/doctors'>) {
  const p = await requireRole(['HOSPITAL_ADMIN', 'RECEPTIONIST']); const q = doctorQuery.parse(await searchParams); const [r, specs] = await Promise.all([doctorService.list(p, q), doctorService.specializations()]); const manage = await can(p, 'doctor:manage');
  return <><PageHeader title="Doctors" actions={manage ? <Button asChild><Link href="/admin/doctors/new">Register doctor</Link></Button> : undefined} /><FilterBar placeholder="Search doctors" selects={[{ name: 'specializationId', label: 'All specializations', options: specs.map((s) => ({ value: String(s.id), label: s.name })) }]} /><DoctorsTable canManage={manage} rows={r.items.map((d) => ({ id: d.id, name: `Dr. ${d.user.firstName} ${d.user.lastName}`, specialization: d.specialization.name, hospitals: d.assignments.map((a) => a.hospital.name).join(', '), experience: d.experienceYears, fee: Number(d.consultationFee) }))} /><Pagination page={q.page} size={q.size} total={r.total} basePath="/admin/doctors" params={{ q: q.q, specializationId: q.specializationId?.toString() }} /></>;
}
