# Business Workflows

Every workflow is an explicit state machine in a service class: each transition is validated (`BadRequestException` for an illegal one), audited (`audit_history`), recorded in the domain history table, published as an event (outbox) and notified (`notification.requested`). Roles are in `security`; event flows in `kafka/202611251532-event-flows.md`. Base path: `http://localhost:9080` (gateway).

## 1. Onboarding and account provisioning
```
HR_ADMIN  POST /api/v1/employees  ─► employee-service: validate department / designation / location / grade (Feign → organization),
                                      generate code EMP00001 (row lock), save (+ bank details encrypted), outbox employee.created
employee.created ─► auth-service      create login (username = lower-case employee code, EMPLOYEE role, random unknown password, mustChangePassword=true; the employee sets the first password through forgot-password) + notification (ACCOUNT_PROVISIONED)
                 ─► organization       org chart node;   leave / attendance / tax / timesheet / performance / reporting read models
                 ─► notification       welcome message
```
Statuses: `ACTIVE → ON_NOTICE → RESIGNED | TERMINATED`, `INACTIVE` (`employee_status_history` trigger records each change). Manager / department / designation changes publish `employee.updated`; promotions and transfers are written to `employment_history`.

## 2. Authentication
Login → (5 failures in 15 min lock the account for 15 min) → access token 30 min + rotating refresh token → logout / password change revokes the token id in Redis. First login with `mustChangePassword=true` allows only change-password until done. Forgot-password issues a single-use 30-minute token (returned in the response only when `HR_EXPOSE_RESET_TOKEN=true`, otherwise sent by notification).

## 3. Leave
`PENDING → APPROVED | REJECTED | WITHDRAWN`, and `APPROVED → CANCELLED` through an approved cancellation request.
```
Employee  POST /api/v1/leaves/applications      validates: dates (@ValidDateRange), no overlap (@NoLeaveOverlap), eligibility, holidays (Holiday service via WebClient),
                                                balance (row locked FOR UPDATE; Redis lock per employee)  → days RESERVED (pending)
Manager   POST .../{id}/approve | reject         approval stage MANAGER (only the employee's manager or HR)
HR        POST .../{id}/approve                  needed when the type requires HR approval or days > policy threshold (stage HR → COMPLETE)
          approval → pending becomes USED, leave.approved → attendance marks the days ON_LEAVE;  rejection / withdrawal releases the days
Employee  POST .../{id}/cancel                   approved leave: cancellation REQUEST → manager/HR  .../cancellation/approve | reject → days returned, leave.cancelled
```
Other: monthly accrual and yearly carry-forward runs (idempotent, Redis lock, `leave_run_log`), encashment, manual balance adjustments (audited), balance history by trigger, team / company leave calendar, unpaid days exposed to payroll.
*Expected:* applying for 2 days of Casual Leave with 12 available → balance `pending 2`; manager approves → `used 2, pending 0`; `GET /api/v1/leaves/balances/me` shows it; an overlapping second request → `400` "Leave overlaps with an existing application".

## 4. Attendance
Check-in / check-out (`POST /api/v1/attendance/check-in|check-out`) apply shift rules (grace, late minutes, early departure, overtime via `fn_overtime_minutes`); status `PRESENT / HALF_DAY / ABSENT / MISSING_PUNCH`. Daily job marks missing punches. **Correction:** employee requests → manager approves/rejects (`PENDING → APPROVED | REJECTED | CANCELLED`); a request unreviewed for 48 h is escalated by the `DelayQueue` worker and reminds the manager. **WFH:** request → approval. Bulk punch import through the bounded queue. Monthly summary by stored procedure (holidays, weekly offs, approved leave, absences). Events: `attendance.checked-in/out/corrected`.

## 5. Holidays
HR defines holiday years and holidays (type MANDATORY / OPTIONAL / RESTRICTED) with optional location / department scopes; any change publishes `holiday.changed` → attendance refreshes its snapshot so holidays are never counted absent; leave duration excludes holiday weekdays.

## 6. Payroll (maker-checker)
`DRAFT → PROCESSED → APPROVED → FINALIZED`
```
PAYROLL_ADMIN  POST /api/v1/payroll/runs                         create run for a month (one per month)
PAYROLL_ADMIN  POST /api/v1/payroll/runs/{id}/process            gather data concurrently for every employee: employee (Feign), attendance (Feign), unpaid leave (Feign), TDS (WebClient)
                                                                 → engine: loss-of-pay ratio, earnings by structure (strategy per calc type), overtime, adjustments,
                                                                   PF, professional tax, TDS (capped at available pay), loan EMIs
                                                                 → ALL employees must succeed, otherwise 400 with per-employee reasons and NOTHING is stored
                                                                 → one transaction: entries + lines (batch insert), loan deductions, sp_process_monthly_payroll (totals, loan balances)
FINANCE_ADMIN  POST /api/v1/payroll/runs/{id}/approve            must be a different person than the processor (maker-checker, else 403)
FINANCE_ADMIN  POST /api/v1/payroll/runs/{id}/finalize           publishes payroll.processed, generates PDF payslips (OpenPDF), payslip.generated → Document service
```
Salary structures and components are data (`salary_components`, `salary_structures`), employee salary revisions go `PENDING → APPROVED | REJECTED` with trigger-written history, loans (`ACTIVE → CLOSED` when the balance reaches zero), one-off adjustments (bonus, arrears, reimbursement, allowance, deduction, final settlement). Statutory parameters live in `payroll_config` - **sample values; verify before production**. Employees read their own payslips (`/api/v1/payroll/payslips/me`).

## 7. Tax
`DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED | REJECTED` (rejected declarations can be edited and resubmitted).
Employee declares investments (`DECLARED → PROOF_SUBMITTED → VERIFIED | REJECTED`) with proofs referencing documents; finance starts review, approves / rejects with comments (`tax.declaration.submitted/reviewed`). The annual computation uses `tax_rules` (slabs per financial year and regime OLD / NEW, cess), the monthly TDS = (annual tax − TDS already deducted) / months remaining and is read by payroll through `/api/v1/tax/monthly-tds`. Form 16 / statements are registered in `tax_documents`. A weekly reminder (Redis-locked) nudges employees with pending declarations. **Slabs are samples.**

## 8. Performance
Cycle `DRAFT → ACTIVE → CLOSED` (types ANNUAL, HALF_YEARLY, QUARTERLY, PROBATION). Review `SELF_PENDING → SELF_SUBMITTED → MANAGER_SUBMITTED → APPROVED`: employee self-evaluation (draft saves + submit), manager evaluation, HR approval; any stage can be **returned** with a comment. Forms are configurable (rating / text questions with weights → weighted score next to the manual rating). Goals / OKRs with key results (progress rolls up), manager and peer feedback (peer authors hidden from the subject), daily reminders before deadlines. Events: `performance.review.submitted/approved`.

## 9. Projects and timesheets
Customers and contacts → projects (`PLANNED → ACTIVE → ON_HOLD → COMPLETED | CANCELLED`, billing model) → allocations (`ACTIVE → ENDED`); the sweep-line check refuses a total above 100 % at any date and `@AllocationPercent` allows 5-100 in steps of 5.
Timesheet week `DRAFT → SUBMITTED → APPROVED | REJECTED` (rejected can be edited and resubmitted; approved can be **reopened** for correction). Entries are validated against the employee's allocation on that day (Feign → project), duplicates, ≤ 24 h per day and weekly limits; week start must be a Monday within 12 weeks. Events: `timesheet.submitted/approved`.

## 10. Exit
`SUBMITTED → MANAGER_APPROVED | MANAGER_REJECTED → HR_CONFIRMED → CLEARED → INTERVIEW_DONE → SETTLEMENT_PENDING → COMPLETED` (`WITHDRAWN` allowed before completion).
1. Employee `POST /api/v1/exit/resignations` (notice period from the employee record; `resignation.submitted` → status ON_NOTICE).
2. Manager decision. 3. HR confirms the last working day (notice waiver up to the policy maximum) → exit checklist generated: clearances, checklist, knowledge transfer, asset return, access revocation tasks (single-table inheritance).
4-5. Tasks completed → status `CLEARED` automatically. 6. Exit interview recorded.
7. Settlement: calculate - payroll salary facts, active loans and leave encashable days are fetched in parallel (`Mono.zip`); lines: pending salary for the worked days, leave encashment, notice-period recovery for the shortfall, loan recovery; totals by `sp_exit_settlement_summary` → `CALCULATED`; process → `PAID` (`settlement.processed` → payroll).
8. HR completes → `employee.exited`: employee `RESIGNED` / `TERMINATED` (by exit type), login disabled and sessions revoked, allocations ended, org chart node closed, read models updated, reports updated.

## 11. Documents
Upload (allow-listed extension **and** content sniffing, size limit) → versioning by title + category → `UPLOADED → VERIFIED → APPROVED | REJECTED` by HR; category policy marks sensitive categories (`is_sensitive`); access = owner, HR, or an explicit permission (employee or role, VIEW / DOWNLOAD); every download is logged in `document_history`; expiry reminders daily; payslips and tax documents are registered automatically from events (source PAYSLIP / TAX).

## 12. Notifications
Any service publishes `notification.requested` (template code + params + channels + dedup key) → template rendered → in-app row (+ unread count, mark read) → e-mail through the bounded queue (`LOG` mode writes the message to the log; `SMTP` mode sends) → statuses `PENDING → SENT | FAILED | SKIPPED`; duplicates dropped by Redis `SETNX` on the dedup key; failures retried through retry topics then DLT; templates and e-mail settings editable via API (SMTP password from `SMTP_PASSWORD`).

## 13. Reporting and dashboards
Kafka-maintained fact tables (`rpt_facts`, `rpt_employees`) → 12 reports (headcount, joining / exit, leave, attendance, payroll cost, tax, timesheet, performance, exits, allocation ...), workforce analytics (streams), executive summary (`CompletableFuture`), employee and manager dashboards (nine concurrent WebClient sections with per-section fallback).
