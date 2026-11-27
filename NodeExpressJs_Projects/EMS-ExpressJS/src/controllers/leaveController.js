const svc = require('../services/leaveService');
const audit = require('../services/auditService');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created, paged } = require('../utils/response');
const { parsePagination } = require('../utils/pagination');

const pagedOf = (fn, label) => asyncHandler(async (req, res) => {
  const paging = parsePagination(req.query);
  const { items, total } = await fn(req, paging);
  paged(res, { items, page: paging.page, limit: paging.limit, total }, `${label} retrieved successfully`);
});

module.exports = {
  apply: asyncHandler(async (req, res) => created(res, await svc.apply(req.user, req.body), 'Leave request submitted')),
  approve: asyncHandler(async (req, res) => {
    const d = await svc.decide(req.params.id, req.user, { action: 'APPROVE', note: req.body.note });
    await audit.log(req, 'LEAVE_APPROVE', 'leave_request', req.params.id); ok(res, d, 'Leave request approved');
  }),
  reject: asyncHandler(async (req, res) => {
    const d = await svc.decide(req.params.id, req.user, { action: 'REJECT', note: req.body.note });
    await audit.log(req, 'LEAVE_REJECT', 'leave_request', req.params.id); ok(res, d, 'Leave request rejected');
  }),
  cancel: asyncHandler(async (req, res) => {
    const d = await svc.cancel(req.params.id, req.user, { note: req.body.note });
    await audit.log(req, 'LEAVE_CANCEL', 'leave_request', req.params.id); ok(res, d, 'Leave request cancelled');
  }),
  get: asyncHandler(async (req, res) => ok(res, await svc.getRequest(req.params.id, req.user), 'Leave request retrieved successfully')),
  list: pagedOf((req, p) => svc.listRequests(req.user, req.query, p), 'Leave requests'),
  mine: pagedOf((req, p) => svc.myRequests(req.user, req.query, p), 'Leave requests'),
  pending: pagedOf((req, p) => svc.pendingApprovals(req.user, p), 'Pending approvals'),
  team: asyncHandler(async (req, res) => ok(res, await svc.teamLeave(req.user, req.query), 'Team leave retrieved successfully')),
  myBalances: asyncHandler(async (req, res) => ok(res, await svc.balances(req.user, null, req.query.year), 'Leave balances retrieved successfully')),
  employeeBalances: asyncHandler(async (req, res) => ok(res, await svc.balances(req.user, req.params.id, req.query.year), 'Leave balances retrieved successfully')),
  myHistory: asyncHandler(async (req, res) => ok(res, await svc.history(req.user, null, req.query.year), 'Leave history retrieved successfully')),
  employeeHistory: asyncHandler(async (req, res) => ok(res, await svc.history(req.user, req.params.id, req.query.year), 'Leave history retrieved successfully')),
  adjust: asyncHandler(async (req, res) => {
    const d = await svc.adjustBalance(req.body, req.user);
    await audit.log(req, 'LEAVE_BALANCE_ADJUST', 'employee', req.body.employeeId, { leaveTypeId: req.body.leaveTypeId, amount: req.body.amount, note: req.body.note });
    ok(res, d, 'Leave balance adjusted');
  }),
  listTypes: asyncHandler(async (req, res) => ok(res, await svc.listTypes(!['HR_ADMIN', 'SUPER_ADMIN'].includes(req.user.role)), 'Leave types retrieved successfully')),
  createType: asyncHandler(async (req, res) => { const d = await svc.createType(req.body); await audit.log(req, 'LEAVE_TYPE_CREATE', 'leave_type', d.id); created(res, d, 'Leave type created'); }),
  updateType: asyncHandler(async (req, res) => { const d = await svc.updateType(req.params.id, req.body); await audit.log(req, 'LEAVE_TYPE_UPDATE', 'leave_type', req.params.id, req.body); ok(res, d, 'Leave type updated'); }),
  addDocument: asyncHandler(async (req, res) => created(res, await svc.addDocument(req.params.id, req.user, req.file), 'Document uploaded')),
  getDocument: asyncHandler(async (req, res) => {
    const d = await svc.getDocument(req.params.id, req.params.docId, req.user);
    res.setHeader('Content-Type', d.mime_type); res.setHeader('Content-Length', d.size_bytes);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(d.file_name)}"`); res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(d.data);
  }),
};
