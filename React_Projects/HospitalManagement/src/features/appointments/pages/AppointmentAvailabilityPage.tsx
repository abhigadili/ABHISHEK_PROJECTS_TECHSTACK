import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAvailability } from '../hooks/useAppointments';
import { SlotPicker } from '../components/SlotPicker';
import { useDoctorList, useDoctorSchedule, useDoctorUnavailability, useUnavailabilityMutations } from '@/features/doctors/hooks/useDoctors';
import { useCurrentDoctor } from '@/features/authentication/hooks/useCurrentIdentity';
import { appointmentApi } from '@/services/endpoints/appointmentApi';
import { queryKeys } from '@/services/queryKeys';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/ErrorState';
import { Notice } from '@/components/common/Notice';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { AppointmentStatusBadge } from '@/components/common/StatusBadge';
import { formatDate, formatTimeRange, humanize, todayISO } from '@/utils/format';
import { DAYS_OF_WEEK } from '@/types';

/**
 * Scenario 3 - Appointment availability management.
 * Shows the weekly schedule, the live slot grid (free vs occupied from the Appointment Service) and the day's bookings;
 * doctors (own) and admins can mark the day off, which immediately refreshes every availability query.
 */
export default function AppointmentAvailabilityPage() {
  const { role } = useAuth();
  const own = useCurrentDoctor();
  const doctors = useDoctorList({ active: true, size: 100 });
  const [doctorId, setDoctorId] = useState<number | null>(null);
  const [date, setDate] = useState(todayISO());
  const effectiveId = doctorId ?? own.doctor?.id ?? doctors.data?.content[0]?.id ?? null;
  const doctor = doctors.data?.content.find((d) => d.id === effectiveId);
  const schedule = useDoctorSchedule(effectiveId ?? 0);
  const slots = useAvailability(effectiveId, date);
  const off = useDoctorUnavailability(effectiveId ?? 0);
  const { add, remove } = useUnavailabilityMutations(effectiveId ?? 0);
  const dayAppts = useQuery({ queryKey: queryKeys.appointments.forDoctor(effectiveId ?? 0, date), queryFn: ({ signal }) => appointmentApi.forDoctor(effectiveId!, date, signal), enabled: !!effectiveId && (role === 'ADMIN' || role === 'DOCTOR') });
  const canManage = role === 'ADMIN' || (role === 'DOCTOR' && own.doctor?.id === effectiveId);
  const dayOff = off.data?.find((o) => o.date === date);
  const sortedSchedule = useMemo(() => [...(schedule.data ?? [])].sort((a, b) => DAYS_OF_WEEK.indexOf(a.dayOfWeek) - DAYS_OF_WEEK.indexOf(b.dayOfWeek)), [schedule.data]);
  const counts = useMemo(() => ({ free: slots.data?.filter((s) => s.available).length ?? 0, busy: slots.data?.filter((s) => !s.available).length ?? 0 }), [slots.data]);

  return (
    <>
      <PageHeader title="Doctor availability" subtitle="Weekly schedule, free and occupied slots" icon={<CalendarClock className="h-5 w-5" />} />
      <Card className="mb-4 flex flex-wrap items-end gap-4 p-4">
        <label className="text-xs font-medium text-muted">Doctor<select value={effectiveId ?? ''} onChange={(e) => setDoctorId(Number(e.target.value))} className="mt-1 block h-9 min-w-[14rem] rounded-md border border-line bg-surface px-2 text-sm text-fg">{doctors.data?.content.map((d) => <option key={d.id} value={d.id}>{d.fullName} — {d.specialization}</option>)}</select></label>
        <label className="text-xs font-medium text-muted">Date<input type="date" value={date} onChange={(e) => setDate(e.target.value || todayISO())} className="mt-1 block h-9 rounded-md border border-line bg-surface px-2 text-sm text-fg" /></label>
        {effectiveId && <Button variant="outline" asChild><Link to={`/doctors/${effectiveId}/schedule`}>{canManage ? 'Edit weekly schedule' : 'Full schedule'} <ExternalLink className="h-3.5 w-3.5" /></Link></Button>}
      </Card>
      {doctors.isError && <ErrorState error={doctors.error} onRetry={() => void doctors.refetch()} />}
      {effectiveId && (
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <Card className="p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{formatDate(date)} · {doctor?.fullName}</h2><div className="flex gap-2"><Badge variant="success">{counts.free} free</Badge><Badge variant="neutral">{counts.busy} occupied</Badge></div></div>
            {dayOff && <Notice tone="warning" title="Day off">{dayOff.reason ?? 'The doctor is on leave.'}</Notice>}
            <div className="mt-3">{slots.isPending ? <Skeleton className="h-24" /> : slots.isError ? <ErrorState error={slots.error} onRetry={() => void slots.refetch()} /> : <SlotPicker slots={slots.data} readOnly />}</div>
            {canManage && (
              <div className="mt-5 border-t border-line pt-4">
                {dayOff ? <Button variant="outline" disabled={remove.isPending} onClick={() => remove.mutate(dayOff.id)}>Remove day off for {formatDate(date)}</Button>
                  : <Button variant="outline" disabled={add.isPending} onClick={() => add.mutate({ date, reason: 'Unavailable' }, { onSuccess: () => toast('Slots for this date were closed') })}>Mark {formatDate(date)} as day off</Button>}
                <p className="mt-2 text-xs text-muted">Duplicate bookings are prevented by the backend (unique slot + overlap checks); a booking made at the same time by someone else is rejected with 409.</p>
              </div>
            )}
          </Card>
          <div className="space-y-4">
            <Card className="p-4"><h3 className="mb-2 text-sm font-semibold">Weekly schedule</h3>
              {schedule.isPending ? <Skeleton className="h-20" /> : sortedSchedule.length === 0 ? <p className="text-sm text-muted">No weekly schedule configured.</p> : <ul className="space-y-1 text-sm">{sortedSchedule.map((d) => <li key={d.dayOfWeek} className="flex justify-between"><span>{humanize(d.dayOfWeek)}</span><span className="text-muted">{formatTimeRange(d.startTime, d.endTime)} · {d.slotMinutes}m{d.breakStart && d.breakEnd ? ` · break ${d.breakStart}` : ''}</span></li>)}</ul>}
            </Card>
            {(role === 'ADMIN' || role === 'DOCTOR') && <Card className="p-4"><h3 className="mb-2 text-sm font-semibold">Bookings on {formatDate(date)}</h3>
              {dayAppts.isPending ? <Skeleton className="h-16" /> : (dayAppts.data ?? []).length === 0 ? <p className="text-sm text-muted">No bookings.</p> : <ul className="space-y-2 text-sm">{dayAppts.data!.map((a) => <li key={a.id}><Link to={`/appointments/${a.id}`} className="flex items-center justify-between hover:underline"><span>{a.startTime} · {a.patientName}</span><AppointmentStatusBadge status={a.status} /></Link></li>)}</ul>}
            </Card>}
          </div>
        </div>
      )}
    </>
  );
}
