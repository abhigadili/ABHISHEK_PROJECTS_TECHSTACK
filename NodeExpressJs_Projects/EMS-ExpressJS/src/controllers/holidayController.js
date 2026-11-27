const svc = require('../services/holidayService');
const audit = require('../services/auditService');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');

module.exports = {
  list: asyncHandler(async (req, res) => ok(res, await svc.list(req.query), 'Holidays retrieved successfully')),
  create: asyncHandler(async (req, res) => { const d = await svc.create(req.body); await audit.log(req, 'HOLIDAY_CREATE', 'holiday', d.id); created(res, d, 'Holiday created'); }),
  update: asyncHandler(async (req, res) => ok(res, await svc.update(req.params.id, req.body), 'Holiday updated')),
  remove: asyncHandler(async (req, res) => { await svc.remove(req.params.id); await audit.log(req, 'HOLIDAY_DELETE', 'holiday', req.params.id); ok(res, null, 'Holiday deleted'); }),
  weeklyOffs: asyncHandler(async (req, res) => ok(res, await svc.weeklyOffs(), 'Weekly offs retrieved successfully')),
  setWeeklyOffs: asyncHandler(async (req, res) => {
    const d = await svc.setWeeklyOffs(req.body.location || 'ALL', req.body.days);
    await audit.log(req, 'WEEKLY_OFF_UPDATE', 'weekly_off', req.body.location || 'ALL', { days: req.body.days }); ok(res, d, 'Weekly offs updated');
  }),
  leaveCalendar: asyncHandler(async (req, res) => ok(res, await svc.leaveCalendar(req.user, req.query), 'Leave calendar retrieved successfully')),
  attendanceCalendar: asyncHandler(async (req, res) => ok(res, await svc.attendanceCalendar(req.user, req.query), 'Attendance calendar retrieved successfully')),
};
