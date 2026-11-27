const { withTransaction } = require('../config/database');
const repo = require('../repositories/leaveRepository');
const holidayRepo = require('../repositories/holidayRepository');
const empRepo = require('../repositories/employeeRepository');
const notify = require('./notificationService');
const scope = require('./accessScope');
const ApiError = require('../utils/ApiError');
const { localDate, toSqlUtc, eachDate, dayOfWeek, addDays, diffDays } = require('../utils/dates');
const { ADMINS, ROLES } = require('../constants');

/**
 * Days charged for a request.
 *  - weekly-off days and (non-optional) holidays inside the range are NOT counted
 *  - a half-day request must be a single working day and counts 0.5
 *  - the number is the same for paid and unpaid leave; unpaid leave simply has no balance to deduct from
 */
async function computeDays({ startDate, endDate, dayPart, location }, conn) {
  const offs = new Set(await holidayRepo.effectiveWeeklyOffDays(location, conn));
  const holidays = await holidayRepo.holidayDates(startDate, endDate, location, conn);
  const working = eachDate(startDate, endDate).filter((d) => !offs.has(dayOfWeek(d)) && !holidays.has(d));
  if (!working.length) throw ApiError.unprocessable('The selected dates contain no working days (weekly offs/holidays only)', undefined, 'NO_WORKING_DAYS');
  if (dayPart !== 'FULL_DAY') return { days: 0.5, workingDates: working };
  return { days: working.length, workingDates: working };
}

const conflicts = (existing, candidate) => existing.some((e) => {
  const bothHalfSingle = e.start_date === e.end_date && candidate.startDate === candidate.endDate
    && e.day_part !== 'FULL_DAY' && candidate.dayPart !== 'FULL_DAY' && e.day_part !== candidate.dayPart;
  return !bothHalfSingle;
});

async function apply(user, body) {
  const employeeId = scope.requireEmployee(user);
  const { leaveTypeId, startDate, endDate, reason } = body;
  const dayPart = body.dayPart || 'FULL_DAY';
  if (endDate < startDate) throw ApiError.unprocessable('endDate cannot be before startDate', undefined, 'INVALID_DATES');
  if (dayPart !== 'FULL_DAY' && startDate !== endDate) throw ApiError.unprocessable('A half-day leave must be a single day', undefined, 'INVALID_HALF_DAY');
  if (startDate.slice(0, 4) !== endDate.slice(0, 4)) throw ApiError.unprocessable('Leave cannot span two calendar years; submit separate requests', undefined, 'CROSS_YEAR');
  if (diffDays(localDate(), startDate) < -30) throw ApiError.unprocessable('Leave cannot be back-dated more than 30 days', undefined, 'INVALID_DATES');

  const id = await withTransaction(async (conn) => {
    const emp = await empRepo.lockById(employeeId, conn); // serialises this employee's concurrent applications
    if (!emp || emp.status !== 'ACTIVE') throw ApiError.forbidden('Only active employees can apply for leave');
    const type = await repo.getType(leaveTypeId, conn);
    if (!type || !type.isActive) throw ApiError.unprocessable('Leave type does not exist or is inactive', undefined, 'INVALID_LEAVE_TYPE');
    if (dayPart !== 'FULL_DAY' && type.policy && !type.policy.allowHalfDay) throw ApiError.unprocessable('Half-day is not allowed for this leave type', undefined, 'HALF_DAY_NOT_ALLOWED');

    const { days } = await computeDays({ startDate, endDate, dayPart, location: emp.work_location }, conn);
    if (type.policy && type.policy.maxConsecutiveDays && days > type.policy.maxConsecutiveDays) {
      throw ApiError.unprocessable(`This leave type allows at most ${type.policy.maxConsecutiveDays} consecutive days`, undefined, 'MAX_CONSECUTIVE_EXCEEDED');
    }
    if (conflicts(await repo.overlapping(employeeId, startDate, endDate, conn), { startDate, endDate, dayPart })) {
      throw ApiError.conflict('You already have a pending or approved leave overlapping these dates', 'OVERLAPPING_LEAVE');
    }
    if (type.policy) {
      const year = +startDate.slice(0, 4);
      await repo.ensureBalances(employeeId, year, conn);
      const bal = await repo.lockBalance(employeeId, leaveTypeId, year, conn);
      const available = Number(bal.entitled) + Number(bal.adjusted) - Number(bal.used) - (await repo.pendingDays(employeeId, leaveTypeId, year, conn));
      if (days > available) throw ApiError.unprocessable(`Insufficient ${type.name} balance: ${available} day(s) available, ${days} requested`, { available, requested: days }, 'INSUFFICIENT_BALANCE');
    }
    const reqId = await repo.insertRequest({ employeeId, leaveTypeId, startDate, endDate, dayPart, days, reason }, conn);
    const note = leaveNote(emp, reqId, 'LEAVE_APPLIED', 'New leave request', `${emp.first_name} ${emp.last_name} requested ${days} day(s) of ${type.name} (${startDate} to ${endDate})`);
    if (emp.manager_id) await notify.notifyEmployees([emp.manager_id], note, conn);
    else await notify.notifyRoles([ROLES.HR_ADMIN], note, conn);
    return reqId;
  });
  return repo.findById(id);
}
const leaveNote = (emp, id, type, title, message) => ({ type, title, message, refType: 'leave_request', refId: id });

/** Approver must be HR/SUPER_ADMIN, or the requester's direct manager holding a MANAGER+ role. Nobody decides their own request. */
function assertCanDecide(user, reqRow) {
  if (reqRow.employee_id === user.employeeId) throw ApiError.forbidden('You cannot approve or reject your own leave request');
  if (ADMINS.includes(user.role)) return;
  if (user.role === ROLES.MANAGER && user.employeeId && reqRow.employee_manager_id === user.employeeId) return;
  throw ApiError.forbidden('Only the employee\'s manager or HR can decide this request');
}

async function decide(id, user, { action, note }) {
  await withTransaction(async (conn) => {
    const r = await repo.findRaw(id, conn);
    if (!r) throw ApiError.notFound('Leave request not found');
    assertCanDecide(user, r);
    if (r.status !== 'PENDING') throw ApiError.conflict(`Leave request is already ${r.status.toLowerCase()}`, 'ALREADY_PROCESSED');

    if (action === 'APPROVE') {
      const type = await repo.getType(r.leave_type_id, conn);
      if (type.requiresDocument && !(await repo.documentCount(id, conn))) throw ApiError.unprocessable('A supporting document is required before approval', undefined, 'DOCUMENT_REQUIRED');
      const days = Number(r.days);
      if (type.policy) {
        const year = +r.start_date.slice(0, 4);
        await repo.ensureBalances(r.employee_id, year, conn);
        const bal = await repo.lockBalance(r.employee_id, r.leave_type_id, year, conn);
        if (Number(bal.entitled) + Number(bal.adjusted) - Number(bal.used) < days) throw ApiError.unprocessable('Insufficient leave balance', undefined, 'INSUFFICIENT_BALANCE');
        // Unique (request,type) in the ledger makes a duplicate deduction impossible even if status checks were bypassed.
        await repo.insertTx({ balanceId: bal.id, requestId: id, type: 'DEDUCTION', amount: -days, note: `Approved leave #${id}`, createdBy: user.id }, conn);
        await repo.applyBalanceDelta(bal.id, { usedDelta: days }, conn);
      }
      if (r.day_part === 'FULL_DAY') {
        const { workingDates } = await computeDays({ startDate: r.start_date, endDate: r.end_date, dayPart: 'FULL_DAY', location: r.work_location }, conn);
        await repo.markOnLeave(r.employee_id, workingDates, conn);
      }
    }
    await repo.setStatus(id, { status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED', decided_by: user.employeeId, decided_at: toSqlUtc(new Date()), decision_note: note || null }, conn);
    await notify.notifyEmployees([r.employee_id], {
      type: action === 'APPROVE' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED', title: `Leave ${action === 'APPROVE' ? 'approved' : 'rejected'}`,
      message: `Your ${r.type_name} request (${r.start_date} to ${r.end_date}) was ${action === 'APPROVE' ? 'approved' : 'rejected'}${note ? `: ${note}` : ''}`, refType: 'leave_request', refId: id,
    }, conn);
  });
  return repo.findById(id);
}

async function cancel(id, user, { note } = {}) {
  await withTransaction(async (conn) => {
    const r = await repo.findRaw(id, conn);
    if (!r) throw ApiError.notFound('Leave request not found');
    const own = r.employee_id === user.employeeId;
    if (!own && !ADMINS.includes(user.role)) throw ApiError.forbidden('Only the requester or HR can cancel a leave request');
    if (!['PENDING', 'APPROVED'].includes(r.status)) throw ApiError.conflict(`A ${r.status.toLowerCase()} request cannot be cancelled`, 'ALREADY_PROCESSED');
    if (r.status === 'APPROVED') {
      if (!ADMINS.includes(user.role) && r.start_date < localDate()) throw ApiError.unprocessable('Approved leave that has already started can only be cancelled by HR', undefined, 'LEAVE_STARTED');
      const type = await repo.getType(r.leave_type_id, conn);
      if (type.policy) {
        const bal = await repo.lockBalance(r.employee_id, r.leave_type_id, +r.start_date.slice(0, 4), conn);
        await repo.insertTx({ balanceId: bal.id, requestId: id, type: 'REFUND', amount: Number(r.days), note: `Cancelled leave #${id}`, createdBy: user.id }, conn);
        await repo.applyBalanceDelta(bal.id, { usedDelta: -Number(r.days) }, conn);
      }
      await repo.clearOnLeave(r.employee_id, r.start_date, r.end_date, conn);
    }
    await repo.setStatus(id, { status: 'CANCELLED', cancelled_at: toSqlUtc(new Date()), decision_note: note || r.decision_note }, conn);
    await notify.notifyEmployees([r.employee_manager_id, own ? null : r.employee_id].filter(Boolean), {
      type: 'LEAVE_CANCELLED', title: 'Leave cancelled', message: `${r.employee_name}'s ${r.type_name} request (${r.start_date} to ${r.end_date}) was cancelled`, refType: 'leave_request', refId: id,
    }, conn);
  });
  return repo.findById(id);
}

async function getRequest(id, user) {
  const r = await repo.findById(id);
  if (!r) throw ApiError.notFound('Leave request not found');
  await scope.assertCanSee(user, r.employeeId);
  return { ...r, documents: await repo.listDocuments(id) };
}

async function listRequests(user, f, paging) {
  let ids = await scope.visibleEmployeeIds(user);
  if (f.employeeId) { await scope.assertCanSee(user, f.employeeId); ids = [f.employeeId]; }
  return repo.list({ employeeIds: ids, statuses: f.status ? [f.status] : undefined, from: f.from, to: f.to, leaveTypeId: f.leaveTypeId, departmentId: f.departmentId, ...paging });
}
const myRequests = (user, f, paging) => repo.list({ employeeIds: [scope.requireEmployee(user)], statuses: f.status ? [f.status] : undefined, from: f.from, to: f.to, ...paging });

/** Requests this user may act on: HR sees all pending, a manager sees their direct reports'. */
async function pendingApprovals(user, paging) {
  if (ADMINS.includes(user.role)) return repo.list({ statuses: ['PENDING'], ...paging });
  const managerId = scope.requireEmployee(user);
  return repo.list({ statuses: ['PENDING'], managerId, ...paging });
}

async function teamLeave(user, { from, to }) {
  const ids = await scope.visibleEmployeeIds(user);
  const today = localDate();
  const { items } = await repo.list({ employeeIds: ids ? ids.filter((i) => i !== user.employeeId) : null, statuses: ['PENDING', 'APPROVED'], from: from || today, to: to || addDays(today, 30), noPaging: true });
  return items;
}

async function balances(user, employeeId, year) {
  const target = employeeId || scope.requireEmployee(user);
  await scope.assertCanSee(user, target);
  const y = year || +localDate().slice(0, 4);
  await withTransaction((conn) => repo.ensureBalances(target, y, conn));
  return { employeeId: target, year: y, balances: await repo.listBalances(target, y) };
}
async function history(user, employeeId, year) {
  const target = employeeId || scope.requireEmployee(user);
  await scope.assertCanSee(user, target);
  const y = year || +localDate().slice(0, 4);
  const requests = (await repo.list({ employeeIds: [target], noPaging: true })).items;
  return { employeeId: target, year: y, requests, ledger: await repo.listTx(target, y) };
}

async function adjustBalance({ employeeId, leaveTypeId, year, amount, note }, actor) {
  await withTransaction(async (conn) => {
    const emp = await empRepo.findById(employeeId, conn);
    if (!emp) throw ApiError.notFound('Employee not found');
    const type = await repo.getType(leaveTypeId, conn);
    if (!type || !type.policy) throw ApiError.unprocessable('Leave type has no balance (e.g. unpaid leave)', undefined, 'INVALID_LEAVE_TYPE');
    await repo.ensureBalances(employeeId, year, conn);
    const bal = await repo.lockBalance(employeeId, leaveTypeId, year, conn);
    if (Number(bal.entitled) + Number(bal.adjusted) + amount - Number(bal.used) < 0) throw ApiError.unprocessable('Adjustment would make the available balance negative', undefined, 'NEGATIVE_BALANCE');
    await repo.insertTx({ balanceId: bal.id, type: 'ADJUSTMENT', amount, note, createdBy: actor.id }, conn);
    await repo.applyBalanceDelta(bal.id, { adjustedDelta: amount }, conn);
    await notify.notifyEmployees([employeeId], { type: 'LEAVE_BALANCE_ADJUSTED', title: 'Leave balance adjusted', message: `${type.name}: ${amount > 0 ? '+' : ''}${amount} day(s). ${note}`, refType: 'leave_balance', refId: bal.id }, conn);
  });
  return balances(actor, employeeId, year);
}

// ---------- types / policies ----------
const listTypes = (activeOnly) => repo.listTypes(activeOnly);
async function createType(b) {
  const id = await repo.insertType(b);
  if (b.policy) await repo.upsertPolicy(id, b.policy);
  return repo.getType(id);
}
async function updateType(id, b) {
  if (!(await repo.getType(id))) throw ApiError.notFound('Leave type not found');
  await repo.updateType(id, b);
  if (b.policy === null) await repo.removePolicy(id); else if (b.policy) await repo.upsertPolicy(id, b.policy);
  return repo.getType(id);
}

// ---------- documents ----------
async function addDocument(id, user, file) {
  const r = await repo.findById(id);
  if (!r) throw ApiError.notFound('Leave request not found');
  if (r.employeeId !== user.employeeId && !ADMINS.includes(user.role)) throw ApiError.forbidden();
  if (!['PENDING', 'APPROVED'].includes(r.status)) throw ApiError.conflict('Documents can only be added to open requests', 'ALREADY_PROCESSED');
  const docId = await repo.insertDocument(id, file);
  return { id: docId, fileName: file.originalname, mimeType: file.detectedType, sizeBytes: file.size };
}
async function getDocument(id, docId, user) {
  const r = await repo.findById(id);
  if (!r) throw ApiError.notFound('Leave request not found');
  await scope.assertCanSee(user, r.employeeId);
  const d = await repo.getDocument(id, docId);
  if (!d) throw ApiError.notFound('Document not found');
  return d;
}

module.exports = { computeDays, apply, decide, cancel, getRequest, listRequests, myRequests, pendingApprovals, teamLeave, balances, history, adjustBalance, listTypes, createType, updateType, addDocument, getDocument };
