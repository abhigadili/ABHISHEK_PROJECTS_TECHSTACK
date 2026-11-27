import { requirePermission } from '@/lib/auth/session';
import { appointmentService } from '@/services/backend/appointments';
import { load, parseId } from '@/lib/api/guards';
import { PageHeader } from '@/components/common/PageHeader';
import { RescheduleForm } from '@/features/appointments/RescheduleForm';
import { Alert } from '@/components/ui/empty-state';

export const metadata = { title: 'Reschedule appointment', robots: { index: false } };
export default async function ReschedulePage({ params }: PageProps<'/appointments/[appointmentId]/reschedule'>) {
  await requirePermission('appointments:manage');
  const a = await load(appointmentService.get(parseId((await params).appointmentId)));
  return <><PageHeader title={`Reschedule appointment #${a.id}`} description={`${a.doctorName} · currently ${a.date} ${a.startTime}`} />{a.status !== 'BOOKED' ? <Alert tone="warn">Only booked appointments can be rescheduled.</Alert> : <RescheduleForm appointment={a} />}</>;
}
