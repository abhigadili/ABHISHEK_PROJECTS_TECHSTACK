# Database Design

## 1. Principles

* **One MySQL database per service** (`hr_<service>_db`), created by `infrastructure/mysql/00-create-databases.sql` / `scripts/create-databases.sh`. No cross-database foreign keys, no cross-service joins. Cross-service references are plain UUID columns resolved by API or event-fed read models.
* **Flyway** owns the schema. Per service in `src/main/resources/db/migration`: `V1__baseline_schema.sql` (generated from the JPA entities against a scratch MySQL, so it matches the code exactly), `V2__audit_protection.sql` (append-only triggers on `audit_history`), `V3+` hand-written objects (CHECK constraints, foreign keys, functions, procedures, views, triggers, seed data). Hibernate runs with `ddl-auto: none` - it never creates or alters a schema.
* **Two DB logins:** a migration user (DDL, triggers, routines) used by Flyway only, and `hr_app` with `SELECT, INSERT, UPDATE, DELETE, EXECUTE` for the running service.
* **Keys:** `varchar(36)` UUID primary keys (generated in the application) so ids can be referenced across services before insert; `outbox_events.id` is a bigint identity.
* **Audit columns** on every business table (`BaseEntity`): `created_at`, `updated_at`, `created_by`, `updated_by` (JPA auditing via `AuditingEntityListener`), `id` (UUID). Entities that can be edited concurrently add a `version` column (`@Version`: employee, leave balance / application, attendance record, payroll run, salary, loan, timesheet, project, resignation, tax declaration, review, document, user account). Master data adds `deleted` / `deleted_at` (soft delete via `SoftDeletableEntity`, filtered by `@SQLRestriction("deleted = false")`).
* **Time** is stored in UTC (`datetime(6)`); triggers use `UTC_TIMESTAMP(6)`. Money is `decimal(15,2)`; rates `decimal(5,2)`.
* **Charset** `utf8mb4`, InnoDB.
* **Per-service infrastructure tables:** `audit_history` (who changed what, previous / new JSON, correlation id; immutable by trigger), `outbox_events` (pending Kafka events), `processed_events` (idempotency ledger).

## 2. Inventory

| Service | Database | Tables | Functions | Procedures | Views | Triggers | CHECKs | FKs |
|---|---|---|---|---|---|---|---|---|
| attendance | `hr_attendance_db` | 12 | 2 | 1 | 1 | 2 | 4 | 0 |
| auth | `hr_auth_db` | 10 | 0 | 0 | 0 | 2 | 0 | 4 |
| document | `hr_document_db` | 7 | 0 | 0 | 0 | 2 | 2 | 3 |
| employee | `hr_employee_db` | 13 | 1 | 0 | 1 | 3 | 4 | 4 |
| exit | `hr_exit_db` | 11 | 1 | 1 | 0 | 2 | 2 | 5 |
| holiday | `hr_holiday_db` | 6 | 0 | 0 | 0 | 2 | 2 | 1 |
| leave | `hr_leave_db` | 14 | 2 | 1 | 1 | 3 | 3 | 0 |
| notification | `hr_notification_db` | 8 | 0 | 0 | 0 | 2 | 1 | 0 |
| organization | `hr_organization_db` | 11 | 0 | 0 | 1 | 2 | 3 | 4 |
| payroll | `hr_payroll_db` | 17 | 2 | 1 | 1 | 4 | 4 | 8 |
| performance | `hr_performance_db` | 13 | 0 | 0 | 0 | 2 | 4 | 5 |
| project | `hr_project_db` | 8 | 0 | 1 | 1 | 2 | 3 | 4 |
| reporting | `hr_reporting_db` | 5 | 0 | 0 | 2 | 2 | 1 | 0 |
| tax | `hr_tax_db` | 12 | 0 | 0 | 0 | 2 | 3 | 4 |
| timesheet | `hr_timesheet_db` | 8 | 0 | 1 | 1 | 2 | 2 | 2 |

The numbers are parsed from the migration files (triggers counted by name; the employee status trigger exists in V3 and again, corrected to UTC, in V4). Overall: 155 tables, 8 functions, 6 procedures, 9 views, 38 CHECK constraints, 44 foreign keys.

## 3. Tables per service

**attendance** (`hr_attendance_db`): `approved_leave_days`, `attendance_corrections`, `attendance_employees`, `attendance_records`, `audit_history`, `holiday_snapshots`, `monthly_attendance_summary`, `outbox_events`, `processed_events`, `shift_assignments`, `shifts`, `wfh_requests`

**auth** (`hr_auth_db`): `audit_history`, `outbox_events`, `password_reset_tokens`, `permissions`, `processed_events`, `refresh_tokens`, `role_permissions`, `roles`, `user_accounts`, `user_roles`

**document** (`hr_document_db`): `audit_history`, `document_categories`, `document_history`, `document_permissions`, `documents`, `outbox_events`, `processed_events`

**employee** (`hr_employee_db`): `audit_history`, `emergency_contacts`, `employee_addresses`, `employee_bank_details`, `employee_education`, `employee_experience`, `employee_sequence`, `employee_status_history`, `employees`, `employment_history`, `outbox_events`, `processed_events`, `profile_change_log`

**exit** (`hr_exit_db`): `audit_history`, `exit_history`, `exit_interview_forms`, `exit_interviews`, `exit_policy`, `exit_tasks`, `outbox_events`, `processed_events`, `resignations`, `settlement_lines`, `settlements`

**holiday** (`hr_holiday_db`): `audit_history`, `holiday_scopes`, `holiday_years`, `holidays`, `outbox_events`, `processed_events`

**leave** (`hr_leave_db`): `audit_history`, `leave_applications`, `leave_approvals`, `leave_attachments`, `leave_balance_history`, `leave_balances`, `leave_comments`, `leave_employees`, `leave_policies`, `leave_policy_entitlements`, `leave_run_log`, `leave_types`, `outbox_events`, `processed_events`

**notification** (`hr_notification_db`): `audit_history`, `email_settings`, `employee_contacts`, `event_history`, `notification_templates`, `notifications`, `outbox_events`, `processed_events`

**organization** (`hr_organization_db`): `audit_history`, `business_units`, `departments`, `designations`, `job_grades`, `locations`, `org_employee_nodes`, `organizations`, `outbox_events`, `processed_events`, `reporting_lines`

**payroll** (`hr_payroll_db`): `audit_history`, `employee_salaries`, `loan_deductions`, `loans`, `outbox_events`, `payroll_adjustments`, `payroll_config`, `payroll_entries`, `payroll_entry_lines`, `payroll_runs`, `payslips`, `processed_events`, `salary_components`, `salary_revision_history`, `salary_revisions`, `salary_structure_components`, `salary_structures`

**performance** (`hr_performance_db`): `audit_history`, `evaluation_forms`, `feedback`, `form_questions`, `goals`, `key_results`, `outbox_events`, `perf_employees`, `performance_reviews`, `processed_events`, `review_answers`, `review_cycles`, `review_history`

**project** (`hr_project_db`): `audit_history`, `customer_contacts`, `customers`, `outbox_events`, `processed_events`, `project_allocations`, `project_history`, `projects`

**reporting** (`hr_reporting_db`): `audit_history`, `outbox_events`, `processed_events`, `rpt_employees`, `rpt_facts`

**tax** (`hr_tax_db`): `audit_history`, `investment_declarations`, `monthly_tds`, `outbox_events`, `processed_events`, `tax_computations`, `tax_declaration_history`, `tax_declarations`, `tax_documents`, `tax_employees`, `tax_proofs`, `tax_rules`

**timesheet** (`hr_timesheet_db`): `audit_history`, `outbox_events`, `processed_events`, `timesheet_employees`, `timesheet_entries`, `timesheet_history`, `timesheet_tasks`, `timesheets`

## 4. Relationships worth knowing
| Relationship | How |
|---|---|
| employee 1-1 bank details, 1-N addresses / contacts / education / experience / history | FKs in employee DB (`employee_id`), cascades via JPA `orphanRemoval` |
| department tree | self reference `parent_id` in organization DB; recursive CTE reads the chain |
| leave type → policy entitlements → balances | `leave_policy_entitlements` composite key (policy, leave type), `leave_balances` composite key (employee, type, year) |
| payroll run → entries → lines | `payroll_runs` 1-N `payroll_entries` 1-N `payroll_entry_lines`; FKs with the run |
| salary structure ↔ components | `salary_structure_components` join with calculation type and value |
| resignation → tasks / interview / settlement → lines | FKs in exit DB; tasks share one table (`exit_tasks`, discriminator `task_type`) |
| review cycle → forms → questions; review → answers | FKs in performance DB |
| employee ↔ employee in other services | **UUID only** (`employee_id`), no FK; each service keeps a small read model of the employees it needs |

## 4b. Reporting fact table (`rpt_facts`)
One row per business fact received through Kafka; `(fact_type, subject_key)` is unique so replays and status changes are upserts. The generic measure columns mean:

| fact_type | subject_key | category | num_a | num_b | num_c | date_a / date_b | period_key |
|---|---|---|---|---|---|---|---|
| LEAVE | application id | leave type | days | - | - | from / to | month of `from` |
| ATTENDANCE | employee:date | work mode | worked minutes | late minutes | overtime minutes | date | month |
| PAYROLL | run:employee | - | gross | deductions | net | - | payroll month |
| TAX | declaration id | regime | total declared | - | - | - | financial year |
| TIMESHEET | timesheet id | - | total hours | billable hours | - | week start | month of week |
| REVIEW | review id | stage | self rating | manager rating | final rating | - | cycle id |
| EXIT | resignation id | reason (60 chars) | notice days | - | - | last working day | month of last day |
| ALLOCATION | employee:project | project name | allocation % | - | - | start / end | project id |

Status ranks protect against out-of-order events: an event whose status ranks lower than the stored one never overwrites it.

## 5. Stored functions (all `DETERMINISTIC NO SQL`)
| Function | Service | Purpose |
|---|---|---|
| `fn_working_days(p_from DATE, p_to DATE) RETURNS INT` | leave, attendance | Monday-Friday days between two dates, inclusive |
| `fn_leave_duration(p_from, p_to, p_half_start, p_half_end, p_holidays) RETURNS DECIMAL(5,1)` | leave | weekdays minus holidays that fall on weekdays, minus the half-day halves |
| `fn_employee_tenure_months(p_joining, p_as_of) RETURNS INT` | employee, exit | completed months of service |
| `fn_overtime_minutes(p_worked, p_standard, p_threshold) RETURNS INT` | attendance | `worked - standard` when worked exceeds standard + threshold, else 0 |
| `fn_salary_component(p_base, p_percent, p_fixed) RETURNS DECIMAL(14,2)` | payroll | `fixed + base * percent / 100` |
| `fn_overtime_pay(p_minutes, p_hourly_rate, p_multiplier) RETURNS DECIMAL(14,2)` | payroll | overtime amount |

## 6. Stored procedures (all `SQL SECURITY INVOKER`)
| Procedure | Service | What it does | Called from |
|---|---|---|---|
| `sp_calculate_leave_balance(employee, year)` | leave | reconciles the recorded balance figures against the application ledger (read-only, returns a result set) | `SimpleJdbcCall` in `LeaveBalanceService` |
| `sp_monthly_attendance_summary(employee, year, month, location)` | attendance | classifies every day of the month (precedence: worked > holiday > weekly off > approved leave > absent > not applicable), upserts `monthly_attendance_summary` and returns it | plain JDBC `CallableStatement` in `AttendanceJdbc` |
| `sp_employee_allocation_summary(employee, on_date)` | project | every live allocation of the employee on a date with its project | `SimpleJdbcCall` in `AllocationSummaryService` |
| `sp_timesheet_summary(employee, from, to)` | timesheet | APPROVED hours per project (total / billable) in a period | `SimpleJdbcCall` in `TimesheetReportService` |
| `sp_process_monthly_payroll(run, user)` | payroll | inside the caller's transaction: re-aggregates entry totals from the lines, applies loan recoveries and adjustments, marks the run PROCESSED; refuses runs that are not DRAFT | `PayrollRunService` (`jdbc.update("CALL sp_process_monthly_payroll(?, ?)", ...)`) |
| `sp_exit_settlement_summary(resignation)` | exit | re-aggregates settlement earnings / recoveries / net from the lines, returns tenure months and notice shortfall; the entity is `refresh`ed afterwards because the row changed behind the persistence context | `SimpleJdbcCall` in `SettlementService` |

## 7. Views (all `SQL SECURITY INVOKER`)
`vw_employee_directory`, `vw_employee_department_details`, `vw_employee_salary_summary`, `vw_monthly_attendance_summary`, `vw_employee_leave_summary`, `vw_project_employee_allocation`, `vw_timesheet_summary`, `vw_headcount_by_department`, `vw_leave_utilization` (see `mysql-advanced-guide`).

## 8. Triggers
| Trigger | Table | Effect |
|---|---|---|
| `trg_audit_history_no_update` / `_no_delete` (every DB) | `audit_history` | `SIGNAL SQLSTATE '45000'` - audit rows can never change |
| `trg_employee_status_history` | `employees` | row in `employee_status_history` when `status` changes |
| `trg_leave_balance_history` | `leave_balances` (AFTER UPDATE) | when any balance figure changes, writes old / new accrued, used, pending, carried, encashed into `leave_balance_history` |
| `trg_salary_history_insert` / `_update` | `employee_salaries` | row in `salary_revision_history` |

## 9. Constraints (examples, all in the V3 migrations)
CHECK: `chk_leave_dates` (to >= from), `chk_leave_days` (days > 0), `chk_balance_non_negative`, `chk_alloc_percent` (1-100), `chk_entry_hours` (0-24), `chk_timesheet_hours` (billable <= total), `chk_salary_ctc` (> 0), `chk_loan_amounts`, `chk_review_ratings` (1-5), `chk_goal_progress` (0-100), `chk_resignation_dates` (last day after submission), `chk_employee_notice_period` (0-365), `chk_grade_salary_range` (min <= max), `chk_shift_thresholds`, `chk_attendance_punches` (out >= in), `chk_rule_cess` (0-100).
UNIQUE: employee code and work email, username / email / employee link of a user account, `uk_attendance_employee_date`, `uk_summary_employee_month`, `uk_tds_employee_month`, `uk_declaration_employee_fy`, `uk_tax_rule_fy_regime`, `uk_settlement_resignation`, `uk_interview_resignation`, `uk_holiday_year`, catalog `code` columns, and `uk_processed_event_consumer (event_id, consumer)` in every service. Indexes (`idx_*`) cover each foreign / lookup column used by the repositories.

## 10. Seed data
Auth `V3`: roles + permissions + role-permission mapping (no users). Notification `V3`: ~45 templates + default email settings (LOG mode). Leave / holiday / organization / payroll / tax / exit / performance seed their *catalogs* (leave types, salary components, sample statutory config and tax rules, exit policy, default forms) so a fresh install works; **statutory values are samples to be verified before production**.

## 11. Migration operations
* Normal start: Flyway migrates pending versions.
* `HR_FLYWAY_REPAIR=true` (dev): removes FAILED entries then migrates.
* `HR_FLYWAY_RESET=true` with `SPRING_FLYWAY_CLEAN_DISABLED=false` (dev only, destroys that service's data): `flyway clean` + migrate.
* Never edit an applied migration; add a new `Vn`. (The employee trigger fix is `V4`.)

