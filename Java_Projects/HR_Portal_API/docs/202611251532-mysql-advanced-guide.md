# MySQL Advanced Guide

Everything here is created by Flyway migrations (`<service>/src/main/resources/db/migration/V3+`). Object inventory: 8 functions, 6 stored procedures, 9 views, 35 triggers, 38 CHECK constraints, 44 foreign keys (`database-design`). MySQL 8.0, InnoDB, `utf8mb4`.

## 1. Why logic in the database at all?
Rules that **every client must apply identically** (working-day arithmetic, overtime, leave duration), **set-based work** (totals over thousands of rows) and **tamper-proof records** (audit, history) are safest next to the data. The application still owns workflow and authorisation. All routines are `SQL SECURITY INVOKER` so they run with the caller's (least-privilege) rights.

## 2. Functions
```sql
CREATE FUNCTION fn_working_days(p_from DATE, p_to DATE) RETURNS INT DETERMINISTIC NO SQL ...
CREATE FUNCTION fn_overtime_minutes(p_worked INT, p_standard INT, p_threshold INT) RETURNS INT DETERMINISTIC NO SQL
BEGIN
  IF p_worked > p_standard + p_threshold THEN RETURN p_worked - p_standard; END IF;
  RETURN 0;
END
```
| Function | Used from |
|---|---|
| `fn_working_days` | leave + attendance (weekday counts), the monthly summary procedure |
| `fn_leave_duration` | `LeaveDurationService` |
| `fn_employee_tenure_months` | employee view `vw_employee_directory`, exit settlement |
| `fn_overtime_minutes` | `AttendanceService` at check-out |
| `fn_salary_component`, `fn_overtime_pay` | payroll calculators |

*Try it:* `SELECT fn_overtime_minutes(560, 480, 30);` → `80` (worked 9 h 20 min against an 8 h shift with a 30 min grace); `SELECT fn_overtime_minutes(500,480,30);` → `0`.
`DETERMINISTIC NO SQL` lets MySQL treat them as pure functions (and satisfies binary-log safety rules).

## 3. Stored procedures
See the table in `database-design` §6. Patterns used:
* **Compute + store + return** - `sp_monthly_attendance_summary` classifies each day (worked > holiday > weekly off > approved leave > absent), upserts `monthly_attendance_summary`, then `SELECT`s the row.
* **Transaction-friendly** - `sp_process_monthly_payroll` contains no `COMMIT`; it runs in the caller's transaction, locks the run row `FOR UPDATE`, validates (`SIGNAL SQLSTATE '45000'` when not DRAFT) and re-aggregates totals from lines so stored totals can never disagree with the lines.
* **Read-only reports** - `sp_timesheet_summary`, `sp_employee_allocation_summary`, `sp_calculate_leave_balance`.
`SIGNAL` errors surface in Java as `DataAccessException` subclasses. The services validate state first (e.g. a payroll run must be DRAFT), so a `SIGNAL` is a last-line guard that is not expected in normal flow; if one fires it is reported as `500 INTERNAL_ERROR` (details only in the log), never leaking SQL to the client.

## 4. Views
```sql
CREATE SQL SECURITY INVOKER VIEW vw_employee_directory AS
SELECT e.id AS employee_id, e.employee_code, CONCAT(e.first_name,' ',e.last_name) AS full_name, e.work_email,
       e.department_id, e.designation_id, e.location_id, e.manager_id, e.status, e.employment_type, e.joining_date,
       fn_employee_tenure_months(e.joining_date, CURDATE()) AS tenure_months
FROM employees e WHERE e.deleted = 0 AND e.status IN ('ACTIVE','ON_NOTICE');
```
Views deliberately expose **no sensitive columns** (no PAN, bank, salary figures beyond the salary summary view for payroll roles). Others: `vw_employee_department_details`, `vw_employee_salary_summary`, `vw_monthly_attendance_summary`, `vw_employee_leave_summary`, `vw_project_employee_allocation`, `vw_timesheet_summary`, `vw_headcount_by_department`, `vw_leave_utilization` (SUM / COUNT per type and month from the report facts).

## 5. Triggers
```sql
CREATE TRIGGER trg_employee_status_history AFTER UPDATE ON employees FOR EACH ROW
BEGIN
  IF NOT (OLD.status <=> NEW.status) THEN
    INSERT INTO employee_status_history (employee_id, old_status, new_status, changed_at, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, UTC_TIMESTAMP(6), NEW.updated_by);
  END IF;
END
```
`<=>` is the NULL-safe comparison. Same pattern: `trg_leave_balance_history`, `trg_salary_history_insert` / `_update`.
**Audit protection** (every database, `V2__audit_protection.sql`): `trg_audit_history_no_update` and `_no_delete` execute `SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_history is append-only: UPDATE is not allowed'` (or DELETE), so even a compromised application account cannot rewrite history.
Triggers use `UTC_TIMESTAMP(6)` (an early version used local time; fixed by employee `V4`).
**Cons:** invisible to developers reading Java; they fire for bulk statements too; keep them small.

## 6. Constraints and indexes
CHECK constraints (`chk_leave_dates`, `chk_alloc_percent`, `chk_entry_hours`, `chk_review_ratings`, ...) are the last line of validation behind Bean Validation. Foreign keys exist **inside** a service's database (44); never across services. Unique keys encode business identities (`uk_attendance_employee_date`, `uk_tds_employee_month`, `uk_processed_event_consumer`). Composite indexes follow the repository queries (e.g. `(entity_type, entity_id)` on `audit_history`).
```sql
EXPLAIN SELECT * FROM attendance_records WHERE employee_id = 'e1' AND work_date BETWEEN '2026-11-01' AND '2026-11-30';
-- type: range, key: uk_attendance_employee_date  (uses the unique index, no table scan)
```

## 7. Transactions, locks, isolation
Default `REPEATABLE READ`. Writers that must be exclusive use `SELECT ... FOR UPDATE` through JPA (`@Lock(PESSIMISTIC_WRITE)`) on a single row: employee code counter, leave balance, payroll run (inside the procedure). Optimistic `version` columns cover the rest. Keep transactions short: Hikari pool is 4 connections per service.

## 8. Privileges
`infrastructure/mysql/01-create-app-user.sh` creates the runtime user with `SELECT, INSERT, UPDATE, DELETE, EXECUTE` on the 15 databases only - no DDL, no `SUPER`, nothing on other schemas. Flyway uses a separate migration login (needed because creating functions / triggers with the binary log on requires elevated rights).

## 9. Handy queries
```sql
SELECT status, COUNT(*) FROM hr_employee_db.employees WHERE deleted=0 GROUP BY status;
SELECT * FROM hr_employee_db.employee_status_history ORDER BY changed_at DESC LIMIT 5;
SELECT entity_type, action, user_id, created_at FROM hr_leave_db.audit_history ORDER BY created_at DESC LIMIT 10;
SELECT COUNT(*) AS unsent FROM hr_leave_db.outbox_events WHERE sent_at IS NULL;   -- should drain to 0
SELECT version, success FROM hr_leave_db.flyway_schema_history;
CALL hr_project_db.sp_employee_allocation_summary('<employeeId>', CURDATE());
```

## Pros / cons
| Pros | Cons |
|---|---|
| One implementation of core rules for all callers; fast set-based processing | Harder to test/debug than Java; deployment through migrations only |
| Triggers/constraints guarantee integrity even for ad-hoc SQL | Vendor lock-in to MySQL syntax |
| Least privilege with INVOKER routines | Logic split across layers requires documentation (this guide) |
