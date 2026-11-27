const orgRepo = require('../repositories/orgRepository');
const ApiError = require('../utils/ApiError');
const { ROLES, ADMINS } = require('../constants');

/** null = unrestricted (admins). Otherwise the list of employee ids the user may see: self (+ whole subtree for managers). */
async function visibleEmployeeIds(user) {
  if (ADMINS.includes(user.role)) return null;
  if (!user.employeeId) return [];
  if (user.role === ROLES.MANAGER) return [user.employeeId, ...(await orgRepo.descendantIds(user.employeeId))];
  return [user.employeeId];
}

async function assertCanSee(user, employeeId) {
  const ids = await visibleEmployeeIds(user);
  if (ids && !ids.includes(employeeId)) throw ApiError.forbidden('You cannot access this employee\'s data');
}

const requireEmployee = (user) => {
  if (!user.employeeId) throw ApiError.unprocessable('Your account is not linked to an employee record', undefined, 'NO_EMPLOYEE_RECORD');
  return user.employeeId;
};

module.exports = { visibleEmployeeIds, assertCanSee, requireEmployee };
