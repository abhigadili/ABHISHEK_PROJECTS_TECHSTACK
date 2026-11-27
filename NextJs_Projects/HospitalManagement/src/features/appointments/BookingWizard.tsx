'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Search } from 'lucide-react';
import { bookAppointmentAction } from '@/actions/appointments';
import { useDoctorList, usePatientSearch, useSlots, useSpecializations } from './hooks';
import { useDebounce } from '@/hooks/useDebounce';
import { keys } from '@/services/queryKeys';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Alert, EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { groupSlots } from '@/lib/utilities/slots';
import { formatCurrency, formatDate, formatTimeRange, todayISO } from '@/lib/utilities/format';
import { cn } from '@/lib/utilities/cn';
import type { Appointment, Patient } from '@/types';

interface FormValues { doctorId: number | null; date: string; startTime: string; reason: string }
/**
 * Scenario 2 - Doctor appointment booking (React Hook Form + TanStack Query + Server Action).
 * Steps: search/filter doctors → choose date → slots (dependent query) → patient (staff pick one via debounced search; a patient is fixed)
 * → submit → confirmation. After booking, appointment queries are invalidated and the server revalidates tags/paths.
 */
export function BookingWizard({ fixedPatient, isStaff }: { fixedPatient: Patient | null; isStaff: boolean }) {
  const router = useRouter();
  const qc = useQueryClient();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const [spec, setSpec] = useState('');
  const [text, setText] = useState('');
  const [patient, setPatient] = useState<Patient | null>(fixedPatient);
  const [patientText, setPatientText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<Appointment | null>(null);
  const { register, control, setValue, handleSubmit, formState: { errors } } = useForm<FormValues>({ defaultValues: { doctorId: Number(sp.get('doctorId')) || null, date: todayISO(), startTime: '', reason: '' } });
  const { doctorId, date, startTime } = useWatch({ control });

  const doctorsQ = useDoctorList();
  const specsQ = useSpecializations();
  const slotsQ = useSlots(doctorId ?? null, date ?? '');
  const patientsQ = usePatientSearch(useDebounce(patientText, 350));
  const doctors = useMemo(() => (doctorsQ.data ?? []).filter((d) => (!spec || d.specialization === spec) && (!text || `${d.fullName} ${d.specialization}`.toLowerCase().includes(text.toLowerCase()))), [doctorsQ.data, spec, text]);
  const doctor = doctorsQ.data?.find((d) => d.id === doctorId);
  const groups = useMemo(() => groupSlots(slotsQ.data ?? []), [slotsQ.data]);

  const submit = handleSubmit((v) => {
    setError(null);
    if (!patient) return setError('Select the patient first');
    start(async () => {
      const r = await bookAppointmentAction({ patientId: patient.id, doctorId: v.doctorId ?? 0, date: v.date, startTime: v.startTime, reason: v.reason });
      if (r.ok && r.data) { setBooked(r.data); void qc.invalidateQueries({ queryKey: keys.appointments.all }); router.refresh(); return; }
      setError(r.message ?? 'Booking failed'); void qc.invalidateQueries({ queryKey: keys.appointments.slots(v.doctorId, v.date) }); setValue('startTime', ''); // slot may have been taken meanwhile (409)
    });
  });

  if (booked) return (
    <Card className="mx-auto max-w-xl text-center"><CardBody className="space-y-3 py-10"><CheckCircle2 className="mx-auto size-12 text-ok" /><h2 className="text-xl font-semibold">Appointment confirmed</h2>
      <p>{booked.doctorName} · {formatDate(booked.date)} · {formatTimeRange(booked.startTime, booked.endTime)}</p><p className="text-sm text-muted">Consultation fee {formatCurrency(booked.fee)} - a bill and a notification are created automatically by the billing and notification services (this can take a few seconds).</p>
      <div className="flex justify-center gap-2 pt-2"><Button asChild><Link href={`/appointments/${booked.id}`}>View appointment</Link></Button><Button asChild variant="outline"><Link href={`/patients/${booked.patientId}/appointments`}>Appointment history</Link></Button></div></CardBody></Card>
  );

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_380px]" noValidate>
      <div className="space-y-6">
        <Card><CardHeader><CardTitle>1 · Choose a doctor</CardTitle></CardHeader><CardBody className="space-y-3">
          <div className="flex flex-wrap gap-2"><div className="relative min-w-52 flex-1"><Search className="absolute top-3 left-3 size-4 text-muted" /><Input className="pl-9" placeholder="Search doctors" aria-label="Search doctors" value={text} onChange={(e) => setText(e.target.value)} /></div><Select aria-label="Specialization" className="w-52" value={spec} onChange={(e) => setSpec(e.target.value)}><option value="">All specializations</option>{(specsQ.data ?? []).map((s) => <option key={s}>{s}</option>)}</Select></div>
          {doctorsQ.isPending ? <div className="grid gap-2 sm:grid-cols-2">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-16" />)}</div> : doctors.length === 0 ? <EmptyState title="No doctors found" /> : (
            <ul className="grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2" role="radiogroup" aria-label="Doctors">{doctors.map((d) => <li key={d.id}><button type="button" role="radio" aria-checked={d.id === doctorId} onClick={() => { setValue('doctorId', d.id); setValue('startTime', ''); }} className={cn('flex w-full cursor-pointer items-center gap-3 rounded-xl border p-3 text-left hover:bg-surface2', d.id === doctorId ? 'border-primary bg-primary/5' : 'border-line')}><Avatar name={d.fullName} size={40} /><span className="min-w-0"><span className="block truncate text-sm font-medium">{d.fullName}</span><span className="block text-xs text-muted">{d.specialization} · {formatCurrency(d.consultationFee)}</span></span></button></li>)}</ul>
          )}
          {errors.doctorId && <p className="text-xs text-danger">Choose a doctor</p>}
        </CardBody></Card>

        <Card><CardHeader><CardTitle>2 · Pick a date and time</CardTitle></CardHeader><CardBody className="space-y-3">
          <Field label="Date" htmlFor="date"><Input id="date" type="date" min={todayISO()} className="w-48" {...register('date', { required: true, onChange: () => setValue('startTime', '') })} /></Field>
          {!doctorId ? <p className="text-sm text-muted">Choose a doctor to see free slots.</p> : slotsQ.isPending ? <Skeleton className="h-20" /> : slotsQ.isError ? <Alert tone="danger">Could not load slots. <button type="button" className="underline" onClick={() => void slotsQ.refetch()}>Retry</button></Alert> : groups.length === 0 ? <EmptyState title="No slots on this date" description="Try another day - the doctor may be off or the day may be in the past." /> : (
            <div className={cn('space-y-3', slotsQ.isFetching && 'opacity-60')}>{groups.map((g) => <div key={g.period}><p className="mb-1 text-sm font-medium">{g.period}</p><ul className="flex flex-wrap gap-2" role="radiogroup" aria-label={`${g.period} slots`}>{g.slots.map((s) => <li key={s.startTime}><button type="button" role="radio" aria-checked={startTime === s.startTime} disabled={!s.available} onClick={() => setValue('startTime', s.startTime, { shouldValidate: true })} className={cn('num cursor-pointer rounded-lg border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:line-through disabled:opacity-40', startTime === s.startTime ? 'border-primary bg-primary text-primary-fg' : 'border-line hover:bg-surface2')}>{s.startTime}</button></li>)}</ul></div>)}</div>
          )}
        </CardBody></Card>
      </div>

      <div className="space-y-6">
        <Card><CardHeader><CardTitle>3 · Patient</CardTitle></CardHeader><CardBody className="space-y-3">
          {fixedPatient ? <p className="text-sm font-medium">{fixedPatient.firstName} {fixedPatient.lastName}</p> : (
            <>
              {patient ? <div className="flex items-center justify-between rounded-lg border border-primary bg-primary/5 p-2 text-sm"><span>{patient.firstName} {patient.lastName} <span className="text-muted">#{patient.id}</span></span><button type="button" className="text-primary" onClick={() => setPatient(null)}>change</button></div> : (
                <><Input placeholder="Search patient (min 2 letters)" aria-label="Search patient" value={patientText} onChange={(e) => setPatientText(e.target.value)} />
                  {patientsQ.isFetching && <p className="text-xs text-muted">Searching…</p>}
                  <ul className="max-h-48 space-y-1 overflow-y-auto">{(patientsQ.data?.content ?? []).map((p) => <li key={p.id}><button type="button" className="w-full cursor-pointer rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface2" onClick={() => setPatient(p)}>{p.firstName} {p.lastName} <span className="text-xs text-muted">· {p.phone}</span></button></li>)}</ul></>
              )}
              {!isStaff && <Alert tone="warn">You need a patient profile first.</Alert>}
            </>
          )}
        </CardBody></Card>
        <Card><CardHeader><CardTitle>4 · Reason & confirm</CardTitle></CardHeader><CardBody className="space-y-3">
          <Field label="Reason for visit (optional)" htmlFor="reason"><Textarea id="reason" rows={3} maxLength={255} {...register('reason')} /></Field>
          <div className="rounded-lg bg-surface2 p-3 text-sm"><p><b>Doctor:</b> {doctor?.fullName ?? '—'}</p><p><b>When:</b> {startTime ? `${formatDate(date)} at ${startTime}` : '—'}</p><p><b>Fee:</b> {doctor ? formatCurrency(doctor.consultationFee) : '—'}</p></div>
          {error && <Alert tone="danger">{error}</Alert>}
          <Button type="submit" className="w-full" loading={pending} disabled={!doctorId || !startTime || !patient}>Confirm booking</Button>
        </CardBody></Card>
      </div>
    </form>
  );
}
