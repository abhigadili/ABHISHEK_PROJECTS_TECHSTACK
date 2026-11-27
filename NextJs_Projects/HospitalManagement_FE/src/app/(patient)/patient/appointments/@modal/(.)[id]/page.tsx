import { requireRole } from '@/server/auth/guard';
import { appointmentService } from '@/server/services/appointment.service';
import { idOf } from '@/server/http/api';
import { AppointmentDetail } from '@/features/appointments/AppointmentDetail';
import { RouteModal } from '@/features/appointments/RouteModal';
/** INTERCEPTING route: `(.)` intercepts /patient/appointments/[id] inside /patient/appointments and renders it as a modal. */
export default async function Modal({ params }: PageProps<'/patient/appointments/[id]'>) {
  const p = await requireRole(['PATIENT']); const a = await appointmentService.get(p, idOf((await params).id));
  return <RouteModal title={`Appointment #${a.id}`}><AppointmentDetail a={a} base="/patient/appointments" /></RouteModal>;
}
