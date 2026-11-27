import Link from 'next/link';
import { getDashboard } from '@/lib/server/dashboard';
import { getBalances } from '@/lib/server/leaves';
import { listAttendance } from '@/lib/server/attendance';
import { StatCard, Card, StatusBadge } from '@/components/common/ui';
import { formatTime, todayIso } from '@/lib/utils/format';

/** Slot @kpis — async Server Component: fetches on the server, ships ZERO client JavaScript for these cards. */
export default async function Kpis() {
  const d = await getDashboard(); // memoised across the three slots in this render
  if (d) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total employees" value={d.employees.total} hint={`${d.employees.active} active`} testId="kpi-total" />
        <StatCard label="Inactive" value={d.employees.inactive} testId="kpi-inactive" />
        <StatCard label="On leave today" value={d.onLeaveToday} testId="kpi-onleave" />
        <Card><p className="text-xs font-semibold tracking-wide text-muted uppercase">Pending approvals</p><p className="mt-1 text-3xl font-bold" data-testid="kpi-pending">{d.pendingLeaveApprovals}</p><Link className="text-xs text-primary hover:underline" href="/leaves/approvals">Review requests →</Link></Card>
        <StatCard label="Present today" value={d.attendanceToday.PRESENT ?? 0} testId="kpi-present" />
        <StatCard label="Absent today" value={d.attendanceToday.ABSENT ?? 0} testId="kpi-absent" />
      </div>
    );
  }
  // EMPLOYEE role: the backend answers 403 for the company dashboard → show a personal summary from permitted endpoints (in parallel)
  const [bal, mine] = await Promise.all([getBalances(), listAttendance('me', { from: todayIso(), to: todayIso(), limit: 1 })]);
  const today = mine.items[0];
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="personal-summary">
      {bal.balances.map((b) => <StatCard key={b.leaveTypeId} label={b.leaveTypeName} value={b.available} hint={`${b.used} used of ${b.entitled + b.adjusted}`} />)}
      <Card><p className="text-xs font-semibold tracking-wide text-muted uppercase">Today</p>{today ? <div className="mt-2 space-y-1"><StatusBadge status={today.status} /><p className="text-sm">In {formatTime(today.checkInAt)} · Out {formatTime(today.checkOutAt)}</p></div> : <p className="mt-2 text-sm text-muted">You haven&apos;t checked in yet.</p>}<Link className="text-xs text-primary hover:underline" href="/attendance">Go to attendance →</Link></Card>
    </div>
  );
}
