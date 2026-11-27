const svc = require('../services/reportService');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');
const { sendCsv } = require('../utils/csv');

const report = (fn, name, label, rowsOf = (r) => r.rows) => asyncHandler(async (req, res) => {
  const data = await fn(req.user, req.query);
  if (req.query.format === 'csv') return sendCsv(res, `${name}.csv`, rowsOf(data));
  return ok(res, data, `${label} generated successfully`);
});

module.exports = {
  dashboard: asyncHandler(async (req, res) => ok(res, await svc.dashboard(req.user), 'Dashboard retrieved successfully')),
  upcoming: asyncHandler(async (req, res) => ok(res, await svc.upcoming(req.user, req.query.days || 30), 'Upcoming events retrieved successfully')),
  joinersExits: report(svc.joinersExits, 'joiners-exits', 'Joining/exit report', (r) => [...r.joiners.map((x) => ({ type: 'JOINER', ...x })), ...r.exits.map((x) => ({ type: 'EXIT', ...x }))]),
  leaveBalances: report(svc.leaveBalances, 'leave-balances', 'Leave balance report'),
  leaveSummary: report(svc.leaveSummary, 'leave-summary', 'Leave summary report'),
  departments: asyncHandler(async (req, res) => { const d = await svc.departments(); return req.query.format === 'csv' ? sendCsv(res, 'departments.csv', d) : ok(res, d, 'Department report generated successfully'); }),
  designations: asyncHandler(async (req, res) => { const d = await svc.designations(); return req.query.format === 'csv' ? sendCsv(res, 'designations.csv', d) : ok(res, d, 'Designation report generated successfully'); }),
};
