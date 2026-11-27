import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertCircle, Bell, CalendarCheck2, CalendarClock, CalendarDays, CheckCircle2, ClipboardCheck, FlaskConical, Hourglass, IndianRupee, Pill, Receipt, Stethoscope, Users, Wallet } from 'lucide-react';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { useAppointmentFeed } from '@/features/appointments/hooks/useAppointments';
import { useBillingStatusCounts, usePatientBills } from '@/features/billing/hooks/useBilling';
import { usePatientLab } from '@/features/laboratory/hooks/useLab';
import { useCurrentPatient } from '@/features/authentication/hooks/useCurrentIdentity';
import { useAuth } from '@/contexts/AuthContext';
import { useNotificationCenter, notificationCategory } from '@/contexts/NotificationsContext';
import { can } from '@/constants/permissions';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { Notice } from '@/components/common/Notice';
import { ProfiledSection } from '@/components/common/ProfiledSection';
import { AppointmentStatusBadge } from '@/components/common/StatusBadge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate, formatDateTime, formatTimeRange, humanize, todayISO } from '@/utils/format';

/** Dashboard (Tailwind). Every figure comes from a real API call; figures the role may not read show "n/a" instead of being invented. */
export default function DashboardPage() {
  const { user, role } = useAuth();
  const stats = useDashboardStats();
  const appts = useAppointmentFeed();
  const own = useCurrentPatient();
  const myBills = usePatientBills(role === 'PATIENT' ? (own.patient?.id ?? 0) : 0);
  const myLab = usePatientLab(role === 'PATIENT' ? (own.patient?.id ?? 0) : 0);
  const staffBills = useBillingStatusCounts(can(role, 'billing:manage'));
  const { items: notes, unreadCount, isRead } = useNotificationCenter();

  const today = todayISO();
  const apptStats = useMemo(() => {
    const d = appts.data;
    return { total: d.length, today: d.filter((a) => a.date === today && a.status !== 'CANCELLED').length, pending: d.filter((a) => a.status === 'BOOKED').length, completed: d.filter((a) => a.status === 'COMPLETED').length };
  }, [appts.data, today]);
  const upcoming = useMemo(() => appts.data.filter((a) => a.status === 'BOOKED' && a.date >= today).sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime)).slice(0, 5), [appts.data, today]);

  const s = stats.data;
  const lab = s?.lab ?? (role === 'PATIENT' && myLab.data ? { REQUESTED: myLab.data.filter((r) => r.status === 'REQUESTED').length, SAMPLE_COLLECTED: myLab.data.filter((r) => r.status === 'SAMPLE_COLLECTED').length, IN_PROGRESS: myLab.data.filter((r) => r.status === 'IN_PROGRESS').length, COMPLETED: myLab.data.filter((r) => r.status === 'COMPLETED').length, CANCELLED: 0 } : null);
  const labPending = lab ? lab.REQUESTED + lab.SAMPLE_COLLECTED + lab.IN_PROGRESS : undefined;
  const patientDue = (myBills.data ?? []).filter((b) => b.status === 'PENDING' || b.status === 'OVERDUE');
  const pendingBills = role === 'PATIENT' ? patientDue.length : staffBills.counts.PENDING + staffBills.counts.OVERDUE;
  const outstanding = role === 'PATIENT' ? patientDue.reduce((a, b) => a + b.totalAmount - b.paidAmount, 0) : staffBills.outstanding;
  const collected = role === 'PATIENT' ? (myBills.data ?? []).reduce((a, b) => a + b.paidAmount, 0) : staffBills.collected;
  const billingKnown = role === 'PATIENT' ? !!own.patient : can(role, 'billing:manage');
  const billingLoading = role === 'PATIENT' ? myBills.isPending && !!own.patient : staffBills.isPending;
  const labKnown = !!lab;
  const labLoading = role === 'PATIENT' ? myLab.isPending && !!own.patient : stats.isPending;

  return (
    <>
      <PageHeader title={`Welcome back, ${user?.username}`} subtitle={`${humanize(role ?? '')} · ${formatDate(today)}`} icon={<Activity className="h-5 w-5" />} />
      {stats.isError && <div className="mb-4"><Notice tone="warning" title="Some figures could not be loaded">{(stats.error as Error)?.message}</Notice></div>}
      {s && s.failed.length > 0 && <div className="mb-4"><Notice tone="warning" title="Partial data">These sources did not answer in time: {s.failed.join(', ')}. The rest of the dashboard is unaffected.</Notice></div>}
      <ProfiledSection id="DashboardStats">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total patients" value={s?.patients} icon={<Users className="h-5 w-5" />} loading={stats.isPending} unavailable={!stats.isPending && s?.patients == null} to={can(role, 'patients:read') ? '/patients' : undefined} />
          <StatCard label="Total doctors" value={s?.doctors} icon={<Stethoscope className="h-5 w-5" />} tone="green" loading={stats.isPending} unavailable={!stats.isPending && s?.doctors == null} to="/doctors" />
          <StatCard label={role === 'PATIENT' ? 'My appointments' : role === 'DOCTOR' ? 'My appointments' : 'Total appointments'} value={apptStats.total} icon={<CalendarDays className="h-5 w-5" />} tone="violet" loading={appts.isPending} unavailable={!['ADMIN', 'DOCTOR', 'PATIENT'].includes(role ?? '')} to="/appointments" />
          <StatCard label="Today's appointments" value={apptStats.today} icon={<CalendarClock className="h-5 w-5" />} tone="amber" loading={appts.isPending} unavailable={!['ADMIN', 'DOCTOR', 'PATIENT'].includes(role ?? '')} to="/appointments/calendar" />
          <StatCard label="Pending appointments" value={apptStats.pending} icon={<Hourglass className="h-5 w-5" />} tone="amber" loading={appts.isPending} unavailable={!['ADMIN', 'DOCTOR', 'PATIENT'].includes(role ?? '')} hint="Booked, not yet completed" to="/appointments?status=BOOKED" />
          <StatCard label="Completed appointments" value={apptStats.completed} icon={<CheckCircle2 className="h-5 w-5" />} tone="green" loading={appts.isPending} unavailable={!['ADMIN', 'DOCTOR', 'PATIENT'].includes(role ?? '')} to="/appointments?status=COMPLETED" />
          <StatCard label="Pending lab tests" value={labPending} icon={<FlaskConical className="h-5 w-5" />} tone="amber" loading={labLoading} unavailable={!labKnown && !labLoading} to="/lab/requests" />
          <StatCard label="Completed lab reports" value={lab?.COMPLETED} icon={<ClipboardCheck className="h-5 w-5" />} tone="green" loading={labLoading} unavailable={!labKnown && !labLoading} to="/lab/reports" />
          <StatCard label="Pending bills" value={pendingBills} icon={<Receipt className="h-5 w-5" />} tone="red" loading={billingLoading} unavailable={!billingKnown} hint={outstanding ? `${formatCurrency(outstanding)} outstanding` : undefined} to="/billing/invoices?status=PENDING" />
          <StatCard label="Payments collected" value={formatCurrency(collected)} icon={<Wallet className="h-5 w-5" />} tone="green" loading={billingLoading} unavailable={!billingKnown} to="/billing/payments" />
          <StatCard label="Outstanding balance" value={formatCurrency(outstanding)} icon={<IndianRupee className="h-5 w-5" />} tone="violet" loading={billingLoading} unavailable={!billingKnown} to="/billing" />
          {can(role, 'pharmacy:access') ? <StatCard label="Low-stock medicines" value={s?.lowStock} icon={<Pill className="h-5 w-5" />} tone="red" loading={stats.isPending} unavailable={!stats.isPending && s?.lowStock == null} to="/pharmacy/availability" /> : <StatCard label="Unread notifications" value={unreadCount} icon={<Bell className="h-5 w-5" />} tone="brand" to="/notifications/unread" />}
        </div>
      </ProfiledSection>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-5"><div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 font-semibold"><CalendarCheck2 className="h-4 w-4" /> Upcoming appointments</h2><Link to="/appointments" className="text-xs text-brand-600 hover:underline">View all</Link></div>
          {appts.isPending ? <Skeleton className="h-24" /> : upcoming.length === 0 ? <p className="text-sm text-muted">{['ADMIN', 'DOCTOR', 'PATIENT'].includes(role ?? '') ? 'No upcoming appointments.' : 'Appointments are managed by doctors, patients and administrators.'}</p> : <ul className="divide-y divide-[var(--hms-border)] text-sm">{upcoming.map((a) => <li key={a.id}><Link to={`/appointments/${a.id}`} className="flex items-center justify-between gap-2 py-2.5 hover:underline"><span><b>{formatDate(a.date)}</b> {formatTimeRange(a.startTime, a.endTime)}<span className="block text-xs text-muted">{role === 'PATIENT' ? a.doctorName : `${a.patientName} · ${a.doctorName}`}</span></span><AppointmentStatusBadge status={a.status} /></Link></li>)}</ul>}
        </Card>
        <Card className="p-5"><div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 font-semibold"><Activity className="h-4 w-4" /> Recent activity</h2><Link to="/notifications" className="text-xs text-brand-600 hover:underline">All notifications</Link></div>
          {notes.length === 0 ? <p className="text-sm text-muted">No recent activity.</p> : <ul className="divide-y divide-[var(--hms-border)] text-sm">{notes.slice(0, 6).map((n) => <li key={n.id}><Link to={`/notifications/${n.id}`} state={{ notification: n }} className="flex items-start justify-between gap-3 py-2.5 hover:underline"><span className="min-w-0"><span className={`block truncate ${isRead(n.id) ? '' : 'font-semibold'}`}>{n.subject}</span><span className="block truncate text-xs text-muted">{n.message}</span></span><span className="shrink-0 text-right text-xs text-muted">{notificationCategory(n.eventType)}<br />{formatDateTime(n.createdAt)}</span></Link></li>)}</ul>}
        </Card>
      </div>
      {role === 'PATIENT' && own.missingProfile && <div className="mt-6"><Notice tone="warning" title="Finish your registration">Your account has no patient profile yet.<Button className="ml-3" size="sm" asChild><Link to="/register">Complete profile</Link></Button></Notice></div>}
      <p className="mt-6 flex items-center gap-1.5 text-xs text-muted"><AlertCircle className="h-3.5 w-3.5" /> Figures are live from the backend; "n/a" means your role is not allowed to read that figure.</p>
    </>
  );
}
