import Link from 'next/link';
import { CalendarClock, ClipboardList, IndianRupee, Stethoscope, UserRound } from 'lucide-react';
import { StatusBadge } from '@/components/ui/badge';
import { formatCurrency, formatDate, formatDateTime, formatTimeRange } from '@/lib/utilities/format';
import { AppointmentActions } from './AppointmentActions';
import type { Appointment } from '@/types';
import type { Role } from '@/types';
import { can } from '@/constants/permissions';

/** Server Component shared by the full page and the intercepted modal (same markup, two presentations). */
export function AppointmentDetail({ a, role }: { a: Appointment; role: Role }) {
  const row = (I: typeof UserRound, label: string, v: React.ReactNode) => <div className="flex gap-3"><I className="mt-0.5 size-4 shrink-0 text-primary" /><div><dt className="text-xs tracking-wide text-muted uppercase">{label}</dt><dd className="text-sm">{v}</dd></div></div>;
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2"><StatusBadge status={a.status} /><StatusBadge status={a.paymentStatus} />{a.billNumber && <Link className="font-mono text-xs text-primary hover:underline" href="/billing/invoices">{a.billNumber}</Link>}</div>
      <dl className="grid gap-4 sm:grid-cols-2">
        {row(CalendarClock, 'When', `${formatDate(a.date)} · ${formatTimeRange(a.startTime, a.endTime)}`)}{row(UserRound, 'Patient', can(role, 'patients:read') ? <Link className="hover:underline" href={`/patients/${a.patientId}`}>{a.patientName}</Link> : a.patientName)}
        {row(Stethoscope, 'Doctor', <Link className="hover:underline" href={`/doctors/${a.doctorId}`}>{a.doctorName}</Link>)}{row(IndianRupee, 'Consultation fee', formatCurrency(a.fee))}
        {row(ClipboardList, 'Reason', a.reason ?? '—')}{row(ClipboardList, 'Booked on', formatDateTime(a.createdAt))}
        {a.cancelReason && row(ClipboardList, 'Cancellation reason', a.cancelReason)}{a.notes && row(ClipboardList, 'Doctor notes', a.notes)}
      </dl>
      <AppointmentActions appointment={a} />
    </div>
  );
}
