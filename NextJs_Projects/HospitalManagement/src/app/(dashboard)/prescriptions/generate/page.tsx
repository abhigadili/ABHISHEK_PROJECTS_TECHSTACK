import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/session';
import { doctorService } from '@/services/backend/doctors';
import { patientService } from '@/services/backend/patients';
import { load, loadOptional } from '@/lib/api/guards';
import { PageHeader } from '@/components/common/PageHeader';
import { PrescriptionForm } from '@/features/prescriptions/PrescriptionForm';
import { Alert } from '@/components/ui/empty-state';

export const metadata: Metadata = { title: 'Generate prescription' };
export default async function GeneratePrescription({ searchParams }: PageProps<'/prescriptions/generate'>) {
  const s = await requirePermission('prescriptions:create');
  const sp = await searchParams;
  const pid = Number(sp.patientId) || 0;
  const [docs, patient] = await Promise.all([load(doctorService.list({ size: 100, active: true })), pid ? loadOptional(patientService.get(pid)) : null]);
  const mine = s.role === 'DOCTOR' ? docs.content.find((d) => d.userId === s.userId) : undefined;
  if (s.role === 'DOCTOR' && !mine) return <><PageHeader title="Generate prescription" /><Alert tone="warn">Your login is not linked to a doctor profile, so prescriptions cannot be issued under your name. Ask an administrator to link it.</Alert></>;
  return <><PageHeader title="Generate prescription" description="Search a patient, enter the diagnosis and add medicines." /><PrescriptionForm doctors={docs.content} fixedDoctorId={mine?.id ?? null} initialPatient={patient} /></>;
}
