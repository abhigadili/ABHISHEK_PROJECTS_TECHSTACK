-- 07_seed_reference_data.sql
-- Reference data the application requires. Idempotent. No credentials.
USE ems_expressjs;

INSERT INTO roles (id, name, description) VALUES
  (1, 'SUPER_ADMIN', 'Full system access'),
  (2, 'HR_ADMIN',    'Manages employees, attendance, leave and reports'),
  (3, 'MANAGER',     'Views team data and approves team leave'),
  (4, 'EMPLOYEE',    'Self-service access')
ON DUPLICATE KEY UPDATE description = VALUES(description);

INSERT INTO leave_types (id, code, name, description, is_paid, requires_document) VALUES
  (1, 'CL', 'Casual Leave', 'Short-notice personal leave', 1, 0),
  (2, 'SL', 'Sick Leave',   'Illness; document needed for 3+ consecutive days (HR policy)', 1, 0),
  (3, 'EL', 'Earned Leave', 'Accrued/planned leave, carried forward', 1, 0),
  (4, 'UL', 'Unpaid Leave', 'Leave without pay; not balance-limited', 0, 0)
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO leave_policies (leave_type_id, annual_entitlement, carry_forward_max, allow_half_day, max_consecutive_days) VALUES
  (1, 12.0, 0.0, 1, 5),
  (2, 10.0, 0.0, 1, NULL),
  (3, 18.0, 10.0, 1, NULL)
ON DUPLICATE KEY UPDATE annual_entitlement = VALUES(annual_entitlement);

-- Default weekly off: Saturday and Sunday for every location.
INSERT INTO weekly_offs (location, day_of_week) VALUES ('ALL', 0), ('ALL', 6)
ON DUPLICATE KEY UPDATE day_of_week = VALUES(day_of_week);
