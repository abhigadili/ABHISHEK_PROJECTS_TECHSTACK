const { withTransaction, query } = require('../config/database');
const userRepo = require('../repositories/userRepository');
const empRepo = require('../repositories/employeeRepository');
const refRepo = require('../repositories/referenceRepository');
const notify = require('./notificationService');
const pw = require('../utils/password');
const ApiError = require('../utils/ApiError');
const { localDate } = require('../utils/dates');
const { ROLES, ROLE_IDS } = require('../constants');

/** Self-registered accounts get the least-privileged role. Elevation is only possible through SUPER_ADMIN (PUT /employees/:id/role). */
const DEFAULT_ROLE = ROLES.EMPLOYEE;

const usernameTaken = async (username) => !!(await userRepo.findByUsername(username));
const emailTaken = async (email) => !!(await userRepo.findByEmail(email)) || !!(await empRepo.emailTaken(email));

async function options() {
  const [departments, designations] = await Promise.all([
    query('SELECT id, name FROM departments WHERE is_active = 1 ORDER BY name'),
    query('SELECT id, name FROM designations WHERE is_active = 1 ORDER BY job_level, name'),
  ]);
  return { departments, designations };
}

/**
 * Creates the employee record (the existing "person" entity) and its login in ONE transaction, so there can never be a half-registered
 * user. Duplicates are reported per field so the UI can show each message next to the right input.
 */
async function register(b, file) {
  const username = b.username.toLowerCase();
  const email = b.email.toLowerCase();
  const dupes = [];
  if (await usernameTaken(username)) dupes.push({ field: 'username', message: 'This username is already taken' });
  if (await emailTaken(email)) dupes.push({ field: 'email', message: 'This email address is already registered' });
  if (dupes.length) throw new ApiError(409, dupes[0].field === 'username' ? 'DUPLICATE_USERNAME' : 'DUPLICATE_EMAIL', dupes[0].message, dupes);

  const passwordHash = await pw.hash(b.password); // bcrypt with the configured cost; the plain password never touches the database or the logs

  const out = await withTransaction(async (conn) => {
    if (b.departmentId) {
      const d = await refRepo.getDepartment(b.departmentId, conn);
      if (!d || !d.is_active) throw ApiError.unprocessable('Department does not exist or is inactive', [{ field: 'departmentId', message: 'Choose an active department' }], 'INVALID_DEPARTMENT');
    }
    let jobTitle = null;
    if (b.designationId) {
      const d = await refRepo.getDesignation(b.designationId, conn);
      if (!d || !d.is_active) throw ApiError.unprocessable('Designation does not exist or is inactive', [{ field: 'designationId', message: 'Choose an active designation' }], 'INVALID_DESIGNATION');
      jobTitle = (await query('SELECT name FROM designations WHERE id = ?', [b.designationId], conn))[0].name;
    }
    const code = await empRepo.nextCode(conn);
    const employeeId = await empRepo.insert({
      employee_code: code, first_name: b.firstName, last_name: b.lastName, work_email: email, phone: b.mobile, date_of_birth: b.dateOfBirth,
      gender: b.gender, address_line: b.address || null, joining_date: localDate(), department_id: b.departmentId || null,
      designation_id: b.designationId || null, job_title: jobTitle,
    }, conn);
    await empRepo.insertHistory({ employeeId, changeType: 'JOINED', effectiveDate: localDate(), toDesignationId: b.designationId || null,
      toDepartmentId: b.departmentId || null, toJobTitle: jobTitle, notes: 'Self-registered' }, conn);
    const userId = await userRepo.create({ employeeId, username, email, passwordHash, roleId: ROLE_IDS[DEFAULT_ROLE] }, conn);
    if (file) await conn.query(
      'INSERT INTO employee_profile_pictures (employee_id, mime_type, size_bytes, data) VALUES (?,?,?,?)', [employeeId, file.detectedType, file.buffer.length, file.buffer]);
    await notify.notifyRoles([ROLES.HR_ADMIN, ROLES.SUPER_ADMIN], { type: 'ONBOARDING', title: 'New self-registration', message: `${b.firstName} ${b.lastName} registered (${code})`, refType: 'employee', refId: employeeId }, conn);
    return { userId, employeeId, employeeCode: code };
  });
  return { id: out.userId, employeeId: out.employeeId, employeeCode: out.employeeCode, username, email, role: DEFAULT_ROLE };
}

module.exports = { register, options, usernameTaken };
