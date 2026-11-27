# Microservices

Every service: Spring Boot 3.4, port in `application.yml`, own Flyway-managed database, Swagger UI at `/swagger-ui.html`, liveness at `/ping`, raw servlet at `/servlet/info`.

| # | Service | Port | Owns (main tables) | Calls | Publishes | Consumes |
|---|---|---|---|---|---|---|
| 1 | **hr-api-gateway** | 9080 | - | all services (routing) | - | - |
| 2 | **hr-auth-service** | 9101 | `password_reset_tokens`, `permissions`, `refresh_tokens`, `role_permissions`, `roles`, `user_accounts`, `user_roles` | - | `notification.requested` | `employee.created/terminated/exited` |
| 3 | **hr-employee-service** | 9102 | `emergency_contacts`, `employee_addresses`, `employee_bank_details`, `employee_education`, `employee_experience`, `employee_sequence`, `employee_status_history`, `employees`, `employment_history`, `profile_change_log` | Organization (Feign) | `employee.created/updated/terminated` | `resignation.submitted`, `employee.exited` |
| 4 | **hr-organization-service** | 9103 | `business_units`, `departments`, `designations`, `job_grades`, `locations`, `org_employee_nodes`, `organizations`, `reporting_lines` | - | - | `employee.*` |
| 5 | **hr-leave-service** | 9104 | `leave_applications`, `leave_approvals`, `leave_attachments`, `leave_balance_history`, `leave_balances`, `leave_comments`, `leave_employees`, `leave_policies`, `leave_policy_entitlements`, `leave_run_log`, `leave_types` | Employee (Feign), Holiday (WebClient) | `leave.applied/approved/rejected/cancelled` | `employee.*` |
| 6 | **hr-attendance-service** | 9105 | `approved_leave_days`, `attendance_corrections`, `attendance_employees`, `attendance_records`, `holiday_snapshots`, `monthly_attendance_summary`, `shift_assignments`, `shifts`, `wfh_requests` | Holiday, Employee (Feign) | `attendance.checked-in/out/corrected` | `leave.approved/cancelled`, `holiday.changed`, `employee.*` |
| 7 | **hr-holiday-service** | 9106 | `holiday_scopes`, `holiday_years`, `holidays` | - | `holiday.changed` | - |
| 8 | **hr-payroll-service** | 9107 | `employee_salaries`, `loan_deductions`, `loans`, `payroll_adjustments`, `payroll_config`, `payroll_entries`, `payroll_entry_lines`, `payroll_runs`, `payslips`, `salary_components`, `salary_revision_history`, `salary_revisions`, `salary_structure_components`, `salary_structures` | Employee, Attendance, Leave (Feign), Tax (WebClient) | `payroll.processed`, `payslip.generated` | `settlement.processed` |
| 9 | **hr-tax-service** | 9108 | `investment_declarations`, `monthly_tds`, `tax_computations`, `tax_declaration_history`, `tax_declarations`, `tax_documents`, `tax_employees`, `tax_proofs`, `tax_rules` | Payroll (WebClient) | `tax.declaration.submitted/reviewed` | `employee.*` |
| 10 | **hr-performance-service** | 9109 | `evaluation_forms`, `feedback`, `form_questions`, `goals`, `key_results`, `perf_employees`, `performance_reviews`, `review_answers`, `review_cycles`, `review_history` | - | `performance.review.submitted/approved` | `employee.*` |
| 11 | **hr-project-service** | 9110 | `customer_contacts`, `customers`, `project_allocations`, `project_history`, `projects` | Employee (Feign) | `project.allocation.changed` | `employee.exited/terminated` |
| 12 | **hr-timesheet-service** | 9111 | `timesheet_employees`, `timesheet_entries`, `timesheet_history`, `timesheet_tasks`, `timesheets` | Project (Feign) | `timesheet.submitted/approved` | `employee.*` |
| 13 | **hr-exit-service** | 9112 | `exit_history`, `exit_interview_forms`, `exit_interviews`, `exit_policy`, `exit_tasks`, `resignations`, `settlement_lines`, `settlements` | Employee (Feign), Payroll + Leave (WebClient) | `resignation.submitted`, `employee.exited`, `settlement.processed` | - |
| 14 | **hr-document-service** | 9113 | `document_categories`, `document_history`, `document_permissions`, `documents` | - | - | `payslip.generated` |
| 15 | **hr-notification-service** | 9114 | `email_settings`, `employee_contacts`, `event_history`, `notification_templates`, `notifications` | - | - | `notification.requested` + all business topics (history) |
| 16 | **hr-reporting-service** | 9115 | `rpt_employees`, `rpt_facts` | WebClient to every service for dashboards | - | 20 business topics |

Every service also owns `audit_history`, `outbox_events`, `processed_events` (not repeated in the table). Tables are listed exactly as created by each service's Flyway `V1` migration.

## Gateway
Spring Cloud Gateway: routes `/api/v1/auth|employees|organization|leaves|attendance|holidays|payroll|tax|performance|projects|customers|timesheets|exit|documents|notifications|reports|dashboard/**`; JWT validation + Redis revocation; role rules per path; CORS; correlation id; access log; `RequestRateLimiter` (Redis, per user / IP); JSON error handler; OpenAPI aggregation at `/swagger-ui.html`.

## Service notes

**Auth** - registration / provisioning (also automatic from `employee.created`), login (BCrypt, lockout after 5 failures through a Redis counter), JWT access token (30 min) + rotating refresh token (hash stored in MySQL and Redis), logout (jti revocation), password change / reset (token in Redis, 30 min), role and permission management, employee-to-account mapping, session revocation (Redis sorted set of live jtis).

**Employee** - onboarding with code generator (`EMP00001`, pessimistic lock), profile + sub-resources, search with JPA `Specification`, directory (projection + Redis cache), manager / transfer / promotion changes, status machine, field-level change log (reflection diff), optimistic locking, encrypted PAN / bank details.

**Organization** - master data (organization, business units, departments tree, designations, grades, locations) + an event-fed **org chart** (recursive CTE for chains, window function for headcount ranking).

**Leave** - 8 leave types, policy with entitlements (composite key), balances (embedded id, pessimistic lock), apply / update / withdraw / cancel / manager + HR approval, accrual and carry-forward runs (idempotent), calendars, unpaid-days endpoint for payroll, SQL functions for duration, trigger-based balance history, reconciliation procedure.

**Attendance** - check-in / out with shift rules, late / early / overtime (SQL function), corrections (DelayQueue escalation, PriorityQueue ordering), WFH, bulk punch import (BlockingQueue producer / consumer), missing-punch job, monthly summary procedure called with plain JDBC `CallableStatement`, parallel team report.

**Holiday** - holiday calendar with location / department scopes (embeddable collection), year configuration, range / upcoming / calendar APIs (Redis cached), `holiday.changed` events.

**Payroll** - configurable engine (strategy per calculation type), concurrent data gathering (Feign + WebClient + `CompletableFuture`), maker-checker workflow, stored procedure for totals / loans / adjustments, OpenPDF payslips, salary revisions with trigger history, loans, adjustments, reports.

**Tax** - rules per financial year and regime, declaration workflow with proofs and reviewer decisions, annual computation, monthly TDS for payroll, statements, Form 16 registry, weekly reminders.

**Performance** - configurable forms, cycles, 3-stage review (self → manager → HR) with returns, weighted scores, goals / OKRs with key-result roll-up, manager / peer feedback (peer authors hidden), reports, reminders.

**Project** - customers and contacts, projects with status machine, allocations validated by a sweep-line peak-load check (never > 100 %), history, allocation check API for timesheets, allocation summary procedure.

**Timesheet** - weekly / daily entry validated against project allocation (Feign), duplicates and daily / weekly limits, submit / approve / reject / resubmit / reopen, summaries (procedure + JPQL aggregate).

**Exit** - 8-step workflow state machine, checklist as polymorphic tasks, exit interview, settlement (three services queried in parallel with `Mono.zip`, totals by procedure), `employee.exited` closing the loop.

**Document** - allow-listed + content-sniffed uploads, versioning, verification workflow, category access policy + per-document permissions, every download recorded, expiry reminders, payslip registration from events.

**Notification** - template rendering, in-app inbox + e-mail (bounded queue + workers), Redis de-duplication, retry topics, event history, Kafka topic information API, configurable e-mail settings.

**Reporting** - Kafka-maintained fact tables, 12 reports, streams-based workforce analytics, executive summary (`CompletableFuture`), employee and manager dashboards (WebClient, 9 sections concurrently).
