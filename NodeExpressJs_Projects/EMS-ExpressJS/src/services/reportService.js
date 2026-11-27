const repo = require('../repositories/reportRepository');
const scope = require('./accessScope');
const { localDate, addDays } = require('../utils/dates');

async function dashboard(user) {
  const ids = await scope.visibleEmployeeIds(user);
  const today = localDate();
  const year = +today.slice(0, 4);
  const [counts, byDept, att, onLeave, leave, pending, bdays, annivs] = await Promise.all([
    repo.employeeCounts(ids), repo.headcountByDepartment(ids), repo.attendanceOn(today, ids), repo.onLeaveOn(today, ids),
    repo.leaveStatusCounts(year, ids), repo.pendingApprovalCount(ids), repo.birthdays(today, 30, ids), repo.anniversaries(today, 30, ids),
  ]);
  return {
    asOf: today, employees: counts, headcountByDepartment: byDept.map((r) => ({ ...r, headcount: Number(r.headcount) })),
    attendanceToday: att, onLeaveToday: onLeave, leaveThisYear: leave, pendingLeaveApprovals: pending,
    upcomingBirthdays: bdays, upcomingAnniversaries: annivs,
  };
}
async function upcoming(user, days) {
  const ids = await scope.visibleEmployeeIds(user); const today = localDate();
  return { birthdays: await repo.birthdays(today, days, ids), anniversaries: await repo.anniversaries(today, days, ids) };
}
const defaults = (from, to) => { const t = localDate(); return { from: from || `${t.slice(0, 4)}-01-01`, to: to || t }; };
async function joinersExits(user, { from, to }) {
  const r = defaults(from, to); const ids = await scope.visibleEmployeeIds(user);
  const [joined, left] = await Promise.all([repo.joiners(r.from, r.to, ids), repo.exits(r.from, r.to, ids)]);
  return { ...r, joiners: joined, exits: left };
}
async function leaveBalances(user, { year, departmentId }) {
  const y = year || +localDate().slice(0, 4);
  return { year: y, rows: await repo.leaveBalanceReport(y, await scope.visibleEmployeeIds(user), departmentId) };
}
async function leaveSummary(user, { from, to, departmentId }) {
  const r = defaults(from, to);
  return { ...r, rows: await repo.leaveSummaryReport(r.from, r.to, await scope.visibleEmployeeIds(user), departmentId) };
}
const departments = () => repo.departmentReport().then((rows) => rows.map((r) => ({ ...r, isActive: !!r.isActive, activeEmployees: Number(r.activeEmployees || 0), inactiveEmployees: Number(r.inactiveEmployees || 0) })));
const designations = () => repo.designationReport().then((rows) => rows.map((r) => ({ ...r, isActive: !!r.isActive, activeEmployees: Number(r.activeEmployees) })));
module.exports = { dashboard, upcoming, joinersExits, leaveBalances, leaveSummary, departments, designations, addDays };
