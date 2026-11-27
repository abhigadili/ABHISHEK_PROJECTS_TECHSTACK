import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requirePermission } from '@/lib/auth/session';
import { patientService } from '@/services/backend/patients';
import { loadOptional } from '@/lib/api/guards';
import { PageHeader } from '@/components/common/PageHeader';
import { PatientRegisterWizard } from '@/features/patients/PatientRegisterWizard';

export const metadata: Metadata = { title: 'Register patient' };
export default async function RegisterPatientPage() {
  const s = await requirePermission('patients:create');
  if (s.role === 'PATIENT') { const mine = await loadOptional(patientService.byUser(s.userId)); if (mine) redirect(`/patients/${mine.id}`); } // a login owns exactly one profile
  return <><PageHeader title="Register patient" description={s.role === 'PATIENT' ? 'Complete your patient profile to book appointments.' : 'Create a new patient record.'} /><PatientRegisterWizard /></>;
}
