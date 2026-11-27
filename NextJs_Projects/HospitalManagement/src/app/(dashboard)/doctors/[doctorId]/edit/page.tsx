import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/session';
import { hospitalService } from '@/services/backend/hospitals';
import { doctorService } from '@/services/backend/doctors';
import { load, parseId } from '@/lib/api/guards';
import { DoctorForm } from '@/features/doctors/DoctorForm';
import { loadDepartments } from '@/lib/doctors/departments';

export const metadata: Metadata = { title: 'Edit doctor' };
export default async function EditDoctor({ params }: PageProps<'/doctors/[doctorId]/edit'>) {
  await requirePermission('doctors:manage');
  const id = parseId((await params).doctorId);
  const [doctor, hospitalsAll] = await Promise.all([load(doctorService.get(id)), load(hospitalService.list())]);
  const hospitals = hospitalsAll.filter((h) => h.active);
  return <DoctorForm doctor={doctor} hospitals={hospitals} departmentsByHospital={await loadDepartments(hospitals)} />;
}
