import Link from 'next/link';
import { requireRole } from '@/server/auth/guard';
import { appointmentService } from '@/server/services/appointment.service';
import { idOf } from '@/server/http/api';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardBody } from '@/components/ui/card';
import { AppointmentDetail } from '@/features/appointments/AppointmentDetail';
export const metadata = { title: 'Appointment', robots: { index: false } };
/** Full-page presentation (hard load / shared link). Soft navigation from the list is intercepted by @modal/(.)[id]. */
export default async function Page({ params }: PageProps<'/patient/appointments/[id]'>) {
  const p = await requireRole(['PATIENT']); const a = await appointmentService.get(p, idOf((await params).id));
  return <><PageHeader title={`Appointment #${a.id}`} actions={<Link className="text-sm text-primary hover:underline" href="/patient/appointments">← All appointments</Link>} /><Card className="max-w-3xl"><CardBody><AppointmentDetail a={a} base="/patient/appointments" /></CardBody></Card></>;
}
