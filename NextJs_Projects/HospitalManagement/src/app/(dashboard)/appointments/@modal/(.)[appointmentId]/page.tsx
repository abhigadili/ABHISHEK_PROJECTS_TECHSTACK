import { requireSession } from '@/lib/auth/session';
import { appointmentService } from '@/services/backend/appointments';
import { load, parseId } from '@/lib/api/guards';
import { AppointmentDetail } from '@/features/appointments/AppointmentDetail';
import { RouteModal } from '@/features/appointments/RouteModal';

/** INTERCEPTING ROUTE: `(.)` intercepts /appointments/[appointmentId] from within /appointments and shows it in the @modal slot. */
export default async function AppointmentModal({ params }: PageProps<'/appointments/[appointmentId]'>) {
  const s = await requireSession();
  const a = await load(appointmentService.get(parseId((await params).appointmentId)));
  return <RouteModal title={`Appointment #${a.id}`}><AppointmentDetail a={a} role={s.role} /></RouteModal>;
}
