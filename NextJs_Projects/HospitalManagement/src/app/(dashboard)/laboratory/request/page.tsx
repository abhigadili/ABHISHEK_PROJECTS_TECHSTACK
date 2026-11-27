import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/session';
import { labService } from '@/services/backend/laboratory';
import { doctorService } from '@/services/backend/doctors';
import { patientService } from '@/services/backend/patients';
import { load, loadOptional } from '@/lib/api/guards';
import { PageHeader } from '@/components/common/PageHeader';
import { LabRequestForm } from '@/features/laboratory/LabRequestForm';
import { Alert } from '@/components/ui/empty-state';

export const metadata: Metadata = { title: 'Request lab test' };
export default async function RequestLabTest({ searchParams }: PageProps<'/laboratory/request'>) {
  const s = await requirePermission('lab:request');
  const pid = Number((await searchParams).patientId) || 0;
  const [tests, docs, patient] = await Promise.all([load(labService.tests()), load(doctorService.list({ size: 100, active: true })), pid ? loadOptional(patientService.get(pid)) : null]);
  const mine = s.role === 'DOCTOR' ? docs.content.find((d) => d.userId === s.userId) : undefined;
  if (s.role === 'DOCTOR' && !mine) return <><PageHeader title="Request lab test" /><Alert tone="warn">Your login is not linked to a doctor profile.</Alert></>;
  return <><PageHeader title="Request lab test" description="Select one or more tests; each becomes its own request." /><LabRequestForm tests={tests} doctors={docs.content} fixedDoctorId={mine?.id ?? null} initialPatient={patient} /></>;
}
