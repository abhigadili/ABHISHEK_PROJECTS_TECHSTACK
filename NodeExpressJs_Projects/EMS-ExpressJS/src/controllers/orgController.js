const svc = require('../services/orgService');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');

module.exports = {
  full: asyncHandler(async (req, res) => ok(res, await svc.hierarchy({ depth: req.query.depth, departmentId: req.query.departmentId }), 'Organization hierarchy retrieved successfully')),
  subtree: asyncHandler(async (req, res) => ok(res, await svc.hierarchy({ rootId: req.params.id, depth: req.query.depth }), 'Hierarchy retrieved successfully')),
  reports: asyncHandler(async (req, res) => ok(res, await svc.directReports(req.params.id), 'Direct reports retrieved successfully')),
  chain: asyncHandler(async (req, res) => ok(res, await svc.reportingChain(req.params.id), 'Reporting chain retrieved successfully')),
  search: asyncHandler(async (req, res) => ok(res, await svc.search(req.query.q, { rootId: req.query.rootId }), 'Search completed')),
};
