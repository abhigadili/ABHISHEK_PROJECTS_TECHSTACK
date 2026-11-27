const { ADMINS } = require('../constants');

const base = (r) => ({
  id: r.id,
  employeeCode: r.employee_code,
  firstName: r.first_name,
  middleName: r.middle_name,
  lastName: r.last_name,
  fullName: [r.first_name, r.middle_name, r.last_name].filter(Boolean).join(' '),
  workEmail: r.work_email,
  phone: r.phone,
  status: r.status,
  employmentType: r.employment_type,
  designation: r.designation_id ? { id: r.designation_id, name: r.designation_name } : null,
  jobTitle: r.job_title,
  department: r.department_id ? { id: r.department_id, name: r.department_name } : null,
  team: r.team_id ? { id: r.team_id, name: r.team_name } : null,
  manager: r.manager_id ? { id: r.manager_id, employeeCode: r.manager_code, name: r.manager_name } : null,
  workLocation: r.work_location,
  joiningDate: r.joining_date,
  profilePictureUrl: r.has_picture ? `/api/v1/employees/${r.id}/picture` : null,
});

const personal = (r) => ({
  personalEmail: r.personal_email,
  dateOfBirth: r.date_of_birth,
  gender: r.gender || null,
  address: { line: r.address_line, city: r.city, state: r.state, country: r.country, postalCode: r.postal_code },
  emergencyContact: { name: r.emergency_contact_name, phone: r.emergency_contact_phone, relation: r.emergency_contact_relation },
  probationEndDate: r.probation_end_date,
  exitDate: r.exit_date,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const compensation = (r) => ({
  salary: r.salary === null ? null : Number(r.salary),
  salaryCurrency: r.salary_currency,
  bonusTarget: r.bonus_target === null ? null : Number(r.bonus_target),
});

/**
 * Field-level access tiers:
 *  - admin (SUPER_ADMIN/HR_ADMIN): everything incl. compensation and account info
 *  - self: personal data + own compensation
 *  - anyone else (directory view): non-confidential work fields only
 */
function toEmployee(row, viewer) {
  const out = base(row);
  const admin = viewer && ADMINS.includes(viewer.role);
  const self = viewer && viewer.employeeId === row.id;
  if (admin || self) Object.assign(out, personal(row), { compensation: compensation(row) });
  if (admin) out.account = row.user_id ? { userId: row.user_id, role: row.role } : null;
  return out;
}

module.exports = { toEmployee, base };
