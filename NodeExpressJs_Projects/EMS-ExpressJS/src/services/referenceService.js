const repo = require('../repositories/referenceRepository');
const empRepo = require('../repositories/employeeRepository');
const { withTransaction } = require('../config/database');
const ApiError = require('../utils/ApiError');

const must = (v, what) => { if (!v) throw ApiError.notFound(`${what} not found`); return v; };
const map = (b, m) => Object.fromEntries(Object.entries(m).filter(([k]) => b[k] !== undefined).map(([k, c]) => [c, b[k]]));

async function validateHead(employeeId, departmentId) {
  if (!employeeId) return;
  const e = await empRepo.findById(employeeId);
  if (!e || e.status !== 'ACTIVE') throw ApiError.unprocessable('Head must be an active employee', undefined, 'INVALID_HEAD');
  if (departmentId && e.department_id !== departmentId) {
    throw ApiError.unprocessable('Head must belong to this department', undefined, 'INVALID_HEAD');
  }
}

// departments
const listDepartments = (f) => repo.listDepartments(f);
const getDepartment = async (id) => must(await repo.getDepartmentDetail(id), 'Department');
async function createDepartment(b) {
  await validateHead(b.headEmployeeId);
  return getDepartment(await repo.insertDepartment(b));
}
async function updateDepartment(id, b) {
  must(await repo.getDepartment(id), 'Department');
  if (b.headEmployeeId !== undefined) await validateHead(b.headEmployeeId, id);
  await repo.updateDepartment(id, map(b, { code: 'code', name: 'name', description: 'description', headEmployeeId: 'head_employee_id' }));
  return getDepartment(id);
}
async function setDepartmentActive(id, active) {
  must(await repo.getDepartment(id), 'Department');
  if (!active && (await repo.deptActiveEmployees(id))) throw ApiError.conflict('Department still has active employees; transfer them first', 'DEPARTMENT_NOT_EMPTY');
  await repo.updateDepartment(id, { is_active: active ? 1 : 0, ...(active ? {} : { head_employee_id: null }) });
  return getDepartment(id);
}

// teams
const listTeams = (f) => repo.listTeams(f);
const getTeam = async (id) => { const t = must(await repo.getTeamDetail(id), 'Team'); return { ...t, members: await repo.teamMembers(id) }; };
async function createTeam(b) {
  const d = await repo.getDepartment(b.departmentId);
  if (!d || !d.is_active) throw ApiError.unprocessable('Department does not exist or is inactive', undefined, 'INVALID_DEPARTMENT');
  return getTeam(await repo.insertTeam(b));
}
async function updateTeam(id, b) {
  must(await repo.getTeam(id), 'Team');
  await repo.updateTeam(id, map(b, { name: 'name', description: 'description', leadEmployeeId: 'lead_employee_id', isActive: 'is_active' }));
  return getTeam(id);
}
async function assignMembers(teamId, employeeIds) {
  const team = must(await repo.getTeam(teamId), 'Team');
  if (!team.is_active) throw ApiError.unprocessable('Team is inactive', undefined, 'INVALID_TEAM');
  await withTransaction(async (conn) => {
    const emps = await repo.employeesDepartment(employeeIds, conn);
    if (emps.length !== new Set(employeeIds).size) throw ApiError.unprocessable('One or more employees do not exist', undefined, 'INVALID_EMPLOYEE');
    if (emps.some((e) => e.department_id !== team.department_id)) throw ApiError.unprocessable('Employees must belong to the team\'s department', undefined, 'TEAM_DEPARTMENT_MISMATCH');
    await repo.assignToTeam(teamId, employeeIds, conn);
  });
  return getTeam(teamId);
}

// designations
const listDesignations = (f) => repo.listDesignations(f);
const getDesignation = async (id) => must(await repo.getDesignationDetail(id), 'Designation');
const createDesignation = async (b) => getDesignation(await repo.insertDesignation(b));
async function updateDesignation(id, b) {
  must(await repo.getDesignation(id), 'Designation');
  await repo.updateDesignation(id, map(b, { name: 'name', description: 'description', jobLevel: 'job_level', isActive: 'is_active' }));
  return getDesignation(id);
}

module.exports = {
  listDepartments, getDepartment, createDepartment, updateDepartment, setDepartmentActive,
  listTeams, getTeam, createTeam, updateTeam, assignMembers,
  listDesignations, getDesignation, createDesignation, updateDesignation,
};
