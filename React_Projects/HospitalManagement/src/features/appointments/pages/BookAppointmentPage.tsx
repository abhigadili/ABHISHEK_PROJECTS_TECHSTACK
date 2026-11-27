import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck2, Check, ChevronRight, Search, Stethoscope } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAvailability, useBookAppointment } from '../hooks/useAppointments';
import { SlotPicker } from '../components/SlotPicker';
import { AppointmentCard } from '../components/AppointmentCard';
import { useCurrentPatient } from '@/features/authentication/hooks/useCurrentIdentity';
import { useSpecializations } from '@/features/doctors/hooks/useDoctors';
import { usePatient } from '@/features/patients/hooks/usePatients';
import { doctorApi } from '@/services/endpoints/doctorApi';
import { appointmentApi } from '@/services/endpoints/appointmentApi';
import { queryKeys } from '@/services/queryKeys';
import { useAuth } from '@/contexts/AuthContext';
import { useDebouncedValue } from '@/hooks/useDebounce';
import { PatientPicker } from '@/components/common/PatientPicker';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { Notice } from '@/components/common/Notice';
import { LazyAvatar } from '@/components/common/LazyAvatar';
import { PageLoader } from '@/components/common/Spinner';
import { AppointmentStatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage, isApiError } from '@/services/axios/errors';
import { formatCurrency, formatDate, formatTimeRange, todayISO } from '@/utils/format';
import type { Appointment, AvailableDoctor, Patient } from '@/types';
import dayjs from 'dayjs';
import { cn } from '@/utils/cn';

/**
 * Scenario 2 - Doctor appointment booking (Tailwind).
 *  1 search doctors that work on a date (GET /doctors/available?date&specialization), filter by specialization + name
 *  2 pick a doctor            3 retrieve live slots (GET /appointments/availability - dependent query)
 *  4 pick the patient (patient: own profile; admin: searchable)  5 POST /appointments (useMutation)
 *  6 confirmation, caches refreshed, appointment shown in the patient's history (GET /appointments/patient/{id})
 */
export default function BookAppointmentPage() {
  const [params] = useSearchParams();
  const { role } = useAuth();
  const own = useCurrentPatient();
  if (role === 'PATIENT' && own.isPending) return <PageLoader />;
  if (role === 'PATIENT' && own.missingProfile)
    return (<><PageHeader title="Book appointment" /><Notice tone="warning" title="Patient profile required">Appointments are booked for a patient profile. <Link className="font-semibold underline" to="/register">Complete your profile</Link> and come back.</Notice></>);
  return <BookingFlow initialDoctorId={Number(params.get('doctorId')) || null} initialDate={params.get('date') ?? todayISO()} initialTime={params.get('time')} ownPatient={own.patient} />;
}

function Step({ n, title, done, active, children }: { n: number; title: string; done: boolean; active: boolean; children: React.ReactNode }) {
  return (
    <Card className={cn('p-5 transition-opacity', !active && !done && 'opacity-50')}>
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold"><span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-xs text-white', done ? 'bg-emerald-600' : 'bg-brand-600')}>{done ? <Check className="h-3.5 w-3.5" /> : n}</span>{title}</h2>
      {(active || done) && children}
    </Card>
  );
}

function BookingFlow({ initialDoctorId, initialDate, initialTime, ownPatient }: { initialDoctorId: number | null; initialDate: string; initialTime: string | null; ownPatient: Patient | null }) {
  const { role } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [date, setDate] = useState(initialDate < todayISO() ? todayISO() : initialDate);
  const [spec, setSpec] = useState('');
  const [nameQ, setNameQ] = useState('');
  const [doctorId, setDoctorId] = useState<number | null>(initialDoctorId);
  const [time, setTime] = useState<string | null>(initialTime);
  const [picked, setPicked] = useState<Patient | null>(null);
  const [booked, setBooked] = useState<Appointment | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null); // uncontrolled input: read through a ref on submit
  const q = useDebouncedValue(nameQ.trim().toLowerCase(), 250);

  const specs = useSpecializations();
  const available = useQuery({ queryKey: queryKeys.doctors.available(date, spec || undefined), queryFn: ({ signal }) => doctorApi.available(date, spec || undefined, signal), enabled: !!date, placeholderData: (prev) => prev });
  const slots = useAvailability(doctorId, date);
  const book = useBookAppointment();

  const patient = ownPatient ?? picked;
  const patientDetail = usePatient(patient?.id ?? 0, !!patient); // step 6 of the scenario: retrieve the patient's details
  const doctors = useMemo(() => (available.data ?? []).filter((a) => !q || a.doctor.fullName.toLowerCase().includes(q) || a.doctor.specialization.toLowerCase().includes(q)), [available.data, q]);
  const selected: AvailableDoctor | undefined = (available.data ?? []).find((a) => a.doctor.id === doctorId);
  const selectedDoctor = selected?.doctor;

  // history of the chosen patient: used after booking to prove the new appointment is listed
  const history = useQuery({ queryKey: queryKeys.appointments.forPatient(patient?.id ?? 0), queryFn: ({ signal }) => appointmentApi.forPatient(patient!.id, signal), enabled: !!booked && !!patient });

  const submit = async () => {
    if (!patient || !doctorId || !time) return;
    setFormError(null);
    try {
      const a = await book.mutateAsync({ patientId: patient.id, doctorId, date, startTime: time, reason: reasonRef.current?.value.trim() || null });
      setBooked(a);
      toast.success('Appointment booked');
    } catch (e) {
      setFormError(errorMessage(e));
      if (isApiError(e) && (e.status === 409 || e.status === 400)) { setTime(null); void qc.invalidateQueries({ queryKey: queryKeys.appointments.availability(doctorId, date) }); }
    }
  };

  if (booked) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <PageHeader title="Appointment confirmed" subtitle="The booking was accepted by the Appointment Service" icon={<CalendarCheck2 className="h-5 w-5" />} />
        <AppointmentCard appointment={booked}>
          <AppointmentCard.Header />
          <AppointmentCard.Details />
          <AppointmentCard.Notes />
          <AppointmentCard.Actions>
            <Button asChild><Link to={`/appointments/${booked.id}`}>View appointment</Link></Button>
            <Button variant="outline" asChild><Link to={patient ? (role === 'PATIENT' ? '/appointments' : `/patients/${patient.id}/appointments`) : '/appointments'}>Appointment history</Link></Button>
            <Button variant="ghost" onClick={() => { setBooked(null); setTime(null); setPicked(null); }}>Book another</Button>
          </AppointmentCard.Actions>
        </AppointmentCard>
        <Card className="p-5">
          <h3 className="mb-3 font-semibold">{patient?.firstName}'s appointment history</h3>
          {history.isPending ? <Skeleton className="h-16" /> : history.isError ? <ErrorState error={history.error} onRetry={() => void history.refetch()} /> : (
            <ul className="divide-y divide-[var(--hms-border)] text-sm">
              {[...(history.data ?? [])].sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime)).slice(0, 6).map((a) => (
                <li key={a.id} className={cn('flex items-center justify-between py-2', a.id === booked.id && 'font-semibold')}>
                  <span>{formatDate(a.date)} · {formatTimeRange(a.startTime, a.endTime)} · {a.doctorName}{a.id === booked.id && <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800">new</span>}</span>
                  <AppointmentStatusBadge status={a.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Notice>The consultation bill and the confirmation e-mail are created asynchronously by the Billing and Notification services (Kafka); they show up in Billing and Notifications within a few seconds.</Notice>
      </div>
    );
  }

  const step1Done = !!doctorId && !!selectedDoctor;
  const step2Done = step1Done && !!time;
  const step3Done = step2Done && !!patient;
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader title="Book an appointment" subtitle="Find a doctor, choose a free slot and confirm" icon={<CalendarCheck2 className="h-5 w-5" />} />

      <Step n={1} title="Find a doctor" done={step1Done} active>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="text-xs font-medium text-muted">Date<input type="date" min={todayISO()} value={date} onChange={(e) => { setDate(e.target.value || todayISO()); setTime(null); }} className="mt-1 block h-9 rounded-md border border-line bg-surface px-2 text-sm text-fg" /></label>
          <label className="text-xs font-medium text-muted">Specialization<select value={spec} onChange={(e) => { setSpec(e.target.value); setDoctorId(null); setTime(null); }} className="mt-1 block h-9 min-w-[10rem] rounded-md border border-line bg-surface px-2 text-sm text-fg"><option value="">All specializations</option>{specs.data?.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className="relative text-xs font-medium text-muted">Doctor name<Search className="pointer-events-none absolute bottom-2.5 left-2.5 h-4 w-4" /><input value={nameQ} onChange={(e) => setNameQ(e.target.value)} placeholder="Search…" className="mt-1 block h-9 rounded-md border border-line bg-surface pl-8 pr-2 text-sm text-fg" /></label>
        </div>
        {available.isPending ? <div className="grid gap-3 sm:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-20" />)}</div>
          : available.isError ? <ErrorState error={available.error} onRetry={() => void available.refetch()} />
          : doctors.length === 0 ? <EmptyState icon={<Stethoscope className="h-8 w-8" />} title="No doctors available" description={`No doctor works on ${formatDate(date)}${spec ? ` in ${spec}` : ''}. Try another date or specialization.`} />
          : <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Available doctors">
            {doctors.map(({ doctor: d, slotCount, firstSlot, lastSlotEnd }) => (
              <button key={d.id} type="button" role="radio" aria-checked={d.id === doctorId} onClick={() => { setDoctorId(d.id); setTime(null); }}
                className={cn('flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:border-brand-500', d.id === doctorId ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/20' : 'border-line bg-surface')}>
                <LazyAvatar name={d.fullName} size={44} />
                <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{d.fullName}</span><span className="block text-xs text-muted">{d.specialization} · {d.experienceYears ?? '—'} yrs · {formatCurrency(d.consultationFee)}</span><span className="block text-xs text-emerald-700 dark:text-emerald-400">{slotCount} slots · {firstSlot}–{lastSlotEnd}</span></span>
                {d.id === doctorId && <Check className="h-5 w-5 text-brand-600" />}
              </button>
            ))}
          </div>}
        {initialDoctorId && !selectedDoctor && available.data && <p className="mt-3 text-sm text-amber-700">The doctor you came from has no working hours on {formatDate(date)}. Choose another date.</p>}
      </Step>

      <Step n={2} title={`Choose a time${selectedDoctor ? ` with ${selectedDoctor.fullName}` : ''}`} done={step2Done} active={step1Done}>
        {slots.isPending ? <Skeleton className="h-24" /> : slots.isError ? <ErrorState error={slots.error} onRetry={() => void slots.refetch()} /> : <SlotPicker slots={slots.data} value={time} onChange={setTime} />}
      </Step>

      <Step n={3} title="Patient" done={step3Done} active={step2Done}>
        {role === 'PATIENT' ? <p className="text-sm">Booking for yourself: <b>{ownPatient?.firstName} {ownPatient?.lastName}</b> (patient #{ownPatient?.id})</p> : <PatientPicker value={picked} onChange={setPicked} />}
        {patient && patientDetail.data && (
          <dl className="mt-3 grid gap-2 rounded-lg bg-surface-alt p-3 text-sm sm:grid-cols-3"><div><dt className="text-xs text-muted">Date of birth</dt><dd>{formatDate(patientDetail.data.dateOfBirth)}</dd></div><div><dt className="text-xs text-muted">Phone</dt><dd>{patientDetail.data.phone}</dd></div><div><dt className="text-xs text-muted">Allergies</dt><dd>{patientDetail.data.knownAllergies ?? 'none recorded'}</dd></div></dl>
        )}
        {patientDetail.data?.status === 'INACTIVE' && <p className="mt-2 text-sm text-red-600">This patient is deactivated and cannot book appointments.</p>}
      </Step>

      <Step n={4} title="Reason & confirm" done={false} active={step3Done}>
        <label className="block text-sm font-medium">Reason for visit (optional)<textarea ref={reasonRef} maxLength={255} rows={3} placeholder="e.g. Chest pain follow-up" className="mt-1 w-full rounded-md border border-line bg-surface p-2 text-sm text-fg" /></label>
        {step3Done && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-alt p-3 text-sm"><span><b>{selectedDoctor?.fullName}</b> · {formatDate(date)} at {time} · fee {formatCurrency(selectedDoctor?.consultationFee)}</span></div>}
        {formError && <div role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{formError}</div>}
        <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button><Button onClick={() => void submit()} disabled={!step3Done || book.isPending || patientDetail.data?.status === 'INACTIVE'}>{book.isPending ? 'Booking…' : <>Confirm booking <ChevronRight className="h-4 w-4" /></>}</Button></div>
      </Step>
      <p className="text-center text-xs text-muted">{dayjs(date).format('dddd')} · slots shown are live from the Appointment Service; if someone books the same slot first you will be asked to pick another.</p>
    </div>
  );
}
