const { withTransaction } = require('../config/database');
const env = require('../config/env');
const repo = require('../repositories/attendanceRepository');
const empRepo = require('../repositories/employeeRepository');
const notify = require('./notificationService');
const scope = require('./accessScope');
const ApiError = require('../utils/ApiError');
const { localDate, toSqlUtc, monthRange } = require('../utils/dates');
const { ADMINS } = require('../constants');

const hoursBetween = (a, b) => Math.round(((b - a) / 3600000) * 100) / 100;
const asDate = (sql) => new Date(`${sql.replace(' ', 'T')}Z`);

/** Status derived from worked hours (threshold configurable via FULL_DAY_HOURS; a short day is never auto-marked ABSENT). */
function statusForHours(h) {
  return h >= env.attendance.fullDayHours ? 'PRESENT' : 'HALF_DAY';
}

async function checkIn(user, { workMode, remarks }) {
  const employeeId = scope.requireEmployee(user);
  const emp = await empRepo.findBrief(employeeId);
  if (!emp || emp.status !== 'ACTIVE') throw ApiError.forbidden('Only active employees can check in');
  const now = new Date();
  const workDate = localDate(now);
  const id = await withTransaction(async (conn) => {
    const existing = await repo.findByEmployeeDate(employeeId, workDate, conn);
    if (existing && existing.check_in_at) throw ApiError.conflict('Already checked in today', 'ALREADY_CHECKED_IN');
    if (existing) { // HR pre-created a marker (e.g. ON_LEAVE/ABSENT) without a check-in; the employee overrides it by checking in
      await repo.update(existing.id, { check_in_at: toSqlUtc(now), status: 'PRESENT', work_mode: workMode || existing.work_mode, remarks: remarks ?? existing.remarks }, conn);
      return existing.id;
    }
    return repo.insert({ employeeId, workDate, checkInAt: toSqlUtc(now), status: 'PRESENT', workMode: workMode || 'OFFICE', remarks }, conn);
  });
  return repo.findById(id);
}

async function checkOut(user, { remarks }) {
  const employeeId = scope.requireEmployee(user);
  const now = new Date();
  const id = await withTransaction(async (conn) => {
    const rec = await repo.findByEmployeeDate(employeeId, localDate(now), conn);
    if (!rec || !rec.check_in_at) throw ApiError.conflict('No check-in found for today', 'NOT_CHECKED_IN');
    if (rec.check_out_at) throw ApiError.conflict('Already checked out today', 'ALREADY_CHECKED_OUT');
    const inAt = asDate(rec.check_in_at);
    if (now < inAt) throw ApiError.unprocessable('Check-out cannot be before check-in', undefined, 'INVALID_ORDER');
    const hours = hoursBetween(inAt, now);
    await repo.update(rec.id, { check_out_at: toSqlUtc(now), working_hours: hours, status: statusForHours(hours), remarks: remarks ?? rec.remarks }, conn);
    return rec.id;
  });
  return repo.findById(id);
}

async function getById(id, user) {
  const rec = await repo.findById(id);
  if (!rec) throw ApiError.notFound('Attendance record not found');
  await scope.assertCanSee(user, rec.employeeId);
  return rec;
}

const mine = (user, f, paging) => repo.list({ employeeIds: [scope.requireEmployee(user)], ...f, ...paging });

async function listFor(user, f, paging) {
  let ids = await scope.visibleEmployeeIds(user);
  if (f.employeeId) {
    await scope.assertCanSee(user, f.employeeId);
    ids = [f.employeeId];
  }
  return repo.list({ employeeIds: ids, from: f.from, to: f.to, status: f.status, departmentId: f.departmentId, ...paging });
}

/** HR creates (manual) or corrects a record; every change carries a reason and is audited on the row + notified. */
async function correct(id, body, actor) {
  return withTransaction(async (conn) => {
    const rec = await repo.findById(id, conn);
    if (!rec) throw ApiError.notFound('Attendance record not found');
    const cols = await buildCorrection({ checkInAt: rec.checkInAt, checkOutAt: rec.checkOutAt, status: rec.status }, body);
    await repo.update(id, { ...cols, corrected_by: actor.id, corrected_at: toSqlUtc(new Date()), correction_reason: body.reason }, conn);
    await notify.notifyEmployees([rec.employeeId], { type: 'ATTENDANCE_CORRECTED', title: 'Attendance corrected', message: `Your attendance for ${rec.workDate} was corrected: ${body.reason}`, refType: 'attendance', refId: id }, conn);
    return repo.findById(id, conn);
  });
}

async function buildCorrection(current, body) {
  const cols = {};
  const inAt = body.checkInAt !== undefined ? (body.checkInAt ? new Date(body.checkInAt) : null) : current.checkInAt && new Date(current.checkInAt);
  const outAt = body.checkOutAt !== undefined ? (body.checkOutAt ? new Date(body.checkOutAt) : null) : current.checkOutAt && new Date(current.checkOutAt);
  if (outAt && !inAt) throw ApiError.unprocessable('Check-out requires a check-in', undefined, 'INVALID_ORDER');
  if (inAt && outAt && outAt < inAt) throw ApiError.unprocessable('Check-out cannot be before check-in', undefined, 'INVALID_ORDER');
  if (body.checkInAt !== undefined) cols.check_in_at = inAt ? toSqlUtc(inAt) : null;
  if (body.checkOutAt !== undefined) cols.check_out_at = outAt ? toSqlUtc(outAt) : null;
  if (inAt && outAt) cols.working_hours = hoursBetween(inAt, outAt); else if (body.checkInAt !== undefined || body.checkOutAt !== undefined) cols.working_hours = null;
  if (body.status) cols.status = body.status;
  else if (cols.working_hours != null) cols.status = statusForHours(cols.working_hours);
  if (body.workMode) cols.work_mode = body.workMode;
  if (body.remarks !== undefined) cols.remarks = body.remarks;
  return cols;
}

async function createManual(body, actor) {
  const emp = await empRepo.findBrief(body.employeeId);
  if (!emp) throw ApiError.notFound('Employee not found');
  const cols = await buildCorrection({}, body);
  const id = await withTransaction(async (conn) => {
    if (await repo.findByEmployeeDate(body.employeeId, body.workDate, conn)) throw ApiError.conflict('Attendance already exists for this employee and date', 'DUPLICATE_ATTENDANCE');
    const newId = await repo.insert({
      employeeId: body.employeeId, workDate: body.workDate, checkInAt: cols.check_in_at, checkOutAt: cols.check_out_at, workingHours: cols.working_hours,
      status: cols.status || 'PRESENT', workMode: cols.work_mode || 'OFFICE', remarks: cols.remarks,
    }, conn);
    await repo.update(newId, { corrected_by: actor.id, corrected_at: toSqlUtc(new Date()), correction_reason: body.reason }, conn);
    await notify.notifyEmployees([body.employeeId], { type: 'ATTENDANCE_CORRECTED', title: 'Attendance entry added', message: `HR added an attendance entry for ${body.workDate}: ${body.reason}`, refType: 'attendance', refId: newId }, conn);
    return newId;
  });
  return repo.findById(id);
}

async function summary(user, { employeeId, from, to }) {
  const today = localDate();
  const m = monthRange(+today.slice(0, 4), +today.slice(5, 7));
  let ids = await scope.visibleEmployeeIds(user);
  if (employeeId) { await scope.assertCanSee(user, employeeId); ids = [employeeId]; }
  return repo.summary({ employeeIds: ids, from: from || m.start, to: to || m.end });
}

async function monthlyReport(user, { year, month, departmentId }) {
  const { start, end } = monthRange(year, month);
  const ids = await scope.visibleEmployeeIds(user);
  return { year, month, from: start, to: end, rows: await repo.monthly(start, end, ids, departmentId) };
}

async function departmentReport({ from, to }) {
  const today = localDate();
  const m = monthRange(+today.slice(0, 4), +today.slice(5, 7));
  return { from: from || m.start, to: to || m.end, rows: await repo.byDepartment(from || m.start, to || m.end) };
}

module.exports = { checkIn, checkOut, getById, mine, listFor, correct, createManual, summary, monthlyReport, departmentReport, ADMINS };
