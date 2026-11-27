import { requireRole } from '@/server/auth/guard';
import { doctorService } from '@/server/services/doctor.service';
import { hospitalService } from '@/server/services/hospital.service';
import { assertCan } from '@/server/authorization/rbac';
import { PageHeader } from '@/components/common/PageHeader';
import { DoctorForm } from '@/features/doctors/DoctorForm';
export const metadata = { title: 'Register doctor', robots: { index: false } };
export default async function Page() {
  const p = await requireRole(['HOSPITAL_ADMIN', 'RECEPTIONIST']); await assertCan(p, 'doctor:manage');
  const [hs, specs] = await Promise.all([hospitalService.list(p, { page: 0, size: 50, dir: 'asc' }), doctorService.specializations()]);
  return <><PageHeader title="Register doctor" /><DoctorForm specializations={specs} hospitals={await Promise.all(hs.items.map(async (h) => ({ id: h.id, name: h.name, departments: (await hospitalService.get(p, h.id)).departments.map((d) => ({ id: d.id, name: d.name })) })))} /></>;
}
