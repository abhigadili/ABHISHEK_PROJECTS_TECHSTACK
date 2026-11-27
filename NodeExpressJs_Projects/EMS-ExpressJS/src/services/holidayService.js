const repo = require('../repositories/holidayRepository');
const leaveRepo = require('../repositories/leaveRepository');
const attRepo = require('../repositories/attendanceRepository');
const empRepo = require('../repositories/employeeRepository');
const scope = require('./accessScope');
const ApiError = require('../utils/ApiError');
const { localDate, monthRange, eachDate, dayOfWeek } = require('../utils/dates');

const must = (v) => { if (!v) throw ApiError.notFound('Holiday not found'); return v; };
const list = (f) => repo.list(f);
const create = async (b) => repo.findById(await repo.insert(b));
async function update(id, b) { must(await repo.findById(id)); await repo.update(id, b); return repo.findById(id); }
async function remove(id) { if (!(await repo.remove(id))) throw ApiError.notFound('Holiday not found'); }
const weeklyOffs = () => repo.listWeeklyOffs();
async function setWeeklyOffs(location, days) { await repo.replaceWeeklyOffs(location, [...new Set(days)]); return repo.listWeeklyOffs(); }

function monthOrDefault({ year, month }) {
  const t = localDate();
  return monthRange(year || +t.slice(0, 4), month || +t.slice(5, 7));
}

/** Leave calendar: approved/pending leave overlapping the month for employees the user may see, plus holidays and weekly offs. */
async function leaveCalendar(user, q) {
  const { start, end } = monthOrDefault(q);
  const ids = await scope.visibleEmployeeIds(user);
  const { items } = await leaveRepo.list({ employeeIds: ids, statuses: ['PENDING', 'APPROVED'], from: start, to: end, departmentId: q.departmentId, noPaging: true });
  const me = user.employeeId && (await empRepo.findById(user.employeeId));
  const location = me ? me.work_location : undefined;
  return {
    from: start, to: end,
    holidays: await repo.list({ from: start, to: end, location }),
    weeklyOffDays: await repo.effectiveWeeklyOffDays(location || 'ALL'),
    leaves: items.map((l) => ({ id: l.id, employeeId: l.employeeId, employeeName: l.employeeName, leaveType: l.leaveType.code, startDate: l.startDate, endDate: l.endDate, dayPart: l.dayPart, status: l.status })),
  };
}

/** Attendance calendar: a day-by-day view for one employee (self by default). */
async function attendanceCalendar(user, q) {
  const employeeId = q.employeeId || scope.requireEmployee(user);
  await scope.assertCanSee(user, employeeId);
  const emp = await empRepo.findById(employeeId);
  if (!emp) throw ApiError.notFound('Employee not found');
  const { start, end } = monthOrDefault(q);
  const records = new Map((await attRepo_list(employeeId, start, end)).map((r) => [r.workDate, r]));
  const holidays = new Map((await repo.list({ from: start, to: end, location: emp.work_location })).filter((h) => !h.isOptional).map((h) => [h.holidayDate, h.name]));
  const offs = new Set(await repo.effectiveWeeklyOffDays(emp.work_location));
  const days = eachDate(start, end).map((date) => {
    const rec = records.get(date);
    const base = rec ? { status: rec.status, checkInAt: rec.checkInAt, checkOutAt: rec.checkOutAt, workingHours: rec.workingHours } : null;
    return { date, recorded: base, calendarDayType: holidays.has(date) ? 'HOLIDAY' : offs.has(dayOfWeek(date)) ? 'WEEKLY_OFF' : 'WORKING_DAY', holidayName: holidays.get(date) || null };
  });
  return { employeeId, from: start, to: end, days };
}
const attRepo_list = async (employeeId, from, to) => (await attRepo.list({ employeeIds: [employeeId], from, to, noPaging: true })).items;

module.exports = { list, create, update, remove, weeklyOffs, setWeeklyOffs, leaveCalendar, attendanceCalendar };
