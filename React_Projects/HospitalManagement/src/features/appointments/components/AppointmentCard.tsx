import { createContext, use, type ReactNode } from 'react';
import { CalendarClock, Stethoscope, UserRound, StickyNote, Receipt } from 'lucide-react';
import type { Appointment } from '@/types';
import { Card } from '@/components/ui/card';
import { AppointmentPaymentBadge, AppointmentStatusBadge } from '@/components/common/StatusBadge';
import { formatCurrency, formatDate, formatTimeRange } from '@/utils/format';

/**
 * Compound component: <AppointmentCard> owns the data (via context) and exposes its pieces as static members -
 * `.Header`, `.Details`, `.Notes`, `.Actions` - so callers compose exactly the layout they need without prop drilling.
 */
const Ctx = createContext<Appointment | null>(null);
function useAppt() {
  const a = use(Ctx);
  if (!a) throw new Error('AppointmentCard.* must be rendered inside <AppointmentCard>');
  return a;
}

function Root({ appointment, children, className }: { appointment: Appointment; children: ReactNode; className?: string }) {
  return (
    <Ctx value={appointment}>
      <Card className={className ?? 'p-5'}>{children}</Card>
    </Ctx>
  );
}

function Header({ children }: { children?: ReactNode }) {
  const a = useAppt();
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">Appointment #{a.id}</div>
        <div className="mt-0.5 flex items-center gap-2 text-lg font-bold"><CalendarClock className="h-5 w-5 text-brand-600" />{formatDate(a.date)} · {formatTimeRange(a.startTime, a.endTime)}</div>
      </div>
      <div className="flex items-center gap-2">{children}<AppointmentStatusBadge status={a.status} /></div>
    </div>
  );
}

function Details() {
  const a = useAppt();
  const row = (icon: ReactNode, label: string, value: ReactNode) => (
    <div className="flex items-start gap-2 text-sm"><span className="mt-0.5 text-muted">{icon}</span><span><span className="block text-xs text-muted">{label}</span>{value}</span></div>
  );
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      {row(<UserRound className="h-4 w-4" />, 'Patient', a.patientName)}
      {row(<Stethoscope className="h-4 w-4" />, 'Doctor', a.doctorName)}
      {row(<Receipt className="h-4 w-4" />, 'Consultation fee', <span className="flex items-center gap-2">{formatCurrency(a.fee)} <AppointmentPaymentBadge status={a.paymentStatus} />{a.billNumber && <span className="text-xs text-muted">{a.billNumber}</span>}</span>)}
    </div>
  );
}

function Notes() {
  const a = useAppt();
  if (!a.reason && !a.notes && !a.cancelReason) return null;
  return (
    <div className="mt-4 space-y-2 rounded-lg bg-surface-alt p-3 text-sm">
      {a.reason && <p className="flex gap-2"><StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-muted" /><span><b>Reason:</b> {a.reason}</span></p>}
      {a.notes && <p className="pl-6"><b>Doctor's notes:</b> {a.notes}</p>}
      {a.cancelReason && <p className="pl-6 text-red-700 dark:text-red-300"><b>Cancelled:</b> {a.cancelReason}</p>}
    </div>
  );
}

function Actions({ children }: { children: ReactNode }) {
  return <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">{children}</div>;
}

export const AppointmentCard = Object.assign(Root, { Header, Details, Notes, Actions });
export { useAppt as useAppointmentCard };
