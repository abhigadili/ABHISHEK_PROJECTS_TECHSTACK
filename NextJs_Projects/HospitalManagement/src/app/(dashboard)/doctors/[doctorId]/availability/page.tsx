import { appointmentService } from '@/services/backend/appointments';
import { load, parseId } from '@/lib/api/guards';
import { DatePickerBar } from '@/features/doctors/DatePickerBar';
import { Card, CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { groupSlots } from '@/lib/utilities/slots';
import { todayISO } from '@/lib/utilities/format';
import { cn } from '@/lib/utilities/cn';

export const metadata = { title: 'Doctor availability' };
/** Scenario 3: available vs occupied slots (read live, never cached) for the date in the URL. */
export default async function AvailabilityPage({ params, searchParams }: PageProps<'/doctors/[doctorId]/availability'>) {
  const id = parseId((await params).doctorId);
  const sp = await searchParams;
  const date = typeof sp.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayISO();
  const slots = await load(appointmentService.availability(id, date));
  const groups = groupSlots(slots);
  return (
    <>
      <DatePickerBar date={date} />
      {groups.length === 0 ? <EmptyState title="No slots on this date" description="The doctor does not work on this day, has a day off, or the date is in the past." /> : (
        <div className="space-y-4">{groups.map((g) => <Card key={g.period}><CardBody><h2 className="mb-3 text-sm font-semibold">{g.period} <span className="font-normal text-muted">({g.slots.filter((s) => s.available).length} free)</span></h2><ul className="flex flex-wrap gap-2">{g.slots.map((s) => <li key={s.startTime} className={cn('num rounded-lg border px-3 py-1.5 text-sm', s.available ? 'border-ok/50 bg-ok/10 text-ok' : 'border-line bg-surface2 text-muted line-through')}>{s.startTime}<span className="sr-only">{s.available ? ' available' : ' booked'}</span></li>)}</ul></CardBody></Card>)}</div>
      )}
    </>
  );
}
