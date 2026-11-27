import Link from 'next/link';
import { requireSession } from '@/lib/auth/session';
import { doctorService } from '@/services/backend/doctors';
import { appointmentService } from '@/services/backend/appointments';
import { load } from '@/lib/api/guards';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { groupSlots } from '@/lib/utilities/slots';
import { todayISO } from '@/lib/utilities/format';
import { cn } from '@/lib/utilities/cn';

export const metadata = { title: 'Doctor availability' };
/** Scenario 3: pick a date (GET form -> URL state) and see EVERY doctor's free vs booked slots, fetched in parallel. */
export default async function AvailabilityPage({ searchParams }: PageProps<'/appointments/availability'>) {
  await requireSession();
  const sp = await searchParams;
  const date = typeof sp.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayISO();
  const available = await load(doctorService.available(date));
  const grids = await Promise.all(available.slice(0, 12).map(async (a) => ({ a, slots: await appointmentService.availability(a.doctor.id, date).catch(() => []) })));
  return (
    <>
      <PageHeader title="Doctor availability" description="Free and occupied slots for the selected day." />
      <form className="mb-4 flex items-end gap-2"><div><label htmlFor="date" className="mb-1 block text-sm font-medium">Date</label><input id="date" name="date" type="date" min={todayISO()} defaultValue={date} className="h-10 rounded-lg border border-line bg-surface px-3 text-sm" /></div><Button type="submit">Show</Button></form>
      {grids.length === 0 ? <EmptyState title="No doctors are available on this date" /> : <div className="space-y-4">{grids.map(({ a, slots }) => <Card key={a.doctor.id}><CardBody><div className="mb-3 flex items-center justify-between"><div><Link href={`/doctors/${a.doctor.id}`} className="font-semibold hover:underline">{a.doctor.fullName}</Link><p className="text-xs text-muted">{a.doctor.specialization} · {slots.filter((s) => s.available).length}/{slots.length} free</p></div><Button asChild size="sm"><Link href={`/appointments/book?doctorId=${a.doctor.id}`}>Book</Link></Button></div>{groupSlots(slots).map((g) => <ul key={g.period} className="mb-1 flex flex-wrap gap-1.5">{g.slots.map((s) => <li key={s.startTime} className={cn('num rounded-md border px-2 py-0.5 text-xs', s.available ? 'border-ok/50 bg-ok/10 text-ok' : 'border-line bg-surface2 text-muted line-through')}>{s.startTime}</li>)}</ul>)}</CardBody></Card>)}</div>}
    </>
  );
}
