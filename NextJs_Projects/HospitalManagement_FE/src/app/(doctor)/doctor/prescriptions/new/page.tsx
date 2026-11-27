import { requireRole } from '@/server/auth/guard';
import { patientService } from '@/server/services/patient.service';
import { pharmacyService } from '@/server/services/pharmacy.service';
import { PageHeader } from '@/components/common/PageHeader';
import { PrescriptionForm } from '@/features/prescriptions/PrescriptionForm';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
export const metadata = { title: 'New prescription', robots: { index: false } };
export default async function Page({ searchParams }: PageProps<'/doctor/prescriptions/new'>) {
  const p = await requireRole(['DOCTOR']); const sp = await searchParams; const pid = Number(sp.patientId) || 0; const aid = Number(sp.appointmentId) || undefined;
  if (!pid) return <><PageHeader title="New prescription" /><EmptyState title="Choose a patient first" description="Open one of your patients or an appointment, then use Prescribe." action={<Button asChild><Link href="/doctor/patients">My patients</Link></Button>} /></>;
  const [x, meds] = await Promise.all([patientService.get(p, pid), pharmacyService.medicines(p, { page: 0, size: 100 })]);
  return <><PageHeader title="New prescription" description="Validated on the client (Zod) and again on the server; the patient and pharmacy are notified." /><PrescriptionForm patient={{ id: x.id, name: `${x.user.firstName} ${x.user.lastName}` }} appointmentId={aid} medicines={meds.items.map((m) => ({ id: m.id, name: m.name }))} /></>;
}
