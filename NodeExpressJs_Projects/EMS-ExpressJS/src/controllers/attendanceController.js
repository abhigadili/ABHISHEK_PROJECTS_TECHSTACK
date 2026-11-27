const svc = require('../services/attendanceService');
const audit = require('../services/auditService');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created, paged } = require('../utils/response');
const { parsePagination } = require('../utils/pagination');
const { sendCsv } = require('../utils/csv');

const listHandler = (fn) => asyncHandler(async (req, res) => {
  const csv = req.query.format === 'csv';
  const paging = csv ? { noPaging: true } : parsePagination(req.query);
  const { items, total } = await fn(req, paging);
  if (csv) return sendCsv(res, 'attendance.csv', items.map((i) => ({ workDate: i.workDate, employeeCode: i.employeeCode, employeeName: i.employeeName, status: i.status, workMode: i.workMode, checkInAt: i.checkInAt, checkOutAt: i.checkOutAt, workingHours: i.workingHours, remarks: i.remarks })));
  return paged(res, { items, page: paging.page, limit: paging.limit, total }, 'Attendance retrieved successfully');
});

module.exports = {
  checkIn: asyncHandler(async (req, res) => created(res, await svc.checkIn(req.user, req.body), 'Checked in successfully')),
  checkOut: asyncHandler(async (req, res) => ok(res, await svc.checkOut(req.user, req.body), 'Checked out successfully')),
  get: asyncHandler(async (req, res) => ok(res, await svc.getById(req.params.id, req.user), 'Attendance retrieved successfully')),
  mine: listHandler((req, paging) => svc.mine(req.user, { from: req.query.from, to: req.query.to, status: req.query.status }, paging)),
  list: listHandler((req, paging) => svc.listFor(req.user, req.query, paging)),
  correct: asyncHandler(async (req, res) => {
    const data = await svc.correct(req.params.id, req.body, req.user);
    await audit.log(req, 'ATTENDANCE_CORRECT', 'attendance', req.params.id, { reason: req.body.reason });
    ok(res, data, 'Attendance corrected successfully');
  }),
  manual: asyncHandler(async (req, res) => {
    const data = await svc.createManual(req.body, req.user);
    await audit.log(req, 'ATTENDANCE_MANUAL', 'attendance', data.id, { reason: req.body.reason });
    created(res, data, 'Attendance entry created');
  }),
  summary: asyncHandler(async (req, res) => ok(res, await svc.summary(req.user, req.query), 'Attendance summary retrieved successfully')),
  monthly: asyncHandler(async (req, res) => {
    const r = await svc.monthlyReport(req.user, req.query);
    if (req.query.format === 'csv') return sendCsv(res, `attendance-${r.year}-${r.month}.csv`, r.rows);
    return ok(res, r, 'Monthly attendance report generated');
  }),
  department: asyncHandler(async (req, res) => {
    const r = await svc.departmentReport(req.query);
    if (req.query.format === 'csv') return sendCsv(res, 'attendance-by-department.csv', r.rows);
    return ok(res, r, 'Department attendance report generated');
  }),
};
