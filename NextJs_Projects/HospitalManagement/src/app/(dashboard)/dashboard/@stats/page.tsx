import { CalendarCheck, CalendarClock, CalendarDays, CheckCircle2, FlaskConical, ReceiptText, Stethoscope, Users, Wallet, ClipboardCheck } from 'lucide-react';
import { requireSession } from '@/lib/auth/session';
import { getAppointmentStats, getBillingStats, getLabStats, getMyPatientSnapshot, getPeopleCounts } from '@/lib/dashboard/metrics';
import { StatCard } from '@/components/common/StatCard';
import { formatCurrency, formatNumber } from '@/lib/utilities/format';
import { Alert } from '@/components/ui/empty-state';
import Link from 'next/link';

const n = (v: number | null | undefined) => (v === null || v === undefined ? 'n/a' : formatNumber(v));

/** Server Component slot. Staff see hospital-wide figures (parallel fetch, Promise.all); a PATIENT sees only their own data. */
export default async function Stats() {
  const s = await requireSession();
  if (s.role === 'PATIENT') {
    const snap = await getMyPatientSnapshot(s.userId);
    if (!snap) return <Alert tone="warn">You have not completed your patient profile yet. <Link className="font-medium underline" href="/patients/register">Complete registration</Link> to book appointments.</Alert>;
    const pendingBills = snap.bills.filter((b) => b.status === 'PENDING');
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Upcoming appointments" value={snap.upcoming.length} icon={<CalendarClock className="size-5" />} />
        <StatCard label="Appointments (all time)" value={snap.appointments.length} icon={<CalendarDays className="size-5" />} tone="info" />
        <StatCard label="Lab requests" value={snap.lab.length} icon={<FlaskConical className="size-5" />} tone="warn" hint={`${snap.lab.filter((l) => l.status === 'COMPLETED').length} completed`} />
        <StatCard label="Outstanding bills" value={pendingBills.length} icon={<ReceiptText className="size-5" />} tone="warn" hint={formatCurrency(pendingBills.reduce((a, b) => a + b.totalAmount - b.paidAmount, 0))} />
      </div>
    );
  }
  const [people, appts, lab, billing] = await Promise.all([getPeopleCounts(s.role), getAppointmentStats(s.role), getLabStats(s.role), getBillingStats(s.role)]);
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Total patients" value={n(people.patients)} icon={<Users className="size-5" />} />
      <StatCard label="Total doctors" value={n(people.doctors)} icon={<Stethoscope className="size-5" />} tone="info" />
      <StatCard label="Total appointments" value={n(appts?.total)} icon={<CalendarDays className="size-5" />} />
      <StatCard label="Today's appointments" value={n(appts?.today)} icon={<CalendarCheck className="size-5" />} tone="ok" />
      <StatCard label="Pending appointments" value={n(appts?.pending)} icon={<CalendarClock className="size-5" />} tone="warn" />
      <StatCard label="Completed appointments" value={n(appts?.completed)} icon={<CheckCircle2 className="size-5" />} tone="ok" />
      <StatCard label="Pending lab tests" value={n(lab?.pending)} icon={<FlaskConical className="size-5" />} tone="warn" />
      <StatCard label="Completed lab reports" value={n(lab?.completed)} icon={<ClipboardCheck className="size-5" />} tone="ok" />
      <StatCard label="Pending bills" value={n(billing?.pendingCount)} icon={<ReceiptText className="size-5" />} tone="warn" hint={billing ? `${formatCurrency(billing.pendingAmount)} outstanding` : undefined} />
      <StatCard label="Payments received" value={billing ? formatCurrency(billing.paidAmount) : 'n/a'} icon={<Wallet className="size-5" />} tone="ok" hint={billing ? `${billing.paidCount} paid bills${billing.sampled ? ' (latest 100)' : ''}` : undefined} />
    </div>
  );
}
