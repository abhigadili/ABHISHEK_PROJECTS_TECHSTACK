import { requireSession } from '@/lib/auth/session';
import { doctorService } from '@/services/backend/doctors';
import { load, parseId } from '@/lib/api/guards';
import { ScheduleEditor } from '@/features/doctors/ScheduleEditor';
import { DaysOff } from '@/features/doctors/DaysOff';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { can } from '@/constants/permissions';

/** Doctor schedule + days off. Reads are cached 60 s under tag `doctor-schedule-{id}`; saving revalidates that tag (Scenario 3). */
export const metadata = { title: 'Doctor schedule' };
export default async function SchedulePage({ params }: PageProps<'/doctors/[doctorId]/schedule'>) {
  const id = parseId((await params).doctorId);
  const s = await requireSession();
  const [days, off] = await Promise.all([load(doctorService.schedule(id)), load(doctorService.unavailability(id))]);
  const canEdit = can(s.role, 'doctors:schedule'); // UI hint only - the Server Action and the backend re-check
  return <div className="space-y-6"><Card><CardHeader><CardTitle>Weekly schedule</CardTitle></CardHeader><CardBody><ScheduleEditor doctorId={id} initial={days} readOnly={!canEdit} /></CardBody></Card><Card><CardHeader><CardTitle>Days off</CardTitle></CardHeader><CardBody><DaysOff doctorId={id} days={off} canEdit={canEdit} /></CardBody></Card></div>;
}
