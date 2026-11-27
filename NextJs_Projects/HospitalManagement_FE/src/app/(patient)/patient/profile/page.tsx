import { patientService } from '@/server/services/patient.service';
import { getPrincipal } from '@/server/auth/session';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardBody } from '@/components/ui/card';
import { PatientProfileForm } from '@/features/patients/PatientProfileForm';
export const metadata = { title: 'My profile', robots: { index: false } };
export default async function ProfilePage() {
  const p = (await getPrincipal())!; const x = await patientService.me(p);
  return <><PageHeader title="My profile" description={`MRN ${x.mrn}`} /><Card><CardBody><PatientProfileForm patientId={x.id} v={{ firstName: x.user.firstName, lastName: x.user.lastName, phone: x.user.phone ?? '', dateOfBirth: x.dateOfBirth.toISOString().slice(0, 10), gender: x.gender, bloodGroup: x.bloodGroup ?? '', address: x.address ?? '', city: x.city ?? '', emergencyContactName: x.emergencyContactName ?? '', emergencyContactPhone: x.emergencyContactPhone ?? '', medicalHistory: x.medicalHistory ?? '' }} /></CardBody></Card></>;
}
