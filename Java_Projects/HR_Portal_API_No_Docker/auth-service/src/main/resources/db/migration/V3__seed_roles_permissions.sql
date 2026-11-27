-- Reference data: permissions, the seven built-in roles and their permission bundles (no users / passwords here).
INSERT INTO permissions (id, code, description, created_at, updated_at, created_by, updated_by) VALUES
  (UUID(), 'SELF_SERVICE', 'Access own profile, leave, attendance, payslips, tax, timesheets', NOW(6), NOW(6), 'flyway', 'flyway'),
  (UUID(), 'USER_MANAGE', 'Provision and administer user accounts', NOW(6), NOW(6), 'flyway', 'flyway'),
  (UUID(), 'EMPLOYEE_READ', 'Read employee records (non-sensitive)', NOW(6), NOW(6), 'flyway', 'flyway'),
  (UUID(), 'EMPLOYEE_WRITE', 'Create and update employee records', NOW(6), NOW(6), 'flyway', 'flyway'),
  (UUID(), 'ORG_MANAGE', 'Manage organization structure', NOW(6), NOW(6), 'flyway', 'flyway'),
  (UUID(), 'TEAM_VIEW', 'View direct-report information', NOW(6), NOW(6), 'flyway', 'flyway'),
  (UUID(), 'LEAVE_APPROVE', 'Approve or reject leave applications', NOW(6), NOW(6), 'flyway', 'flyway'),
  (UUID(), 'LEAVE_POLICY_MANAGE', 'Manage leave types and policies', NOW(6), NOW(6), 'flyway', 'flyway'),
  (UUID(), 'ATTENDANCE_APPROVE', 'Approve attendance corrections and work-from-home', NOW(6), NOW(6), 'flyway', 'flyway'),
  (UUID(), 'ATTENDANCE_MANAGE', 'Manage shifts and attendance configuration', NOW(6), NOW(6), 'flyway', 'flyway'),
  (UUID(), 'HOLIDAY_MANAGE', 'Manage the holiday calendar', NOW(6), NOW(6), 'flyway', 'flyway'),
  (UUID(), 'SALARY_MANAGE', 'Manage salary structures and assignments', NOW(6), NOW(6), 'flyway', 'flyway'),
  (UUID(), 'PAYROLL_PROCESS', 'Process and finalize payroll', NOW(6), NOW(6), 'flyway', 'flyway'),
  (UUID(), 'PAYROLL_APPROVE', 'Approve payroll runs', NOW(6), NOW(6), 'flyway', 'flyway'),
  (UUID(), 'PAYROLL_VIEW', 'View payroll data and reports', NOW(6), NOW(6), 'flyway', 'flyway'),
  (UUID(), 'PAYSLIP_VIEW_ALL', 'View payslips of all employees', NOW(6), NOW(6), 'flyway', 'flyway'),
  (UUID(), 'TAX_REVIEW', 'Review tax declarations and proofs', NOW(6), NOW(6), 'flyway', 'flyway'),
  (UUID(), 'TAX_CONFIG', 'Maintain tax rules', NOW(6), NOW(6), 'flyway', 'flyway'),
  (UUID(), 'PERFORMANCE_MANAGE', 'Manage review cycles and forms', NOW(6), NOW(6), 'flyway', 'flyway'),
  (UUID(), 'PERFORMANCE_REVIEW', 'Evaluate direct reports', NOW(6), NOW(6), 'flyway', 'flyway'),
  (UUID(), 'PROJECT_MANAGE', 'Manage customers, projects and allocations', NOW(6), NOW(6), 'flyway', 'flyway'),
  (UUID(), 'TIMESHEET_APPROVE', 'Approve or reject timesheets', NOW(6), NOW(6), 'flyway', 'flyway'),
  (UUID(), 'EXIT_MANAGE', 'Manage the exit workflow', NOW(6), NOW(6), 'flyway', 'flyway'),
  (UUID(), 'EXIT_APPROVE', 'Review resignations of direct reports', NOW(6), NOW(6), 'flyway', 'flyway'),
  (UUID(), 'DOCUMENT_VERIFY', 'Verify, approve and reject employee documents', NOW(6), NOW(6), 'flyway', 'flyway'),
  (UUID(), 'NOTIFICATION_MANAGE', 'Manage notification templates and settings', NOW(6), NOW(6), 'flyway', 'flyway'),
  (UUID(), 'REPORT_VIEW', 'View reports', NOW(6), NOW(6), 'flyway', 'flyway'),
  (UUID(), 'AUDIT_VIEW', 'Read audit history', NOW(6), NOW(6), 'flyway', 'flyway');

INSERT INTO roles (id, name, description, created_at, updated_at, created_by, updated_by) VALUES
  (UUID(), 'EMPLOYEE', 'Regular employee (self service)', NOW(6), NOW(6), 'flyway', 'flyway'),
  (UUID(), 'MANAGER', 'People manager', NOW(6), NOW(6), 'flyway', 'flyway'),
  (UUID(), 'HR_ADMIN', 'HR administrator', NOW(6), NOW(6), 'flyway', 'flyway'),
  (UUID(), 'PAYROLL_ADMIN', 'Payroll administrator', NOW(6), NOW(6), 'flyway', 'flyway'),
  (UUID(), 'FINANCE_ADMIN', 'Finance administrator', NOW(6), NOW(6), 'flyway', 'flyway'),
  (UUID(), 'PROJECT_MANAGER', 'Project manager', NOW(6), NOW(6), 'flyway', 'flyway'),
  (UUID(), 'SUPER_ADMIN', 'Super administrator (all permissions)', NOW(6), NOW(6), 'flyway', 'flyway');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('SELF_SERVICE') WHERE r.name = 'EMPLOYEE';
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('SELF_SERVICE', 'TEAM_VIEW', 'LEAVE_APPROVE', 'ATTENDANCE_APPROVE', 'TIMESHEET_APPROVE', 'PERFORMANCE_REVIEW', 'EXIT_APPROVE', 'REPORT_VIEW', 'EMPLOYEE_READ') WHERE r.name = 'MANAGER';
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('SELF_SERVICE', 'USER_MANAGE', 'EMPLOYEE_READ', 'EMPLOYEE_WRITE', 'ORG_MANAGE', 'TEAM_VIEW', 'LEAVE_APPROVE', 'LEAVE_POLICY_MANAGE', 'ATTENDANCE_APPROVE', 'ATTENDANCE_MANAGE', 'HOLIDAY_MANAGE', 'TAX_REVIEW', 'PERFORMANCE_MANAGE', 'PERFORMANCE_REVIEW', 'EXIT_MANAGE', 'EXIT_APPROVE', 'DOCUMENT_VERIFY', 'NOTIFICATION_MANAGE', 'REPORT_VIEW', 'AUDIT_VIEW') WHERE r.name = 'HR_ADMIN';
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('SELF_SERVICE', 'EMPLOYEE_READ', 'SALARY_MANAGE', 'PAYROLL_PROCESS', 'PAYROLL_VIEW', 'PAYSLIP_VIEW_ALL', 'REPORT_VIEW', 'AUDIT_VIEW') WHERE r.name = 'PAYROLL_ADMIN';
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('SELF_SERVICE', 'EMPLOYEE_READ', 'PAYROLL_APPROVE', 'PAYROLL_VIEW', 'PAYSLIP_VIEW_ALL', 'TAX_REVIEW', 'TAX_CONFIG', 'REPORT_VIEW', 'AUDIT_VIEW') WHERE r.name = 'FINANCE_ADMIN';
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('SELF_SERVICE', 'EMPLOYEE_READ', 'PROJECT_MANAGE', 'TIMESHEET_APPROVE', 'REPORT_VIEW') WHERE r.name = 'PROJECT_MANAGER';
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('SELF_SERVICE', 'USER_MANAGE', 'EMPLOYEE_READ', 'EMPLOYEE_WRITE', 'ORG_MANAGE', 'TEAM_VIEW', 'LEAVE_APPROVE', 'LEAVE_POLICY_MANAGE', 'ATTENDANCE_APPROVE', 'ATTENDANCE_MANAGE', 'HOLIDAY_MANAGE', 'SALARY_MANAGE', 'PAYROLL_PROCESS', 'PAYROLL_APPROVE', 'PAYROLL_VIEW', 'PAYSLIP_VIEW_ALL', 'TAX_REVIEW', 'TAX_CONFIG', 'PERFORMANCE_MANAGE', 'PERFORMANCE_REVIEW', 'PROJECT_MANAGE', 'TIMESHEET_APPROVE', 'EXIT_MANAGE', 'EXIT_APPROVE', 'DOCUMENT_VERIFY', 'NOTIFICATION_MANAGE', 'REPORT_VIEW', 'AUDIT_VIEW') WHERE r.name = 'SUPER_ADMIN';
