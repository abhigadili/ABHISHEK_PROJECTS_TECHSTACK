// OpenAPI 3.0 document generated from a compact endpoint table (single source of truth for /api-docs and docs/api/openapi.json).
const env = require('../config/env');

const A = 'ALL'; const ADM = 'SUPER_ADMIN, HR_ADMIN'; const MGR = 'SUPER_ADMIN, HR_ADMIN, MANAGER';
const PUB = null;

// Body DSL: 'string!' required string; 'integer', 'number', 'boolean', 'date', 'datetime', 'email', 'string[]', 'integer[]', 'object', "enum:A|B"
const T = {
  Auth: 'Authentication', Profile: 'Profile', Employees: 'Employees', Org: 'Organization chart', Dept: 'Departments', Teams: 'Teams', Desig: 'Designations',
  Att: 'Attendance', Leave: 'Leave', Cal: 'Holidays & calendar', Rep: 'Dashboard & reports', Notif: 'Notifications', Audit: 'Audit logs',
};
const P = (name, where = 'query', type = 'string', desc = '') => ({ name, in: where, schema: { type }, description: desc });
const pg = [P('page', 'query', 'integer'), P('limit', 'query', 'integer', 'max 100')];
const range = [P('from', 'query', 'string', 'YYYY-MM-DD'), P('to', 'query', 'string', 'YYYY-MM-DD')];
const csv = [P('format', 'query', 'string', 'json (default) or csv')];

const E = [
  // ---- auth
  ['post', '/auth/login', T.Auth, 'Log in with username OR email (one is required); returns access + refresh tokens', PUB, { email: 'email', username: 'string', password: 'string!' }],
  ['post', '/auth/register', T.Auth, 'Public self-registration (multipart/form-data, optional picture field "file"); creates an EMPLOYEE-role account', PUB, { firstName: 'string!', lastName: 'string!', username: 'string!', email: 'email!', mobile: 'string!', password: 'string!', dateOfBirth: 'string!', gender: 'string!', address: 'string', departmentId: 'integer', designationId: 'integer' }],
  ['get', '/auth/registration-options', T.Auth, 'Public: active departments and designations for the registration form', PUB],
  ['get', '/auth/username-available', T.Auth, 'Public: is a username free? (?username=)', PUB],
  ['post', '/auth/refresh', T.Auth, 'Rotate refresh token and get a new access token', PUB, { refreshToken: 'string!' }],
  ['post', '/auth/logout', T.Auth, 'Revoke a refresh-token family', PUB, { refreshToken: 'string!' }],
  ['post', '/auth/logout-all', T.Auth, 'Revoke every session of the current user', A],
  ['get', '/auth/me', T.Auth, 'Current authenticated user', A],
  ['post', '/auth/forgot-password', T.Auth, 'Request a password reset (generic response)', PUB, { email: 'email!' }],
  ['post', '/auth/reset-password', T.Auth, 'Reset password with a single-use token', PUB, { token: 'string!', newPassword: 'string!' }],
  ['post', '/auth/change-password', T.Auth, 'Change own password (revokes all sessions)', A, { currentPassword: 'string!', newPassword: 'string!' }],
  // ---- profile
  ['get', '/profile', T.Profile, 'Own full profile', A],
  ['patch', '/profile', T.Profile, 'Update permitted own fields', A, { personalEmail: 'email', phone: 'string', addressLine: 'string', city: 'string', state: 'string', country: 'string', postalCode: 'string', emergencyContactName: 'string', emergencyContactPhone: 'string', emergencyContactRelation: 'string' }],
  ['get', '/profile/picture', T.Profile, 'Download own profile picture', A],
  ['put', '/profile/picture', T.Profile, 'Upload/replace own picture (multipart field "file", JPEG/PNG/WebP)', A, 'file'],
  ['delete', '/profile/picture', T.Profile, 'Remove own picture', A],
  ['post', '/profile/change-password', T.Profile, 'Change own password', A, { currentPassword: 'string!', newPassword: 'string!' }],
  // ---- employees
  ['get', '/employees', T.Employees, 'List/search/filter employees (paginated)', A, null, [...pg, P('q'), P('departmentId', 'query', 'integer'), P('teamId', 'query', 'integer'), P('designationId', 'query', 'integer'), P('managerId', 'query', 'integer'), P('status', 'query', 'string', 'ACTIVE (default) | INACTIVE | TERMINATED | ALL (admin)'), P('employmentType'), P('sort', 'query', 'string', 'name|employeeCode|joiningDate|department|designation|status[:desc]')]],
  ['post', '/employees', T.Employees, 'Create an employee (optionally with a login account)', ADM, { employeeCode: 'string', firstName: 'string!', middleName: 'string', lastName: 'string!', workEmail: 'email!', personalEmail: 'email', phone: 'string', dateOfBirth: 'date', addressLine: 'string', city: 'string', state: 'string', country: 'string', postalCode: 'string', emergencyContactName: 'string', emergencyContactPhone: 'string', emergencyContactRelation: 'string', joiningDate: 'date!', probationEndDate: 'date', employmentType: 'enum:FULL_TIME|PART_TIME|CONTRACT|INTERN', designationId: 'integer', jobTitle: 'string', departmentId: 'integer', teamId: 'integer', managerId: 'integer', workLocation: 'string', salary: 'number', salaryCurrency: 'string', bonusTarget: 'number', account: 'object' }],
  ['get', '/employees/{id}', T.Employees, 'Employee by id (fields depend on viewer: admin / self / directory)', A],
  ['put', '/employees/{id}', T.Employees, 'Update an employee (records job history on org changes)', ADM, { firstName: 'string', lastName: 'string', workEmail: 'email', departmentId: 'integer', teamId: 'integer', designationId: 'integer', managerId: 'integer', jobTitle: 'string', salary: 'number', changeType: 'string', effectiveDate: 'date', notes: 'string' }],
  ['patch', '/employees/{id}', T.Employees, 'Partial update (same fields as PUT)', ADM, { firstName: 'string', departmentId: 'integer', managerId: 'integer', jobTitle: 'string' }],
  ['delete', '/employees/{id}', T.Employees, 'Deactivate (soft delete)', ADM, { reason: 'string', exitDate: 'date', reassignReportsTo: 'integer' }],
  ['post', '/employees/{id}/deactivate', T.Employees, 'Deactivate (same as DELETE)', ADM, { reason: 'string', exitDate: 'date', reassignReportsTo: 'integer' }],
  ['post', '/employees/{id}/reactivate', T.Employees, 'Reactivate an employee', ADM],
  ['get', '/employees/{id}/job-history', T.Employees, 'Job/employment history', 'ADM, self, manager chain'],
  ['post', '/employees/{id}/job-history', T.Employees, 'Record a promotion/probation/etc. entry', ADM, { changeType: 'enum:PROMOTION|TRANSFER|MANAGER_CHANGE|JOB_CHANGE|STATUS_CHANGE|PROBATION', effectiveDate: 'date!', notes: 'string' }],
  ['post', '/employees/{id}/account', T.Employees, 'Create a login account', ADM, { role: 'enum:SUPER_ADMIN|HR_ADMIN|MANAGER|EMPLOYEE', password: 'string!' }],
  ['put', '/employees/{id}/role', T.Employees, 'Change login role', 'SUPER_ADMIN', { role: 'enum:SUPER_ADMIN|HR_ADMIN|MANAGER|EMPLOYEE' }],
  ['get', '/employees/{id}/picture', T.Employees, 'Download profile picture', A],
  ['put', '/employees/{id}/picture', T.Employees, 'Upload/replace picture (multipart "file")', ADM, 'file'],
  ['delete', '/employees/{id}/picture', T.Employees, 'Remove picture', ADM],
  // ---- org
  ['get', '/org-chart', T.Org, 'Full hierarchy (cycle-safe, depth-limited, optional department scope)', A, null, [P('depth', 'query', 'integer'), P('departmentId', 'query', 'integer')]],
  ['get', '/org-chart/search', T.Org, 'Search employees in the hierarchy', A, null, [P('q'), P('rootId', 'query', 'integer')]],
  ['get', '/org-chart/employees/{id}', T.Org, 'Subtree rooted at an employee', A, null, [P('depth', 'query', 'integer')]],
  ['get', '/org-chart/employees/{id}/direct-reports', T.Org, 'Direct reports of a manager', A],
  ['get', '/org-chart/employees/{id}/reporting-chain', T.Org, 'Managers above an employee', A],
  // ---- departments / teams / designations
  ['get', '/departments', T.Dept, 'List departments', A, null, [...pg, P('q'), P('isActive', 'query', 'boolean')]],
  ['post', '/departments', T.Dept, 'Create department', ADM, { code: 'string!', name: 'string!', description: 'string', headEmployeeId: 'integer' }],
  ['get', '/departments/{id}', T.Dept, 'Department detail', A],
  ['put', '/departments/{id}', T.Dept, 'Update department / assign head', ADM, { code: 'string', name: 'string', description: 'string', headEmployeeId: 'integer' }],
  ['delete', '/departments/{id}', T.Dept, 'Deactivate department (must be empty)', ADM],
  ['post', '/departments/{id}/activate', T.Dept, 'Reactivate department', ADM],
  ['get', '/teams', T.Teams, 'List teams', A, null, [...pg, P('q'), P('departmentId', 'query', 'integer'), P('isActive', 'query', 'boolean')]],
  ['post', '/teams', T.Teams, 'Create team', ADM, { departmentId: 'integer!', name: 'string!', description: 'string', leadEmployeeId: 'integer' }],
  ['get', '/teams/{id}', T.Teams, 'Team detail with members', A],
  ['put', '/teams/{id}', T.Teams, 'Update team', ADM, { name: 'string', description: 'string', leadEmployeeId: 'integer', isActive: 'boolean' }],
  ['put', '/teams/{id}/members', T.Teams, 'Assign employees to a team', ADM, { employeeIds: 'integer[]!' }],
  ['get', '/designations', T.Desig, 'List designations', A, null, [...pg, P('q'), P('isActive', 'query', 'boolean')]],
  ['post', '/designations', T.Desig, 'Create designation', ADM, { name: 'string!', description: 'string', jobLevel: 'integer' }],
  ['get', '/designations/{id}', T.Desig, 'Designation detail', A],
  ['put', '/designations/{id}', T.Desig, 'Update designation', ADM, { name: 'string', description: 'string', jobLevel: 'integer', isActive: 'boolean' }],
  // ---- attendance
  ['post', '/attendance/check-in', T.Att, 'Check in (server time)', A, { workMode: 'enum:OFFICE|REMOTE|HYBRID', remarks: 'string' }],
  ['post', '/attendance/check-out', T.Att, 'Check out; computes working hours', A, { remarks: 'string' }],
  ['get', '/attendance/me', T.Att, 'Own attendance history', A, null, [...pg, ...range, P('status'), ...csv]],
  ['get', '/attendance/summary', T.Att, 'Attendance summary (scoped by role)', A, null, [...range, P('employeeId', 'query', 'integer')]],
  ['get', '/attendance/reports/monthly', T.Att, 'Monthly attendance report', MGR, null, [P('year', 'query', 'integer'), P('month', 'query', 'integer'), P('departmentId', 'query', 'integer'), ...csv]],
  ['get', '/attendance/reports/department', T.Att, 'Department-wise attendance report', ADM, null, [...range, ...csv]],
  ['get', '/attendance', T.Att, 'List attendance (scoped by role)', A, null, [...pg, ...range, P('employeeId', 'query', 'integer'), P('departmentId', 'query', 'integer'), P('status'), ...csv]],
  ['post', '/attendance', T.Att, 'HR manual entry', ADM, { employeeId: 'integer!', workDate: 'date!', checkInAt: 'datetime', checkOutAt: 'datetime', status: 'string', workMode: 'string', remarks: 'string', reason: 'string!' }],
  ['get', '/attendance/{id}', T.Att, 'Attendance record', A],
  ['put', '/attendance/{id}', T.Att, 'HR correction (audited, reason required)', ADM, { checkInAt: 'datetime', checkOutAt: 'datetime', status: 'string', workMode: 'string', remarks: 'string', reason: 'string!' }],
  // ---- leave
  ['get', '/leave/types', T.Leave, 'Leave types and policies', A],
  ['post', '/leave/types', T.Leave, 'Create leave type (+ policy)', ADM, { code: 'string!', name: 'string!', description: 'string', isPaid: 'boolean', requiresDocument: 'boolean', policy: 'object' }],
  ['put', '/leave/types/{id}', T.Leave, 'Update leave type / policy', ADM, { name: 'string', isPaid: 'boolean', requiresDocument: 'boolean', isActive: 'boolean', policy: 'object' }],
  ['get', '/leave/balances', T.Leave, 'Own leave balances', A, null, [P('year', 'query', 'integer')]],
  ['get', '/leave/balances/employees/{id}', T.Leave, 'An employee\'s balances (scoped)', A, null, [P('year', 'query', 'integer')]],
  ['post', '/leave/balances/adjust', T.Leave, 'Adjust a balance (ledgered)', ADM, { employeeId: 'integer!', leaveTypeId: 'integer!', year: 'integer!', amount: 'number!', note: 'string!' }],
  ['get', '/leave/history', T.Leave, 'Own leave requests + balance ledger', A, null, [P('year', 'query', 'integer')]],
  ['get', '/leave/history/employees/{id}', T.Leave, 'An employee\'s leave history (scoped)', A, null, [P('year', 'query', 'integer')]],
  ['post', '/leave/requests', T.Leave, 'Apply for leave', A, { leaveTypeId: 'integer!', startDate: 'date!', endDate: 'date!', dayPart: 'enum:FULL_DAY|FIRST_HALF|SECOND_HALF', reason: 'string!' }],
  ['get', '/leave/requests', T.Leave, 'List leave requests (scoped)', A, null, [...pg, ...range, P('status'), P('employeeId', 'query', 'integer'), P('leaveTypeId', 'query', 'integer'), P('departmentId', 'query', 'integer')]],
  ['get', '/leave/requests/me', T.Leave, 'Own leave requests', A, null, [...pg, ...range, P('status')]],
  ['get', '/leave/requests/pending-approvals', T.Leave, 'Requests awaiting my approval', MGR, null, pg],
  ['get', '/leave/team', T.Leave, 'Team leave (upcoming)', MGR, null, range],
  ['get', '/leave/requests/{id}', T.Leave, 'Leave request detail', A],
  ['post', '/leave/requests/{id}/approve', T.Leave, 'Approve (manager of employee or HR)', MGR, { note: 'string' }],
  ['post', '/leave/requests/{id}/reject', T.Leave, 'Reject', MGR, { note: 'string' }],
  ['post', '/leave/requests/{id}/cancel', T.Leave, 'Cancel/withdraw (refunds balance if approved)', A, { note: 'string' }],
  ['post', '/leave/requests/{id}/documents', T.Leave, 'Attach supporting document (multipart "file": JPEG/PNG/PDF)', A, 'file'],
  ['get', '/leave/requests/{id}/documents/{docId}', T.Leave, 'Download supporting document', A],
  // ---- holidays / calendar
  ['get', '/holidays', T.Cal, 'List holidays by date range / location', A, null, [...range, P('location')]],
  ['post', '/holidays', T.Cal, 'Create holiday', ADM, { holidayDate: 'date!', name: 'string!', location: 'string', isOptional: 'boolean' }],
  ['put', '/holidays/{id}', T.Cal, 'Update holiday', ADM, { holidayDate: 'date', name: 'string', location: 'string', isOptional: 'boolean' }],
  ['delete', '/holidays/{id}', T.Cal, 'Delete holiday', ADM],
  ['get', '/weekly-offs', T.Cal, 'Configured weekly-off days', A],
  ['put', '/weekly-offs', T.Cal, 'Replace weekly-off days for a location', ADM, { location: 'string', days: 'integer[]!' }],
  ['get', '/calendar/leave', T.Cal, 'Leave calendar for a month', A, null, [P('year', 'query', 'integer'), P('month', 'query', 'integer'), P('departmentId', 'query', 'integer')]],
  ['get', '/calendar/attendance', T.Cal, 'Attendance calendar for a month', A, null, [P('year', 'query', 'integer'), P('month', 'query', 'integer'), P('employeeId', 'query', 'integer')]],
  // ---- dashboard / reports
  ['get', '/dashboard', T.Rep, 'Dashboard metrics (scoped)', MGR],
  ['get', '/upcoming-events', T.Rep, 'Upcoming birthdays & anniversaries', MGR, null, [P('days', 'query', 'integer')]],
  ['get', '/reports/joiners-exits', T.Rep, 'Joining and exit report', MGR, null, [...range, ...csv]],
  ['get', '/reports/leave-balances', T.Rep, 'Leave balance report', MGR, null, [P('year', 'query', 'integer'), P('departmentId', 'query', 'integer'), ...csv]],
  ['get', '/reports/leave-summary', T.Rep, 'Leave summary report', MGR, null, [...range, P('departmentId', 'query', 'integer'), ...csv]],
  ['get', '/reports/departments', T.Rep, 'Department report', ADM, null, csv],
  ['get', '/reports/designations', T.Rep, 'Designation report', ADM, null, csv],
  // ---- notifications
  ['get', '/notifications', T.Notif, 'My notifications', A, null, [...pg, P('unread', 'query', 'boolean')]],
  ['get', '/notifications/unread-count', T.Notif, 'Unread count', A],
  ['post', '/notifications/read', T.Notif, 'Mark notifications read (all, or by ids)', A, { ids: 'integer[]' }],
  ['get', '/notifications/{id}', T.Notif, 'Notification detail (recipient only)', A],
  ['post', '/notifications/{id}/read', T.Notif, 'Mark one read', A],
  // ---- audit
  ['get', '/audit-logs', T.Audit, 'Audit trail', ADM, null, [...pg, P('entityType'), P('entityId'), P('userId', 'query', 'integer')]],
];

function schemaOf(dsl) {
  const required = [];
  const properties = {};
  for (const [name, raw] of Object.entries(dsl)) {
    let t = raw;
    if (t.endsWith('!')) { required.push(name); t = t.slice(0, -1); }
    let s;
    if (t === 'date') s = { type: 'string', format: 'date' };
    else if (t === 'datetime') s = { type: 'string', format: 'date-time' };
    else if (t === 'email') s = { type: 'string', format: 'email' };
    else if (t === 'integer[]') s = { type: 'array', items: { type: 'integer' } };
    else if (t.startsWith('enum:')) s = { type: 'string', enum: t.slice(5).split('|') };
    else s = { type: t };
    properties[name] = s;
  }
  return { type: 'object', properties, ...(required.length ? { required } : {}), additionalProperties: false };
}

function build() {
  const paths = {};
  for (const [method, path, tag, summary, roles, body, params = []] of E) {
    const pathParams = [...path.matchAll(/\{(\w+)\}/g)].map((m) => ({ name: m[1], in: 'path', required: true, schema: { type: 'integer' } }));
    const op = {
      tags: [tag], summary, description: roles ? `**Roles:** ${roles}` : 'Public endpoint',
      parameters: [...pathParams, ...params],
      responses: {
        200: { description: 'Success', content: { 'application/json': { schema: { $ref: '#/components/schemas/Envelope' } } } },
        400: { $ref: '#/components/responses/Error' }, 401: { $ref: '#/components/responses/Error' }, 403: { $ref: '#/components/responses/Error' },
        404: { $ref: '#/components/responses/Error' }, 409: { $ref: '#/components/responses/Error' }, 422: { $ref: '#/components/responses/Error' },
      },
    };
    if (roles) op.security = [{ bearerAuth: [] }]; else op.security = [];
    if (method === 'post' && !path.includes('/documents') && body !== 'file') op.responses[201] = op.responses[200];
    if (body === 'file') op.requestBody = { required: true, content: { 'multipart/form-data': { schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } } } } };
    else if (body) op.requestBody = { required: true, content: { 'application/json': { schema: schemaOf(body) } } };
    (paths[path] = paths[path] || {})[method] = op;
  }
  return {
    openapi: '3.0.3',
    info: { title: 'EMS-ExpressJS API', version: '1.0.0', description: 'Employee Management System REST API. All endpoints except /auth/login|refresh|logout|forgot-password|reset-password require `Authorization: Bearer <accessToken>`.\n\nSuccess envelope: `{ success, message, data, meta? }`. Error envelope: `{ success:false, error:{ code, message, details?, requestId } }`.' },
    servers: [{ url: env.apiPrefix }],
    tags: Object.values(T).map((name) => ({ name })),
    paths,
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      schemas: {
        Envelope: { type: 'object', properties: { success: { type: 'boolean' }, message: { type: 'string' }, data: {}, meta: { type: 'object', properties: { page: { type: 'integer' }, limit: { type: 'integer' }, total: { type: 'integer' }, totalPages: { type: 'integer' } } } } },
        Error: { type: 'object', properties: { success: { type: 'boolean', example: false }, error: { type: 'object', properties: { code: { type: 'string', example: 'VALIDATION_ERROR' }, message: { type: 'string' }, details: { type: 'array', items: { type: 'object', properties: { field: { type: 'string' }, message: { type: 'string' } } } }, requestId: { type: 'string' } } } } },
      },
      responses: { Error: { description: 'Error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } } },
    },
  };
}
module.exports = { build, endpointCount: E.length };
