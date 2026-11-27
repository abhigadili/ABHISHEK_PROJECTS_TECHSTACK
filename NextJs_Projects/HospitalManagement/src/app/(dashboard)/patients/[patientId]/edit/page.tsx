import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/session';
import { patientService } from '@/services/backend/patients';
import { load, parseId } from '@/lib/api/guards';
import { PatientEditForm } from '@/features/patients/PatientEditForm';

export const metadata: Metadata = { title: 'Edit patient', robots: { index: false } };
export default async function EditPatientPage({ params }: PageProps<'/patients/[patientId]/edit'>) {
  await requirePermission('patients:update');
  const p = await load(patientService.get(parseId((await params).patientId)));
  return <PatientEditForm patient={p} />;
}
