import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/auth/session';
import { appointmentService } from '@/services/backend/appointments';
import { load, parseId } from '@/lib/api/guards';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardBody } from '@/components/ui/card';
import { AppointmentDetail } from '@/features/appointments/AppointmentDetail';

export const metadata: Metadata = { title: 'Appointment', robots: { index: false } };
/** Full-page presentation (direct URL / refresh). Soft navigations from the list are intercepted by @modal/(.)[appointmentId]. */
export default async function AppointmentPage({ params }: PageProps<'/appointments/[appointmentId]'>) {
  const s = await requireSession();
  const a = await load(appointmentService.get(parseId((await params).appointmentId)));
  return <><PageHeader title={`Appointment #${a.id}`} actions={<Link className="text-sm text-primary hover:underline" href="/appointments">← All appointments</Link>} /><Card className="max-w-3xl"><CardBody><AppointmentDetail a={a} role={s.role} /></CardBody></Card></>;
}
