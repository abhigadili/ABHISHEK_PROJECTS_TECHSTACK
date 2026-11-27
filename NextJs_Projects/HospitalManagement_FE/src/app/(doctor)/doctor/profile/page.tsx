import { requireRole } from '@/server/auth/guard';
import { doctorService } from '@/server/services/doctor.service';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardBody } from '@/components/ui/card';
import { DoctorProfileForm } from '@/features/doctors/ProfileForm';
export const metadata = { title: 'My profile', robots: { index: false } };
export default async function Page() {
  const p = await requireRole(['DOCTOR']); const d = await doctorService.get(p, p.doctorId!);
  return <><PageHeader title="My profile" description={`${d.specialization.name} · licence ${d.licenseNumber} · ${d.assignments.map((a) => a.hospital.name).join(', ')}`} /><Card><CardBody><DoctorProfileForm doctorId={d.id} defaults={{ phone: d.user.phone ?? '', qualifications: d.qualifications ?? '', experienceYears: d.experienceYears, consultationFee: Number(d.consultationFee), bio: d.bio ?? '' }} /></CardBody></Card></>;
}
