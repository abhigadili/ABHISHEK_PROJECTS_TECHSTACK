import { AuthUser, ServiceClient, hasPermission, settleSections, today, addDays, withTimeout, Row } from '@hr/common';
import { gatewayConfig } from '../config';

const clients = {
  employee: new ServiceClient('employee', { retries: 1 }), leave: new ServiceClient('leave', { retries: 1 }), holiday: new ServiceClient('holiday', { retries: 1 }), attendance: new ServiceClient('attendance', { retries: 1 }),
  timesheet: new ServiceClient('timesheet', { retries: 1 }), payroll: new ServiceClient('payroll', { retries: 1 }), performance: new ServiceClient('performance', { retries: 1 }), project: new ServiceClient('project', { retries: 1 }),
  organization: new ServiceClient('organization', { retries: 1 }),
};
const T = gatewayConfig.dashboardTimeoutMs;
const guard = <R>(p: Promise<R>, name: string): Promise<R> => withTimeout(p, T, name);

/** Aggregation APIs: independent upstream calls run concurrently; a failing section is reported, not fatal. */
export class DashboardService {
  async employee(u: AuthUser) {
    if (!u.employeeId) return { message: 'Your account is not linked to an employee', unavailable: [] };
    const month = today().slice(0, 7);
    // profile first: the holiday calendar depends on the employee's location
    const profile = await guard(clients.employee.get<Row>('/api/v1/employees/me'), 'employee').catch(() => null);
    const canApprove = hasPermission(u, 'LEAVE_APPROVE', 'TIMESHEET_APPROVE', 'ATTENDANCE_APPROVE');
    const { data, unavailable } = await settleSections({
      leaveBalance: () => guard(clients.leave.get('/api/v1/leave-balances/me'), 'leave'),
      upcomingHolidays: () => guard(clients.holiday.get('/api/v1/holidays/upcoming', { limit: 5, locationId: profile?.locationId, departmentId: profile?.departmentId }), 'holiday'),
      attendanceToday: () => guard(clients.attendance.get('/api/v1/attendance/today'), 'attendance'),
      attendanceSummary: () => guard(clients.attendance.get<Row>('/api/v1/attendance/monthly', { month }).then((r) => r.summary), 'attendance'),
      recentTimesheets: () => guard(clients.timesheet.get<Row>('/api/v1/timesheets', { size: 3, sort: 'week_start,desc' }).then((p) => p.content), 'timesheet'),
      latestPayslip: () => guard(clients.payroll.get('/api/v1/payroll/payslips/me/latest'), 'payroll'),
      pendingApprovals: () => canApprove ? guard(Promise.allSettled([
        hasPermission(u, 'LEAVE_APPROVE') ? clients.leave.get<Row[]>('/api/v1/leaves/pending-approvals') : Promise.resolve([]),
        hasPermission(u, 'TIMESHEET_APPROVE') ? clients.timesheet.get<Row[]>('/api/v1/timesheets/pending-approvals') : Promise.resolve([]),
      ]).then(([l, t]) => ({ leave: l.status === 'fulfilled' ? l.value.length : null, timesheets: t.status === 'fulfilled' ? t.value.length : null })), 'approvals') : Promise.resolve(null),
      performanceReview: () => guard(clients.performance.get<Row | null>('/api/v1/performance/reviews/me').then((r) => (r ? { id: r.id, status: r.status, cycle: r.cycle?.name, selfEvalDeadline: r.cycle?.selfEvalDeadline } : null)), 'performance'),
    });
    return {
      profile: profile && { employeeId: profile.id, employeeCode: profile.employeeCode, fullName: profile.fullName, department: profile.department?.name ?? null, designation: profile.designation?.title ?? null, location: profile.location?.name ?? null, manager: profile.manager, status: profile.status, tenureMonths: profile.tenureMonths },
      ...data, upcomingEvents: ((data.upcomingHolidays as Row[] | null) ?? []).map((h) => ({ type: 'HOLIDAY', title: h.name, date: h.holidayDate })), generatedAt: new Date().toISOString(), unavailable: profile ? unavailable : ['profile', ...unavailable],
    };
  }

  async manager(u: AuthUser) {
    if (!u.employeeId) return { message: 'Your account is not linked to an employee', unavailable: [] };
    if (!hasPermission(u, 'TEAM_VIEW', 'LEAVE_APPROVE', 'TIMESHEET_APPROVE')) return { message: 'Manager dashboard requires a manager role', unavailable: [] };
    const { data, unavailable } = await settleSections({
      team: () => guard(clients.employee.get<Row[]>(`/api/v1/employees/${u.employeeId}/team`), 'employee'),
      pendingLeaveApprovals: () => guard(clients.leave.get('/api/v1/leaves/pending-approvals'), 'leave'),
      teamAttendance: () => guard(clients.attendance.get<Row>('/api/v1/attendance/team').then((r) => ({ date: r.date, headcount: r.headcount, present: r.present, members: r.members })), 'attendance'),
      pendingTimesheetApprovals: () => guard(clients.timesheet.get('/api/v1/timesheets/pending-approvals'), 'timesheet'),
      upcomingReviews: () => guard(clients.performance.get<Row>('/api/v1/performance/reviews', { status: 'SELF_SUBMITTED', size: 20 }).then((p) => p.content), 'performance'),
      upcomingLeaves: () => guard(clients.leave.get('/api/v1/leaves/upcoming'), 'leave'),
    });
    const team = (data.team as Row[] | null) ?? [];
    const allocation = await guard(Promise.allSettled(team.map((m) => clients.project.get<Row[]>(`/api/v1/projects/employee/${m.employeeId}`))).then((rs) => rs.map((r, i) => ({ employeeId: team[i].employeeId, fullName: team[i].fullName, allocations: r.status === 'fulfilled' ? r.value : null }))), 'project').catch(() => null);
    return { ...data, teamProjectAllocation: allocation, generatedAt: new Date().toISOString(), unavailable: allocation ? unavailable : [...unavailable, 'teamProjectAllocation'] };
  }
}
void addDays;
