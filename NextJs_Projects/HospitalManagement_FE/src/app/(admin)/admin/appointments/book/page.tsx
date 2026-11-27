import { Suspense } from 'react';
import { requireRole } from '@/server/auth/guard';
import { hospitalService } from '@/server/services/hospital.service';
import { patientService } from '@/server/services/patient.service';
import { assertCan } from '@/server/authorization/rbac';
import { PageHeader } from '@/components/common/PageHeader';
import { BookingWizard } from '@/features/appointments/BookingWizard';
import { Alert } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/skeleton';
export const metadata = { title: 'Book for a patient', robots: { index: false } };
export default async function Page({ searchParams }: PageProps<'/admin/appointments/book'>) {
  const p = await requireRole(['HOSPITAL_ADMIN', 'RECEPTIONIST']); await assertCan(p, 'appointment:book'); const pid = Number((await searchParams).patientId) || 0;
  if (!pid) return <><PageHeader title="Book for a patient" /><Alert tone="info">Open the patient list and press <b>Book</b> next to a patient.</Alert></>;
  const [x, hs] = await Promise.all([patientService.get(p, pid), hospitalService.list(p, { page: 0, size: 20, dir: 'asc' })]);
  const full = await Promise.all(hs.items.map((h) => hospitalService.get(p, h.id)));
  return <><PageHeader title="Book an appointment" description={`For ${x.user.firstName} ${x.user.lastName} (${x.mrn})`} /><Suspense fallback={<TableSkeleton />}><BookingWizard isStaff patientId={pid} hospitals={full.map((h) => ({ id: h.id, name: h.name, city: h.city, departments: h.departments.map((d) => ({ id: d.id, name: d.name })) }))} /></Suspense></>;
}
