-- 03_create_indexes_and_constraints.sql
-- Foreign keys and secondary indexes. Run once, after 02.
USE ems_expressjs;

ALTER TABLE departments
  ADD CONSTRAINT fk_departments_head FOREIGN KEY (head_employee_id) REFERENCES employees (id) ON DELETE SET NULL;

ALTER TABLE teams
  ADD CONSTRAINT fk_teams_department FOREIGN KEY (department_id) REFERENCES departments (id),
  ADD CONSTRAINT fk_teams_lead FOREIGN KEY (lead_employee_id) REFERENCES employees (id) ON DELETE SET NULL;

ALTER TABLE employees
  ADD CONSTRAINT fk_employees_designation FOREIGN KEY (designation_id) REFERENCES designations (id),
  ADD CONSTRAINT fk_employees_department  FOREIGN KEY (department_id)  REFERENCES departments (id),
  ADD CONSTRAINT fk_employees_team        FOREIGN KEY (team_id)        REFERENCES teams (id),
  ADD CONSTRAINT fk_employees_manager     FOREIGN KEY (manager_id)     REFERENCES employees (id),
  ADD INDEX idx_employees_name (last_name, first_name),
  ADD INDEX idx_employees_department (department_id),
  ADD INDEX idx_employees_designation (designation_id),
  ADD INDEX idx_employees_manager (manager_id),
  ADD INDEX idx_employees_team (team_id),
  ADD INDEX idx_employees_status_type (status, employment_type),
  ADD INDEX idx_employees_joining (joining_date);

ALTER TABLE employee_profile_pictures
  ADD CONSTRAINT fk_epp_employee FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE;

ALTER TABLE users
  ADD CONSTRAINT fk_users_employee FOREIGN KEY (employee_id) REFERENCES employees (id),
  ADD CONSTRAINT fk_users_role     FOREIGN KEY (role_id)     REFERENCES roles (id);

ALTER TABLE refresh_tokens
  ADD CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  ADD INDEX idx_refresh_user (user_id),
  ADD INDEX idx_refresh_family (family_id),
  ADD INDEX idx_refresh_expires (expires_at);

ALTER TABLE password_reset_tokens
  ADD CONSTRAINT fk_prt_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  ADD INDEX idx_prt_user (user_id);

ALTER TABLE job_history
  ADD CONSTRAINT fk_jh_employee FOREIGN KEY (employee_id) REFERENCES employees (id),
  ADD INDEX idx_jh_employee_date (employee_id, effective_date);

ALTER TABLE attendance
  ADD CONSTRAINT fk_attendance_employee FOREIGN KEY (employee_id) REFERENCES employees (id),
  ADD INDEX idx_attendance_date (work_date),
  ADD INDEX idx_attendance_status (status);

ALTER TABLE leave_policies
  ADD CONSTRAINT fk_lp_type FOREIGN KEY (leave_type_id) REFERENCES leave_types (id);

ALTER TABLE leave_balances
  ADD CONSTRAINT fk_lb_employee FOREIGN KEY (employee_id)   REFERENCES employees (id),
  ADD CONSTRAINT fk_lb_type     FOREIGN KEY (leave_type_id) REFERENCES leave_types (id);

ALTER TABLE leave_requests
  ADD CONSTRAINT fk_lr_employee FOREIGN KEY (employee_id)   REFERENCES employees (id),
  ADD CONSTRAINT fk_lr_type     FOREIGN KEY (leave_type_id) REFERENCES leave_types (id),
  ADD CONSTRAINT fk_lr_decider  FOREIGN KEY (decided_by)    REFERENCES employees (id),
  ADD INDEX idx_lr_employee_dates (employee_id, start_date, end_date),
  ADD INDEX idx_lr_status (status),
  ADD INDEX idx_lr_dates (start_date, end_date);

ALTER TABLE leave_request_documents
  ADD CONSTRAINT fk_lrd_request FOREIGN KEY (leave_request_id) REFERENCES leave_requests (id) ON DELETE CASCADE,
  ADD INDEX idx_lrd_request (leave_request_id);

ALTER TABLE leave_balance_transactions
  ADD CONSTRAINT fk_lbt_balance FOREIGN KEY (leave_balance_id) REFERENCES leave_balances (id),
  ADD CONSTRAINT fk_lbt_request FOREIGN KEY (leave_request_id) REFERENCES leave_requests (id),
  ADD INDEX idx_lbt_balance (leave_balance_id);

ALTER TABLE holidays ADD INDEX idx_holidays_date (holiday_date);

ALTER TABLE notifications
  ADD CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  ADD INDEX idx_notifications_user_read (user_id, is_read, created_at);

ALTER TABLE audit_logs
  ADD INDEX idx_audit_entity (entity_type, entity_id),
  ADD INDEX idx_audit_user (user_id),
  ADD INDEX idx_audit_created (created_at);
