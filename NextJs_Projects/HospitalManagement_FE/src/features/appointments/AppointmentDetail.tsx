import Link from 'next/link';
import { CalendarClock, ClipboardList, Hash, MapPin, Stethoscope, UserRound } from 'lucide-react';
import { StatusBadge } from '@/components/ui/badge';
import { AppointmentActions } from './AppointmentActions';
import { fmtDateTime } from '@/lib/utilities/format';
import type { Prisma } from '@prisma/client';
import type { appointmentInclude } from '@/server/repositories/appointment.repository';
type A = Prisma.AppointmentGetPayload<{ include: typeof appointmentInclude }>;
/** Server Component shared by the full page and the intercepted modal. */
export function AppointmentDetail({ a, base }: { a: A; base: string }) {
  const row = (I: typeof Hash, l: string, v: React.ReactNode) => <div className="flex gap-3"><I className="mt-0.5 size-4 shrink-0 text-primary" /><div><dt className="text-xs tracking-wide text-muted uppercase">{l}</dt><dd className="text-sm">{v}</dd></div></div>;
  return <div className="space-y-5"><div className="flex flex-wrap items-center gap-2"><StatusBadge status={a.status} />{a.invoice && <Link className="font-mono text-xs text-primary hover:underline" href={`/patient/billing/${a.invoice.id}`}>{a.invoice.number}</Link>}</div>
    <dl className="grid gap-4 sm:grid-cols-2">{row(CalendarClock, 'When', fmtDateTime(a.startsAt))}{row(Hash, 'Confirmation code', <span className="font-mono">{a.confirmationCode}</span>)}{row(Stethoscope, 'Doctor', `Dr. ${a.doctor.user.firstName} ${a.doctor.user.lastName} · ${a.doctor.specialization.name}`)}{row(UserRound, 'Patient', `${a.patient.user.firstName} ${a.patient.user.lastName}`)}{row(MapPin, 'Hospital', a.hospital.name)}{row(ClipboardList, 'Reason', a.reason ?? '—')}{a.cancelReason && row(ClipboardList, 'Cancellation reason', a.cancelReason)}</dl>
    <AppointmentActions id={a.id} status={a.status} startsAt={a.startsAt.toISOString()} doctorId={a.doctorId} hospitalId={a.hospitalId} base={base} /></div>;
}
