const svc = require('../services/referenceService');
const audit = require('../services/auditService');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created, paged } = require('../utils/response');
const { parsePagination } = require('../utils/pagination');

const listOf = (fn, label) => asyncHandler(async (req, res) => {
  const p = parsePagination(req.query);
  const { items, total } = await fn({ ...req.query, limit: p.limit, offset: p.offset });
  paged(res, { items, page: p.page, limit: p.limit, total }, `${label} retrieved successfully`);
});

module.exports = {
  listDepartments: listOf(svc.listDepartments, 'Departments'),
  getDepartment: asyncHandler(async (req, res) => ok(res, await svc.getDepartment(req.params.id), 'Department retrieved successfully')),
  createDepartment: asyncHandler(async (req, res) => {
    const d = await svc.createDepartment(req.body); await audit.log(req, 'DEPARTMENT_CREATE', 'department', d.id); created(res, d, 'Department created successfully');
  }),
  updateDepartment: asyncHandler(async (req, res) => {
    const d = await svc.updateDepartment(req.params.id, req.body); await audit.log(req, 'DEPARTMENT_UPDATE', 'department', d.id, { fields: Object.keys(req.body) }); ok(res, d, 'Department updated successfully');
  }),
  deactivateDepartment: asyncHandler(async (req, res) => {
    const d = await svc.setDepartmentActive(req.params.id, false); await audit.log(req, 'DEPARTMENT_DEACTIVATE', 'department', d.id); ok(res, d, 'Department deactivated');
  }),
  activateDepartment: asyncHandler(async (req, res) => ok(res, await svc.setDepartmentActive(req.params.id, true), 'Department activated')),

  listTeams: listOf(svc.listTeams, 'Teams'),
  getTeam: asyncHandler(async (req, res) => ok(res, await svc.getTeam(req.params.id), 'Team retrieved successfully')),
  createTeam: asyncHandler(async (req, res) => created(res, await svc.createTeam(req.body), 'Team created successfully')),
  updateTeam: asyncHandler(async (req, res) => ok(res, await svc.updateTeam(req.params.id, req.body), 'Team updated successfully')),
  assignMembers: asyncHandler(async (req, res) => ok(res, await svc.assignMembers(req.params.id, req.body.employeeIds), 'Team members assigned')),

  listDesignations: listOf(svc.listDesignations, 'Designations'),
  getDesignation: asyncHandler(async (req, res) => ok(res, await svc.getDesignation(req.params.id), 'Designation retrieved successfully')),
  createDesignation: asyncHandler(async (req, res) => created(res, await svc.createDesignation(req.body), 'Designation created successfully')),
  updateDesignation: asyncHandler(async (req, res) => ok(res, await svc.updateDesignation(req.params.id, req.body), 'Designation updated successfully')),
};
