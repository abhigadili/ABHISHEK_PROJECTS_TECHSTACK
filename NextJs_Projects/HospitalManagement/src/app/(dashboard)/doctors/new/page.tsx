import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/session';
import { hospitalService } from '@/services/backend/hospitals';
import { load } from '@/lib/api/guards';
import { PageHeader } from '@/components/common/PageHeader';
import { DoctorForm } from '@/features/doctors/DoctorForm';
import { loadDepartments } from '@/lib/doctors/departments';

export const metadata: Metadata = { title: 'Add doctor' };
export default async function NewDoctorPage() {
  await requirePermission('doctors:manage');
  const hospitals = (await load(hospitalService.list())).filter((h) => h.active);
  return <><PageHeader title="Add doctor" /><DoctorForm hospitals={hospitals} departmentsByHospital={await loadDepartments(hospitals)} /></>;
}
