import { requireRole } from '@/server/auth/guard';
import { doctorService } from '@/server/services/doctor.service';
import { PageHeader } from '@/components/common/PageHeader';
import { AvailabilityEditor } from '@/features/doctors/AvailabilityEditor';
export const metadata = { title: 'Availability', robots: { index: false } };
export default async function Page() {
  const p = await requireRole(['DOCTOR']); const d = await doctorService.get(p, p.doctorId!); const hospitals = d.assignments.map((a) => ({ id: a.hospital.id, name: a.hospital.name }));
  const initial = hospitals.map((h) => ({ hospitalId: h.id, days: d.availability.filter((a) => a.hospitalId === h.id).map((a) => ({ dayOfWeek: a.dayOfWeek, startTime: a.startTime, endTime: a.endTime, slotMinutes: a.slotMinutes, breakStart: a.breakStart ?? '', breakEnd: a.breakEnd ?? '' })) }));
  return <><PageHeader title="Availability" description="Working days, hours, consultation duration, breaks and days off. Patients see the resulting free slots immediately." /><AvailabilityEditor doctorId={d.id} hospitals={hospitals} initial={initial} timeOff={d.timeOff.map((t) => ({ id: t.id, date: t.date.toISOString().slice(0, 10), reason: t.reason ?? '' }))} /></>;
}
