import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/auth/session';
import { patientService } from '@/services/backend/patients';
import { doctorService } from '@/services/backend/doctors';
import { load, loadOptional } from '@/lib/api/guards';
import { PageHeader } from '@/components/common/PageHeader';
import { AppointmentsBoard } from '@/features/appointments/AppointmentsBoard';

export const metadata = { title: 'Appointment calendar' };
export default async function AppointmentCalendar() {
  const s = await requireSession('/appointments/calendar');
  let patientId: number | null = null; let doctorIds: number[] = [];
  if (s.role === 'PATIENT') { const me = await loadOptional(patientService.byUser(s.userId)); if (!me) redirect('/patients/register'); patientId = me.id; }
  else if (s.role === 'ADMIN' || s.role === 'DOCTOR') { const docs = (await load(doctorService.list({ size: 100, active: true }))).content; doctorIds = s.role === 'ADMIN' ? docs.slice(0, 40).map((d) => d.id) : docs.filter((d) => d.userId === s.userId).map((d) => d.id); }
  else redirect('/access-denied');
  return <><PageHeader title="Appointment calendar" description="Month view with the number of appointments per day." /><AppointmentsBoard scope={s.role === 'PATIENT' ? 'patient' : 'staff'} patientId={patientId} doctorIds={doctorIds} initialView="calendar" /></>;
}
