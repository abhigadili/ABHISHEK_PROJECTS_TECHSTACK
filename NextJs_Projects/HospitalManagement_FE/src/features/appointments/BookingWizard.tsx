'use client';
import Link from 'next/link';
import { memo, useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { booking, fetchDoctors, fetchSlots } from '@/store/slices/bookingSlice';
import { bookAppointmentAction } from './actions';
import { useDebounce } from '@/hooks/useDebounce';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Alert, EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utilities/cn';
import { fmtMoney, todayISO } from '@/lib/utilities/format';

/** memo(): a slot button only re-renders when its own props change (long slot grids stay cheap while other state updates). */
const SlotButton = memo(function SlotButton({ label, starts, available, selected, onPick }: { label: string; starts: string; available: boolean; selected: boolean; onPick: (s: string) => void }) {
  return <button type="button" role="radio" aria-checked={selected} disabled={!available} onClick={() => onPick(starts)} className={cn('num cursor-pointer rounded-lg border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:line-through disabled:opacity-40', selected ? 'border-primary bg-primary text-primary-fg' : 'border-line hover:bg-surface2')}>{label}</button>;
});
export interface HospitalOpt { id: number; name: string; city: string | null; departments: { id: number; name: string }[] }
/**
 * Scenario 2 (patient side). Workflow state lives in Redux Toolkit (hospital → department → doctor → date → slot), data is loaded with
 * async thunks (Axios → REST API), the final mutation is a Server Action that re-validates and books inside a DB transaction.
 */
export function BookingWizard({ hospitals, isStaff = false, patientId }: { hospitals: HospitalOpt[]; isStaff?: boolean; patientId?: number }) {
  const d = useAppDispatch(); const s = useAppSelector((x) => x.booking); const sp = useSearchParams();
  const [text, setText] = useState(''); const q = useDebounce(text, 350); const [reason, setReason] = useState('');
  const [pending, start] = useTransition(); const [error, setError] = useState<string | null>(null); const [done, setDone] = useState<{ id: number; code: string } | null>(null);
  const hospital = hospitals.find((h) => h.id === s.hospitalId); const doctor = s.doctors.find((x) => x.id === s.doctorId);

  useEffect(() => { d(booking.reset()); const h = Number(sp.get('hospitalId')); if (h) d(booking.selectHospital(h)); }, [d, sp]);
  useEffect(() => { if (s.hospitalId) void d(fetchDoctors({ hospitalId: s.hospitalId, departmentId: s.departmentId, q })); }, [d, s.hospitalId, s.departmentId, q]);
  useEffect(() => { if (s.doctorId && s.hospitalId && s.date) void d(fetchSlots({ doctorId: s.doctorId, hospitalId: s.hospitalId, date: s.date })); }, [d, s.doctorId, s.hospitalId, s.date]);
  const groups = useMemo(() => [['Morning', (x: string) => Number(x.slice(0, 2)) < 12], ['Afternoon', (x: string) => Number(x.slice(0, 2)) >= 12 && Number(x.slice(0, 2)) < 17], ['Evening', (x: string) => Number(x.slice(0, 2)) >= 17]] as const, []);

  const pick = useCallback((v: string) => d(booking.selectSlot(v)), [d]);
  const submit = () => { setError(null); start(async () => { const r = await bookAppointmentAction({ doctorId: s.doctorId, hospitalId: s.hospitalId, startsAt: s.slot, reason, ...(patientId ? { patientId } : {}) }); if (r.ok && r.data) { setDone(r.data as { id: number; code: string }); d(fetchSlots({ doctorId: s.doctorId!, hospitalId: s.hospitalId!, date: s.date })); } else { setError(r.message ?? 'Booking failed'); if (s.doctorId && s.hospitalId) void d(fetchSlots({ doctorId: s.doctorId, hospitalId: s.hospitalId, date: s.date })); d(booking.selectSlot(null)); } }); };
  if (done) return <Card className="mx-auto max-w-xl text-center"><CardBody className="space-y-3 py-10"><CheckCircle2 className="mx-auto size-12 text-ok" /><h2 className="text-xl font-semibold">Appointment confirmed</h2><p>Dr. {doctor?.user.lastName} · {new Date(s.slot!).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p><p>Confirmation code <span className="rounded bg-surface2 px-2 py-1 font-mono">{done.code}</span></p><p className="text-sm text-muted">You and the doctor have been notified.</p><div className="flex justify-center gap-2 pt-2"><Button asChild><Link href={`${isStaff ? '/admin/appointments' : `/patient/appointments/${done.id}`}`}>View appointment</Link></Button><Button variant="outline" onClick={() => { setDone(null); d(booking.reset()); }}>Book another</Button></div></CardBody></Card>;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <Card><CardHeader><CardTitle>1 · Hospital & department</CardTitle></CardHeader><CardBody className="grid gap-3 sm:grid-cols-2"><NativeSelect aria-label="Hospital" value={s.hospitalId ?? ''} onChange={(e) => d(booking.selectHospital(e.target.value ? Number(e.target.value) : null))}><option value="">Choose a hospital…</option>{hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}{h.city ? ` (${h.city})` : ''}</option>)}</NativeSelect><NativeSelect aria-label="Department" disabled={!hospital} value={s.departmentId ?? ''} onChange={(e) => d(booking.selectDepartment(e.target.value ? Number(e.target.value) : null))}><option value="">All departments</option>{hospital?.departments.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</NativeSelect></CardBody></Card>
        <Card><CardHeader><CardTitle>2 · Doctor</CardTitle></CardHeader><CardBody className="space-y-3"><Input aria-label="Search doctors" placeholder="Search by name or specialty" disabled={!s.hospitalId} value={text} onChange={(e) => setText(e.target.value)} />
          {!s.hospitalId ? <p className="text-sm text-muted">Choose a hospital first.</p> : s.doctorsStatus === 'loading' ? <div className="grid gap-2 sm:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div> : s.doctorsStatus === 'failed' ? <Alert tone="danger">{s.error}</Alert> : s.doctors.length === 0 ? <EmptyState title="No doctors found" /> : <ul className="grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2" role="radiogroup" aria-label="Doctors">{s.doctors.map((x) => { const n = `Dr. ${x.user.firstName} ${x.user.lastName}`; return <li key={x.id}><button type="button" role="radio" aria-checked={x.id === s.doctorId} onClick={() => d(booking.selectDoctor(x.id))} className={cn('flex w-full cursor-pointer items-center gap-3 rounded-xl border p-3 text-left hover:bg-surface2', x.id === s.doctorId ? 'border-primary bg-primary/5' : 'border-line')}><Avatar name={n} size={40} /><span className="min-w-0"><span className="block truncate text-sm font-medium">{n}</span><span className="block text-xs text-muted">{x.specialization.name} · {fmtMoney(x.consultationFee)}</span></span></button></li>; })}</ul>}</CardBody></Card>
        <Card><CardHeader><CardTitle>3 · Date & time</CardTitle></CardHeader><CardBody className="space-y-3"><Input aria-label="Date" type="date" min={todayISO()} className="w-48" disabled={!s.doctorId} value={s.date} onChange={(e) => d(booking.selectDate(e.target.value))} />
          {!s.doctorId || !s.date ? <p className="text-sm text-muted">Choose a doctor and a date to see free slots.</p> : s.slotsStatus === 'loading' ? <Skeleton className="h-20" /> : s.slots.length === 0 ? <EmptyState title="No slots on this date" description="The doctor may not work that day or has a day off." /> : <div className="space-y-3">{groups.map(([label, test]) => { const list = s.slots.filter((x) => test(x.label)); return list.length ? <div key={label}><p className="mb-1 text-sm font-medium">{label}</p><ul className="flex flex-wrap gap-2" role="radiogroup" aria-label={`${label} slots`}>{list.map((x) => <li key={x.startsAt}><SlotButton label={x.label} starts={x.startsAt} available={x.available} selected={s.slot === x.startsAt} onPick={pick} /></li>)}</ul></div> : null; })}</div>}</CardBody></Card>
      </div>
      <Card className="h-fit lg:sticky lg:top-24"><CardHeader><CardTitle>4 · Confirm</CardTitle></CardHeader><CardBody className="space-y-3 text-sm"><p><b>Hospital:</b> {hospital?.name ?? '—'}</p><p><b>Doctor:</b> {doctor ? `Dr. ${doctor.user.firstName} ${doctor.user.lastName}` : '—'}</p><p><b>When:</b> {s.slot ? new Date(s.slot).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</p><p><b>Fee:</b> {doctor ? fmtMoney(doctor.consultationFee) : '—'}</p><Textarea aria-label="Reason for visit" placeholder="Reason for visit (optional)" maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} />{error && <Alert tone="danger">{error}</Alert>}<Button className="w-full" loading={pending} disabled={!s.slot} onClick={submit}>Confirm booking</Button></CardBody></Card>
    </div>
  );
}
