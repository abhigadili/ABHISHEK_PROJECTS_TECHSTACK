import { requireRole } from '@/server/auth/guard';
import { patientService } from '@/server/services/patient.service';
import { patientQuery } from '@/lib/validations/patient';
import { can } from '@/server/authorization/rbac';
import { PageHeader } from '@/components/common/PageHeader';
import { FilterBar } from '@/components/common/FilterBar';
import { Pagination } from '@/components/ui/pagination';
import { PatientsTable } from '@/features/admin/AdminTables';
export const metadata = { title: 'Patients', robots: { index: false } };
/** Demographics only (no clinical data): hospital staff hold patient:read but NOT record:read. */
export default async function Page({ searchParams }: PageProps<'/admin/patients'>) {
  const p = await requireRole(['HOSPITAL_ADMIN', 'RECEPTIONIST']); const q = patientQuery.parse(await searchParams); const r = await patientService.list(p, q);
  return <><PageHeader title="Patients" description="Registered patients. Book on their behalf from here." /><FilterBar placeholder="Search name, e-mail or MRN" /><PatientsTable canWrite={await can(p, 'patient:write')} rows={r.items.map((x) => ({ id: x.id, name: `${x.user.firstName} ${x.user.lastName}`, mrn: x.mrn, email: x.user.email, phone: x.user.phone ?? '', status: x.user.status }))} /><Pagination page={q.page} size={q.size} total={r.total} basePath="/admin/patients" params={{ q: q.q }} /></>;
}
