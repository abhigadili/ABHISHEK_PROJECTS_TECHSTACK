import Link from 'next/link';
import { requireRole } from '@/server/auth/guard';
import { patientService } from '@/server/services/patient.service';
import { doctorService } from '@/server/services/doctor.service';
import { labService } from '@/server/services/laboratory.service';
import { PageHeader } from '@/components/common/PageHeader';
import { LabRequestForm } from '@/features/laboratory/LabRequestForm';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
export const metadata = { title: 'Request lab test', robots: { index: false } };
export default async function Page({ searchParams }: PageProps<'/doctor/lab/new'>) {
  const p = await requireRole(['DOCTOR']); const sp = await searchParams; const pid = Number(sp.patientId) || 0;
  if (!pid) return <><PageHeader title="Request lab test" /><EmptyState title="Choose a patient first" action={<Button asChild><Link href="/doctor/patients">My patients</Link></Button>} /></>;
  const [x, d, tests] = await Promise.all([patientService.get(p, pid), doctorService.get(p, p.doctorId!), labService.catalog(p, {})]);
  return <><PageHeader title="Request laboratory tests" description="Opened from the patient's medical record." /><LabRequestForm patient={{ id: x.id, name: `${x.user.firstName} ${x.user.lastName}` }} appointmentId={Number(sp.appointmentId) || undefined} hospitals={d.assignments.map((a) => ({ id: a.hospital.id, name: a.hospital.name }))} tests={tests.map((t) => ({ id: t.id, name: t.name, code: t.code, price: Number(t.price), category: t.category.name }))} /></>;
}
