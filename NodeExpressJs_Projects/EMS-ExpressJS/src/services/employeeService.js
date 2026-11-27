const { withTransaction, query } = require('../config/database');
const repo = require('../repositories/employeeRepository');
const orgRepo = require('../repositories/orgRepository');
const refRepo = require('../repositories/referenceRepository');
const userRepo = require('../repositories/userRepository');
const tokenRepo = require('../repositories/authTokenRepository');
const notify = require('./notificationService');
const pw = require('../utils/password');
const ApiError = require('../utils/ApiError');
const { toEmployee } = require('../models/employeeMapper');
const { parseSort } = require('../utils/pagination');
const { localDate } = require('../utils/dates');
const { ROLES, ROLE_IDS, ADMINS } = require('../constants');

// camelCase API field -> column. Anything not listed here can never be written (mass-assignment guard).
const WRITABLE = {
  firstName: 'first_name', middleName: 'middle_name', lastName: 'last_name', workEmail: 'work_email', personalEmail: 'personal_email',
  phone: 'phone', dateOfBirth: 'date_of_birth', addressLine: 'address_line', city: 'city', state: 'state', country: 'country',
  postalCode: 'postal_code', emergencyContactName: 'emergency_contact_name', emergencyContactPhone: 'emergency_contact_phone',
  emergencyContactRelation: 'emergency_contact_relation', joiningDate: 'joining_date', probationEndDate: 'probation_end_date',
  employmentType: 'employment_type', designationId: 'designation_id', jobTitle: 'job_title', departmentId: 'department_id',
  teamId: 'team_id', managerId: 'manager_id', workLocation: 'work_location', salary: 'salary', salaryCurrency: 'salary_currency',
  bonusTarget: 'bonus_target',
};
const SELF_EDITABLE = ['personalEmail', 'phone', 'addressLine', 'city', 'state', 'country', 'postalCode', 'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelation'];
const pick = (src, keys) => Object.fromEntries(keys.filter((k) => src[k] !== undefined).map((k) => [WRITABLE[k], src[k] === '' ? null : src[k]]));
const lowerEmails = (b) => { ['workEmail', 'personalEmail'].forEach((k) => { if (typeof b[k] === 'string') b[k] = b[k].toLowerCase(); }); return b; };

/** Admin, the employee themself, or anyone up the employee's management chain. */
async function canViewDetail(user, employeeId) {
  if (ADMINS.includes(user.role) || user.employeeId === employeeId) return true;
  if (user.role === ROLES.MANAGER && user.employeeId) return (await orgRepo.ancestorIds(employeeId)).includes(user.employeeId);
  return false;
}

async function validateRelations(next, current, conn) {
  if (next.department_id) {
    const d = await refRepo.getDepartment(next.department_id, conn);
    if (!d || !d.is_active) throw ApiError.unprocessable('Department does not exist or is inactive', undefined, 'INVALID_DEPARTMENT');
  }
  if (next.designation_id) {
    const d = await refRepo.getDesignation(next.designation_id, conn);
    if (!d || !d.is_active) throw ApiError.unprocessable('Designation does not exist or is inactive', undefined, 'INVALID_DESIGNATION');
  }
  if (next.team_id) {
    const t = await refRepo.getTeam(next.team_id, conn);
    if (!t || !t.is_active) throw ApiError.unprocessable('Team does not exist or is inactive', undefined, 'INVALID_TEAM');
    const dept = next.department_id !== undefined ? next.department_id : current && current.department_id;
    if (t.department_id !== dept) throw ApiError.unprocessable('Team does not belong to the employee\'s department', undefined, 'TEAM_DEPARTMENT_MISMATCH');
  }
  if (next.manager_id) {
    const m = await repo.findById(next.manager_id, conn);
    if (!m || m.status !== 'ACTIVE') throw ApiError.unprocessable('Manager does not exist or is not active', undefined, 'INVALID_MANAGER');
    if (current) {
      if (m.id === current.id) throw ApiError.unprocessable('An employee cannot report to themself', undefined, 'SELF_REPORTING');
      if ((await orgRepo.ancestorIds(m.id, conn)).includes(current.id)) {
        throw ApiError.unprocessable('Circular reporting relationship detected', undefined, 'CIRCULAR_REPORTING');
      }
    }
  }
}

async function ensureEmailFree(email, exceptId) {
  if (email && await repo.emailTaken(email, exceptId)) throw ApiError.conflict('Work email already in use', 'DUPLICATE_EMAIL');
}

async function create(body, actor) {
  lowerEmails(body);
  const cols = pick(body, Object.keys(WRITABLE));
  await ensureEmailFree(cols.work_email);
  const account = body.account;
  if (account && account.role === ROLES.SUPER_ADMIN && actor.role !== ROLES.SUPER_ADMIN) throw ApiError.forbidden('Only a SUPER_ADMIN can create SUPER_ADMIN accounts');
  const passwordHash = account ? await pw.hash(account.password) : null;

  const id = await withTransaction(async (conn) => {
    await validateRelations(cols, null, conn);
    cols.employee_code = body.employeeCode || (await repo.nextCode(conn));
    const empId = await repo.insert(cols, conn);
    await repo.insertHistory({
      employeeId: empId, changeType: 'JOINED', effectiveDate: cols.joining_date, toDesignationId: cols.designation_id,
      toDepartmentId: cols.department_id, toManagerId: cols.manager_id, toJobTitle: cols.job_title, notes: 'Employee created', createdBy: actor.id,
    }, conn);
    if (account) await userRepo.create({ employeeId: empId, email: cols.work_email, passwordHash, roleId: ROLE_IDS[account.role] }, conn);
    await notify.notifyEmployees([cols.manager_id], { type: 'ONBOARDING', title: 'New team member', message: `${cols.first_name} ${cols.last_name} has joined your team`, refType: 'employee', refId: empId }, conn);
    await notify.notifyEmployees([empId], { type: 'ONBOARDING', title: 'Welcome', message: 'Your employee profile has been created', refType: 'employee', refId: empId }, conn);
    return empId;
  });
  return { id };
}

async function getById(id, viewer) {
  const row = await repo.findById(id);
  if (!row) throw ApiError.notFound('Employee not found');
  return toEmployee(row, viewer);
}

async function list(filters, paging, viewer) {
  const orderBy = parseSort(filters, repo.SORTABLE, 'e.last_name, e.first_name');
  const f = { ...filters, status: filters.status || 'ACTIVE' };
  if (!ADMINS.includes(viewer.role) && f.status !== 'ACTIVE') f.status = 'ACTIVE'; // inactive staff are HR-only
  const { rows, total } = await repo.search(f, { orderBy, limit: paging.limit, offset: paging.offset });
  return { items: rows.map((r) => toEmployee(r, viewer)), total };
}

const CHANGE_FIELDS = { department_id: 'TRANSFER', manager_id: 'MANAGER_CHANGE', designation_id: 'JOB_CHANGE', job_title: 'JOB_CHANGE' };

async function update(id, body, actor) {
  lowerEmails(body);
  const cols = pick(body, Object.keys(WRITABLE));
  if (cols.work_email) await ensureEmailFree(cols.work_email, id);
  await withTransaction(async (conn) => {
    const cur = await repo.lockById(id, conn);
    if (!cur) throw ApiError.notFound('Employee not found');
    if (cols.department_id !== undefined && cols.department_id !== cur.department_id && cols.team_id === undefined) cols.team_id = null;
    await validateRelations(cols, cur, conn);

    const changed = Object.keys(cols).filter((k) => String(cols[k] ?? '') !== String(cur[k] ?? ''));
    if (!changed.length) return false;
    await repo.update(id, cols, conn);

    const jobFields = changed.filter((k) => CHANGE_FIELDS[k]);
    if (jobFields.length) {
      const type = body.changeType || (jobFields.includes('department_id') ? 'TRANSFER' : CHANGE_FIELDS[jobFields[0]]);
      await repo.insertHistory({
        employeeId: id, changeType: type, effectiveDate: body.effectiveDate || localDate(),
        fromDesignationId: cur.designation_id, toDesignationId: cols.designation_id ?? cur.designation_id,
        fromDepartmentId: cur.department_id, toDepartmentId: cols.department_id ?? cur.department_id,
        fromManagerId: cur.manager_id, toManagerId: cols.manager_id !== undefined ? cols.manager_id : cur.manager_id,
        fromJobTitle: cur.job_title, toJobTitle: cols.job_title !== undefined ? cols.job_title : cur.job_title,
        notes: body.notes, createdBy: actor.id,
      }, conn);
      if (changed.includes('manager_id') || changed.includes('department_id')) {
        await notify.notifyEmployees([id, cols.manager_id].filter(Boolean), {
          type: 'ORG_CHANGE', title: 'Reporting line or department changed',
          message: `${cur.first_name} ${cur.last_name}: manager/department assignment was updated`, refType: 'employee', refId: id,
        }, conn);
      }
    }
    if (cols.work_email) await userRepo.updateEmailByEmployee(id, cols.work_email, conn);
    return true;
  });
  return getById(id, actor); // read after commit
}

async function deactivate(id, { reason, exitDate, reassignReportsTo }, actor) {
  return withTransaction(async (conn) => {
    const cur = await repo.lockById(id, conn);
    if (!cur) throw ApiError.notFound('Employee not found');
    if (cur.status !== 'ACTIVE') throw ApiError.conflict('Employee is already inactive', 'ALREADY_INACTIVE');
    if (actor.employeeId === id) throw ApiError.unprocessable('You cannot deactivate your own record', undefined, 'SELF_DEACTIVATION');
    const reports = await repo.countActiveReports(id, conn);
    if (reports) {
      if (!reassignReportsTo) throw ApiError.conflict(`Employee has ${reports} active direct report(s); supply reassignReportsTo`, 'HAS_ACTIVE_REPORTS');
      if (reassignReportsTo === id) throw ApiError.unprocessable('Cannot reassign reports to the same employee', undefined, 'INVALID_MANAGER');
      const target = await repo.findById(reassignReportsTo, conn);
      if (!target || target.status !== 'ACTIVE') throw ApiError.unprocessable('Reassignment target must be an active employee', undefined, 'INVALID_MANAGER');
      if ((await orgRepo.ancestorIds(reassignReportsTo, conn)).includes(id)) {
        // Target sits below the leaver: reparent target to the leaver's manager first to avoid a cycle.
        await repo.update(reassignReportsTo, { manager_id: cur.manager_id }, conn);
      }
      await repo.reassignReports(id, reassignReportsTo, conn);
    }
    await repo.update(id, { status: 'INACTIVE', exit_date: exitDate || localDate() }, conn);
    await repo.insertHistory({ employeeId: id, changeType: 'STATUS_CHANGE', effectiveDate: exitDate || localDate(), notes: reason || 'Deactivated', createdBy: actor.id }, conn);
    await userRepo.setActiveByEmployee(id, false, conn);
    const u = await userRepo.findByEmployeeId(id, conn);
    if (u) await tokenRepo.revokeAllForUser(u.id, conn);
    await query('UPDATE departments SET head_employee_id = NULL WHERE head_employee_id = ?', [id], conn);
    return { id, status: 'INACTIVE' };
  });
}

async function reactivate(id, actor) {
  return withTransaction(async (conn) => {
    const cur = await repo.lockById(id, conn);
    if (!cur) throw ApiError.notFound('Employee not found');
    if (cur.status === 'ACTIVE') throw ApiError.conflict('Employee is already active', 'ALREADY_ACTIVE');
    let managerId = cur.manager_id;
    if (managerId) { const m = await repo.findById(managerId, conn); if (!m || m.status !== 'ACTIVE') managerId = null; }
    await repo.update(id, { status: 'ACTIVE', exit_date: null, manager_id: managerId }, conn);
    await repo.insertHistory({ employeeId: id, changeType: 'STATUS_CHANGE', effectiveDate: localDate(), notes: 'Reactivated', createdBy: actor.id }, conn);
    await userRepo.setActiveByEmployee(id, true, conn);
    return { id, status: 'ACTIVE' };
  });
}

async function history(id, viewer) {
  if (!(await repo.findBrief(id))) throw ApiError.notFound('Employee not found');
  if (!(await canViewDetail(viewer, id))) throw ApiError.forbidden();
  return repo.listHistory(id);
}

async function addHistory(id, body, actor) {
  if (!(await repo.findBrief(id))) throw ApiError.notFound('Employee not found');
  await repo.insertHistory({ employeeId: id, changeType: body.changeType, effectiveDate: body.effectiveDate, notes: body.notes, createdBy: actor.id });
  return repo.listHistory(id);
}

/** Assign or change the login role of an employee's account (SUPER_ADMIN only at route level). */
async function setRole(id, role, actor) {
  const u = await userRepo.findByEmployeeId(id);
  if (!u) throw ApiError.notFound('Employee has no login account');
  if (u.id === actor.id) throw ApiError.unprocessable('You cannot change your own role', undefined, 'SELF_ROLE_CHANGE');
  await userRepo.updateRole(u.id, ROLE_IDS[role]);
  return { employeeId: id, role };
}
async function createAccount(id, { role, password }, actor) {
  const emp = await repo.findById(id);
  if (!emp) throw ApiError.notFound('Employee not found');
  if (await userRepo.findByEmployeeId(id)) throw ApiError.conflict('Employee already has a login account', 'ACCOUNT_EXISTS');
  if (role === ROLES.SUPER_ADMIN && actor.role !== ROLES.SUPER_ADMIN) throw ApiError.forbidden('Only a SUPER_ADMIN can create SUPER_ADMIN accounts');
  const userId = await userRepo.create({ employeeId: id, email: emp.work_email, passwordHash: await pw.hash(password), roleId: ROLE_IDS[role] });
  return { userId, employeeId: id, role };
}

// ---- profile (self-service) ----
async function profile(user) {
  if (!user.employeeId) throw ApiError.notFound('Your account is not linked to an employee record');
  return getById(user.employeeId, user);
}
async function updateProfile(user, body) {
  if (!user.employeeId) throw ApiError.notFound('Your account is not linked to an employee record');
  lowerEmails(body);
  const cols = pick(body, SELF_EDITABLE); // strict allow-list: role/salary/manager/etc. can never be self-set
  await repo.update(user.employeeId, cols);
  return getById(user.employeeId, user);
}

// ---- pictures ----
async function putPicture(employeeId, file) {
  if (!(await repo.findBrief(employeeId))) throw ApiError.notFound('Employee not found');
  await repo.savePicture(employeeId, file.detectedType, file.buffer);
  return { profilePictureUrl: `/api/v1/employees/${employeeId}/picture`, mimeType: file.detectedType, sizeBytes: file.size };
}
async function getPicture(employeeId, viewer) {
  const emp = await repo.findBrief(employeeId);
  if (!emp) throw ApiError.notFound('Employee not found');
  if (emp.status !== 'ACTIVE' && !ADMINS.includes(viewer.role) && viewer.employeeId !== employeeId) throw ApiError.forbidden();
  const pic = await repo.getPicture(employeeId);
  if (!pic) throw ApiError.notFound('No profile picture');
  return pic;
}
async function removePicture(employeeId) {
  if (!(await repo.deletePicture(employeeId))) throw ApiError.notFound('No profile picture');
}

module.exports = {
  create, getById, list, update, deactivate, reactivate, history, addHistory, setRole, createAccount, profile, updateProfile,
  putPicture, getPicture, removePicture, canViewDetail, ADMINS,
};
