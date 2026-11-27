import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAppointment, useAvailability, useRescheduleAppointment } from '../hooks/useAppointments';
import { SlotPicker } from '../components/SlotPicker';
import { QueryBoundary } from '@/components/common/QueryBoundary';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/ErrorState';
import { Notice } from '@/components/common/Notice';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from '@/services/axios/errors';
import { formatDate, formatTimeRange, todayISO } from '@/utils/format';
import type { Appointment } from '@/types';

export default function RescheduleAppointmentPage() {
  const id = Number(useParams().appointmentId);
  const query = useAppointment(id);
  return <QueryBoundary query={query}>{(a) => <Reschedule appointment={a} />}</QueryBoundary>;
}

/** Dependent queries: appointment -> (doctor, new date) -> live availability. */
function Reschedule({ appointment: a }: { appointment: Appointment }) {
  const navigate = useNavigate();
  const [date, setDate] = useState(a.date < todayISO() ? todayISO() : a.date);
  const [time, setTime] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const slots = useAvailability(a.doctorId, date);
  const mutation = useRescheduleAppointment(a.id);
  if (a.status !== 'BOOKED') return <><PageHeader title="Reschedule" /><Notice tone="warning">Only booked appointments can be rescheduled. This one is {a.status.toLowerCase()}.</Notice><Button className="mt-4" variant="outline" asChild><Link to={`/appointments/${a.id}`}>Back</Link></Button></>;
  const submit = async () => {
    if (!time) return;
    setError(null);
    try { await mutation.mutateAsync({ date, startTime: time }); toast.success('Appointment rescheduled'); navigate(`/appointments/${a.id}`); }
    catch (e) { setError(errorMessage(e)); setTime(null); }
  };
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="Reschedule appointment" subtitle={`${a.patientName} with ${a.doctorName}`} />
      <Card className="p-5"><p className="text-sm text-muted">Current time</p><p className="font-semibold">{formatDate(a.date)} · {formatTimeRange(a.startTime, a.endTime)}</p></Card>
      <Card className="p-5">
        <label className="text-xs font-medium text-muted">New date<input type="date" min={todayISO()} value={date} onChange={(e) => { setDate(e.target.value || todayISO()); setTime(null); }} className="mt-1 block h-9 rounded-md border border-line bg-surface px-2 text-sm text-fg" /></label>
        <div className="mt-4">{slots.isPending ? <Skeleton className="h-20" /> : slots.isError ? <ErrorState error={slots.error} onRetry={() => void slots.refetch()} /> : <SlotPicker slots={slots.data} value={time} onChange={setTime} />}</div>
      </Card>
      {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
      <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => navigate(-1)}>Back</Button><Button disabled={!time || mutation.isPending} onClick={() => void submit()}>{mutation.isPending ? 'Saving…' : 'Confirm new time'}</Button></div>
    </div>
  );
}
