const svc = require('../services/employeeService');
const audit = require('../services/auditService');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created, paged } = require('../utils/response');
const { parsePagination } = require('../utils/pagination');
const ApiError = require('../utils/ApiError');
const { ADMINS } = require('../constants');

const sendPicture = (res, pic) => {
  res.setHeader('Content-Type', pic.mime_type);
  res.setHeader('Content-Length', pic.size_bytes);
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(pic.data);
};

module.exports = {
  create: asyncHandler(async (req, res) => {
    const r = await svc.create(req.body, req.user);
    await audit.log(req, 'EMPLOYEE_CREATE', 'employee', r.id, { hasAccount: !!req.body.account });
    created(res, await svc.getById(r.id, req.user), 'Employee created successfully');
  }),
  list: asyncHandler(async (req, res) => {
    const paging = parsePagination(req.query);
    const { items, total } = await svc.list(req.query, paging, req.user);
    paged(res, { items, page: paging.page, limit: paging.limit, total }, 'Employees retrieved successfully');
  }),
  get: asyncHandler(async (req, res) => ok(res, await svc.getById(req.params.id, req.user), 'Employee retrieved successfully')),
  update: asyncHandler(async (req, res) => {
    const data = await svc.update(req.params.id, req.body, req.user);
    await audit.log(req, 'EMPLOYEE_UPDATE', 'employee', req.params.id, { fields: Object.keys(req.body) });
    ok(res, data, 'Employee updated successfully');
  }),
  deactivate: asyncHandler(async (req, res) => {
    const data = await svc.deactivate(req.params.id, req.body || {}, req.user);
    await audit.log(req, 'EMPLOYEE_DEACTIVATE', 'employee', req.params.id, { reason: (req.body || {}).reason });
    ok(res, data, 'Employee deactivated successfully');
  }),
  reactivate: asyncHandler(async (req, res) => {
    const data = await svc.reactivate(req.params.id, req.user);
    await audit.log(req, 'EMPLOYEE_REACTIVATE', 'employee', req.params.id);
    ok(res, data, 'Employee reactivated successfully');
  }),
  history: asyncHandler(async (req, res) => ok(res, await svc.history(req.params.id, req.user), 'Job history retrieved successfully')),
  addHistory: asyncHandler(async (req, res) => {
    const data = await svc.addHistory(req.params.id, req.body, req.user);
    await audit.log(req, 'JOB_HISTORY_ADD', 'employee', req.params.id, { changeType: req.body.changeType });
    created(res, data, 'Job history entry recorded');
  }),
  createAccount: asyncHandler(async (req, res) => {
    const data = await svc.createAccount(req.params.id, req.body, req.user);
    await audit.log(req, 'ACCOUNT_CREATE', 'employee', req.params.id, { role: req.body.role });
    created(res, data, 'Login account created');
  }),
  setRole: asyncHandler(async (req, res) => {
    const data = await svc.setRole(req.params.id, req.body.role, req.user);
    await audit.log(req, 'ROLE_CHANGE', 'employee', req.params.id, { role: req.body.role });
    ok(res, data, 'Role updated');
  }),
  getPicture: asyncHandler(async (req, res) => sendPicture(res, await svc.getPicture(req.params.id, req.user))),
  putPicture: asyncHandler(async (req, res) => ok(res, await svc.putPicture(req.params.id, req.file), 'Profile picture saved')),
  deletePicture: asyncHandler(async (req, res) => { await svc.removePicture(req.params.id); ok(res, null, 'Profile picture removed'); }),

  // profile (self)
  profile: asyncHandler(async (req, res) => ok(res, await svc.profile(req.user), 'Profile retrieved successfully')),
  updateProfile: asyncHandler(async (req, res) => ok(res, await svc.updateProfile(req.user, req.body), 'Profile updated successfully')),
  myPicture: asyncHandler(async (req, res) => {
    if (!req.user.employeeId) throw ApiError.notFound('No linked employee');
    sendPicture(res, await svc.getPicture(req.user.employeeId, req.user));
  }),
  putMyPicture: asyncHandler(async (req, res) => {
    if (!req.user.employeeId) throw ApiError.notFound('No linked employee');
    ok(res, await svc.putPicture(req.user.employeeId, req.file), 'Profile picture saved');
  }),
  deleteMyPicture: asyncHandler(async (req, res) => {
    if (!req.user.employeeId) throw ApiError.notFound('No linked employee');
    await svc.removePicture(req.user.employeeId);
    ok(res, null, 'Profile picture removed');
  }),
  ADMINS,
};
