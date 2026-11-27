# API Documentation

All calls go through the gateway (`http://localhost:9080`) with `Authorization: Bearer <access token>`, except login / forgot / reset. Errors share one JSON shape (`ApiError`: timestamp, status, error, code, message, path, correlationId, fieldErrors). Pagination: `page`, `size` (max 100) and `sort=field,dir` (sort fields are allow-listed per endpoint); list endpoints return `PageResponse` (content, page, size, totalElements, totalPages). Interactive docs: `/swagger-ui.html` on the gateway (all services) or on each service port; raw specs at `/docs/<service>/v3/api-docs`.

This list is generated from each service's live OpenAPI specification.

Total: **410** endpoints across 15 services (plus gateway, `/ping`, `/servlet/info` and `/api/v1/<area>/audit` on every service).


## Auth service (24 endpoints)

| Method | Path | Operation | Group |
|---|---|---|---|
| GET | `/api/v1/auth/audit` | search_1 | Audit History |
| POST | `/api/v1/auth/change-password` | Change own password (revokes all sessions) | Authentication |
| POST | `/api/v1/auth/forgot-password` | Start the password reset workflow (always answers 202, never reveals whether the e-mail exists) | Authentication |
| POST | `/api/v1/auth/login` | Login with username + password; returns access and refresh tokens | Authentication |
| POST | `/api/v1/auth/logout` | Logout: revokes the refresh token and the current access token | Authentication |
| GET | `/api/v1/auth/me` | Current user profile, roles and permissions | Authentication |
| GET | `/api/v1/auth/permissions` | permissions | Roles and Permissions |
| POST | `/api/v1/auth/permissions` | createPermission | Roles and Permissions |
| POST | `/api/v1/auth/refresh` | Exchange a refresh token for a new token pair (rotation) | Authentication |
| POST | `/api/v1/auth/register` | Provision a user account (HR / super admin) | Authentication |
| POST | `/api/v1/auth/reset-password` | Complete the password reset with the e-mailed token | Authentication |
| GET | `/api/v1/auth/roles` | roles_1 | Roles and Permissions |
| POST | `/api/v1/auth/roles` | createRole | Roles and Permissions |
| PUT | `/api/v1/auth/roles/{id}/permissions` | setPermissions | Roles and Permissions |
| GET | `/api/v1/auth/users` | Search users (paged, sortable allowlist) | User Administration |
| GET | `/api/v1/auth/users/by-employee/{employeeId}` | Employee-to-user account lookup | User Administration |
| GET | `/api/v1/auth/users/{id}` | get | User Administration |
| PUT | `/api/v1/auth/users/{id}/employee-mapping` | map | User Administration |
| POST | `/api/v1/auth/users/{id}/reset-password` | reset | User Administration |
| POST | `/api/v1/auth/users/{id}/revoke-sessions` | Invalidate every live session / token of the user | User Administration |
| PUT | `/api/v1/auth/users/{id}/roles` | roles | User Administration |
| PATCH | `/api/v1/auth/users/{id}/status` | Activate / deactivate an account | User Administration |
| POST | `/api/v1/auth/users/{id}/unlock` | unlock | User Administration |
| GET | `/ping` | ping | ping-controller |

## Employee service (39 endpoints)

| Method | Path | Operation | Group |
|---|---|---|---|
| GET | `/api/v1/employees` | Search / filter / sort / paginate employees | Employees |
| POST | `/api/v1/employees` | Onboard a new employee (HR) | Employees |
| GET | `/api/v1/employees/analytics/headcount` | Headcount by department and status (Criteria API) | Employee Directory |
| GET | `/api/v1/employees/analytics/span-of-control` | Managers ranked by number of active direct reports | Employee Directory |
| GET | `/api/v1/employees/audit` | search_1 | Audit History |
| GET | `/api/v1/employees/directory` | Company directory (non-sensitive columns only; cached in Redis) | Employee Directory |
| GET | `/api/v1/employees/directory/grouped` | Directory grouped alphabetically with status counts | Employee Directory |
| POST | `/api/v1/employees/lookup` | Bulk summaries by id (used by other microservices) | Employees |
| GET | `/api/v1/employees/me` | My own profile | Employees |
| PUT | `/api/v1/employees/me/contact` | Update my own contact details (self service) | Employees |
| GET | `/api/v1/employees/{employeeId}/addresses` | addresses | Employee Details |
| POST | `/api/v1/employees/{employeeId}/addresses` | addAddress | Employee Details |
| PUT | `/api/v1/employees/{employeeId}/addresses/{id}` | updateAddress | Employee Details |
| DELETE | `/api/v1/employees/{employeeId}/addresses/{id}` | deleteAddress | Employee Details |
| GET | `/api/v1/employees/{employeeId}/bank-details` | bank | Employee Details |
| PUT | `/api/v1/employees/{employeeId}/bank-details` | saveBank | Employee Details |
| GET | `/api/v1/employees/{employeeId}/education` | education | Employee Details |
| POST | `/api/v1/employees/{employeeId}/education` | addEducation | Employee Details |
| PUT | `/api/v1/employees/{employeeId}/education/{id}` | updateEducation | Employee Details |
| DELETE | `/api/v1/employees/{employeeId}/education/{id}` | deleteEducation | Employee Details |
| GET | `/api/v1/employees/{employeeId}/emergency-contacts` | contacts | Employee Details |
| POST | `/api/v1/employees/{employeeId}/emergency-contacts` | addContact | Employee Details |
| PUT | `/api/v1/employees/{employeeId}/emergency-contacts/{id}` | updateContact | Employee Details |
| DELETE | `/api/v1/employees/{employeeId}/emergency-contacts/{id}` | deleteContact | Employee Details |
| GET | `/api/v1/employees/{employeeId}/employment-history` | employmentHistory | Employee Details |
| GET | `/api/v1/employees/{employeeId}/experience` | experience | Employee Details |
| POST | `/api/v1/employees/{employeeId}/experience` | addExperience | Employee Details |
| PUT | `/api/v1/employees/{employeeId}/experience/{id}` | updateExperience | Employee Details |
| DELETE | `/api/v1/employees/{employeeId}/experience/{id}` | deleteExperience | Employee Details |
| GET | `/api/v1/employees/{employeeId}/profile-history` | profileHistory | Employee Details |
| GET | `/api/v1/employees/{employeeId}/status-history` | statusHistory | Employee Details |
| GET | `/api/v1/employees/{id}` | Employee profile: allowed for the employee, their manager and HR / payroll / finance | Employees |
| PUT | `/api/v1/employees/{id}` | Update profile fields (HR) - partial update with optimistic locking | Employees |
| PATCH | `/api/v1/employees/{id}/manager` | Assign / change the reporting manager | Employees |
| PATCH | `/api/v1/employees/{id}/status` | Change employment status (ACTIVE, INACTIVE, ON_NOTICE, RESIGNED, TERMINATED) | Employees |
| GET | `/api/v1/employees/{id}/summary` | Non-sensitive employee summary (used by other microservices) | Employees |
| GET | `/api/v1/employees/{id}/team` | Direct reports of a manager | Employees |
| PATCH | `/api/v1/employees/{id}/transfer` | Transfer / promote: department, designation, location, job grade | Employees |
| GET | `/ping` | ping | ping-controller |

## Organization service (40 endpoints)

| Method | Path | Operation | Group |
|---|---|---|---|
| GET | `/api/v1/organization/audit` | search | Audit History |
| GET | `/api/v1/organization/business-units` | list_5 | Business Units |
| POST | `/api/v1/organization/business-units` | create_5 | Business Units |
| GET | `/api/v1/organization/business-units/{id}` | get_5 | Business Units |
| PUT | `/api/v1/organization/business-units/{id}` | update_5 | Business Units |
| DELETE | `/api/v1/organization/business-units/{id}` | delete_5 | Business Units |
| GET | `/api/v1/organization/chart` | Organization chart of the whole company as a hierarchy | Organization Structure |
| GET | `/api/v1/organization/chart/{employeeId}` | Organization chart below one employee | Organization Structure |
| GET | `/api/v1/organization/departments` | list_4 | Departments |
| POST | `/api/v1/organization/departments` | create_4 | Departments |
| GET | `/api/v1/organization/departments/headcount` | Headcount per department ranked with a SQL window function | Organization Structure |
| GET | `/api/v1/organization/departments/tree` | Department hierarchy with active headcount | Organization Structure |
| GET | `/api/v1/organization/departments/{id}` | get_4 | Departments |
| PUT | `/api/v1/organization/departments/{id}` | update_4 | Departments |
| DELETE | `/api/v1/organization/departments/{id}` | delete_4 | Departments |
| GET | `/api/v1/organization/departments/{id}/employees` | Employees of a department (read model fed by employee events) | Organization Structure |
| PUT | `/api/v1/organization/departments/{id}/head` | Assign the head (manager) of a department | Organization Structure |
| GET | `/api/v1/organization/designations` | list_3 | Designations |
| POST | `/api/v1/organization/designations` | create_3 | Designations |
| GET | `/api/v1/organization/designations/{id}` | get_3 | Designations |
| PUT | `/api/v1/organization/designations/{id}` | update_3 | Designations |
| DELETE | `/api/v1/organization/designations/{id}` | delete_3 | Designations |
| GET | `/api/v1/organization/employees/{employeeId}/reporting-chain` | Reporting-manager chain upwards (recursive CTE) | Organization Structure |
| GET | `/api/v1/organization/employees/{employeeId}/subordinates` | Direct and indirect reports (recursive CTE) | Organization Structure |
| GET | `/api/v1/organization/job-grades` | list_2 | Job Grades |
| POST | `/api/v1/organization/job-grades` | create_2 | Job Grades |
| GET | `/api/v1/organization/job-grades/{id}` | get_2 | Job Grades |
| PUT | `/api/v1/organization/job-grades/{id}` | update_2 | Job Grades |
| DELETE | `/api/v1/organization/job-grades/{id}` | delete_2 | Job Grades |
| GET | `/api/v1/organization/locations` | list_1 | Locations |
| POST | `/api/v1/organization/locations` | create_1 | Locations |
| GET | `/api/v1/organization/locations/{id}` | get_1 | Locations |
| PUT | `/api/v1/organization/locations/{id}` | update_1 | Locations |
| DELETE | `/api/v1/organization/locations/{id}` | delete_1 | Locations |
| GET | `/api/v1/organization/organizations` | list | Organizations |
| POST | `/api/v1/organization/organizations` | create | Organizations |
| GET | `/api/v1/organization/organizations/{id}` | get | Organizations |
| PUT | `/api/v1/organization/organizations/{id}` | update | Organizations |
| DELETE | `/api/v1/organization/organizations/{id}` | delete | Organizations |
| GET | `/ping` | ping | ping-controller |

## Leave service (39 endpoints)

| Method | Path | Operation | Group |
|---|---|---|---|
| POST | `/api/v1/leaves/accrual/run` | accrue | Leave Administration |
| POST | `/api/v1/leaves/applications` | Apply for leave (validates range, overlap, eligibility, holidays and balance) | Leave Applications |
| GET | `/api/v1/leaves/applications/employee/{employeeId}` | Leave applications of an employee (self, their manager or HR) | Leave Applications |
| GET | `/api/v1/leaves/applications/me` | My leave applications (filter by status) | Leave Applications |
| GET | `/api/v1/leaves/applications/{id}` | get | Leave Applications |
| PUT | `/api/v1/leaves/applications/{id}` | Change a PENDING application | Leave Applications |
| GET | `/api/v1/leaves/applications/{id}/approvals` | approvals | Leave Applications |
| POST | `/api/v1/leaves/applications/{id}/approve` | approve | Leave Applications |
| POST | `/api/v1/leaves/applications/{id}/cancel` | Request cancellation of an approved leave (a pending one is withdrawn) | Leave Applications |
| POST | `/api/v1/leaves/applications/{id}/cancellation/approve` | approveCancellation | Leave Applications |
| POST | `/api/v1/leaves/applications/{id}/cancellation/reject` | rejectCancellation | Leave Applications |
| GET | `/api/v1/leaves/applications/{id}/comments` | comments | Leave Applications |
| POST | `/api/v1/leaves/applications/{id}/comments` | addComment | Leave Applications |
| POST | `/api/v1/leaves/applications/{id}/reject` | reject | Leave Applications |
| POST | `/api/v1/leaves/applications/{id}/withdraw` | Withdraw a PENDING application | Leave Applications |
| GET | `/api/v1/leaves/approvals/pending` | Applications waiting for my approval (manager stage / HR stage) | Leave Applications |
| GET | `/api/v1/leaves/audit` | search | Audit History |
| GET | `/api/v1/leaves/balances/me` | My leave balances (Redis cached) | Leave Balances and Calendar |
| GET | `/api/v1/leaves/balances/{employeeId}` | of | Leave Balances and Calendar |
| POST | `/api/v1/leaves/balances/{employeeId}/adjust` | adjust | Leave Balances and Calendar |
| POST | `/api/v1/leaves/balances/{employeeId}/encash` | encash | Leave Balances and Calendar |
| GET | `/api/v1/leaves/balances/{employeeId}/encashable` | Days that may be encashed (policy configuration vs. available balance); used by the exit settlement | Leave Balances and Calendar |
| GET | `/api/v1/leaves/balances/{employeeId}/history` | Balance transaction history (written by a MySQL trigger) | Leave Balances and Calendar |
| GET | `/api/v1/leaves/balances/{employeeId}/reconciliation` | Recalculate balances with the stored procedure sp_calculate_leave_balance and compare with the ledger | Leave Balances and Calendar |
| GET | `/api/v1/leaves/calendar` | My approved leave in a date range | Leave Balances and Calendar |
| GET | `/api/v1/leaves/calendar/team` | Team leave calendar (manager: direct reports, HR: company / department) | Leave Balances and Calendar |
| GET | `/api/v1/leaves/calendar/upcoming` | Upcoming approved leave of my team in the next N days | Leave Balances and Calendar |
| GET | `/api/v1/leaves/cancellation-requests` | cancellationRequests | Leave Applications |
| POST | `/api/v1/leaves/carry-forward/run` | carryForward | Leave Administration |
| GET | `/api/v1/leaves/policies` | policies | Leave Administration |
| POST | `/api/v1/leaves/policies` | createPolicy | Leave Administration |
| GET | `/api/v1/leaves/policies/{id}` | policy | Leave Administration |
| PUT | `/api/v1/leaves/policies/{id}` | updatePolicy | Leave Administration |
| GET | `/api/v1/leaves/types` | types | Leave Administration |
| POST | `/api/v1/leaves/types` | createType | Leave Administration |
| PUT | `/api/v1/leaves/types/{id}` | updateType | Leave Administration |
| DELETE | `/api/v1/leaves/types/{id}` | deleteType | Leave Administration |
| GET | `/api/v1/leaves/unpaid-days` | Unpaid leave days of an employee in a month (consumed by Payroll) | Leave Balances and Calendar |
| GET | `/ping` | ping | ping-controller |

## Attendance service (33 endpoints)

| Method | Path | Operation | Group |
|---|---|---|---|
| GET | `/api/v1/attendance/audit` | search | Audit History |
| GET | `/api/v1/attendance/calendar` | My attendance calendar of a month (record, holiday, weekly off, leave) | Attendance |
| GET | `/api/v1/attendance/calendar/{employeeId}` | calendarOf | Attendance |
| POST | `/api/v1/attendance/check-in` | Check in now (office, or WFH when an approved request exists) | Attendance |
| POST | `/api/v1/attendance/check-out` | Check out now: computes worked time, early departure and overtime | Attendance |
| POST | `/api/v1/attendance/corrections` | requestCorrection | Attendance Requests and Shifts |
| GET | `/api/v1/attendance/corrections/me` | myCorrections | Attendance Requests and Shifts |
| GET | `/api/v1/attendance/corrections/pending` | pendingCorrections | Attendance Requests and Shifts |
| POST | `/api/v1/attendance/corrections/{id}/approve` | approveCorrection | Attendance Requests and Shifts |
| POST | `/api/v1/attendance/corrections/{id}/cancel` | cancelCorrection | Attendance Requests and Shifts |
| POST | `/api/v1/attendance/corrections/{id}/reject` | rejectCorrection | Attendance Requests and Shifts |
| GET | `/api/v1/attendance/daily` | Daily attendance of the team (manager) or everybody (HR) | Attendance |
| GET | `/api/v1/attendance/employees/{employeeId}` | of | Attendance |
| POST | `/api/v1/attendance/jobs/missing-punch` | Run the missing-punch detection now (also runs nightly) | Attendance |
| GET | `/api/v1/attendance/me` | My attendance records (defaults to the current month) | Attendance |
| GET | `/api/v1/attendance/me/today` | today | Attendance |
| GET | `/api/v1/attendance/monthly/me` | myMonthly | Attendance |
| GET | `/api/v1/attendance/monthly/{employeeId}` | Monthly attendance summary (stored procedure sp_monthly_attendance_summary); used by Payroll | Attendance |
| POST | `/api/v1/attendance/punches/import` | Bulk punch import (device export): queued and processed by a background consumer | Attendance |
| GET | `/api/v1/attendance/shifts` | shifts | Attendance Requests and Shifts |
| POST | `/api/v1/attendance/shifts` | createShift | Attendance Requests and Shifts |
| GET | `/api/v1/attendance/shifts/assignments/{employeeId}` | assignments | Attendance Requests and Shifts |
| PUT | `/api/v1/attendance/shifts/{id}` | updateShift | Attendance Requests and Shifts |
| DELETE | `/api/v1/attendance/shifts/{id}` | deleteShift | Attendance Requests and Shifts |
| POST | `/api/v1/attendance/shifts/{id}/assignments` | assign | Attendance Requests and Shifts |
| GET | `/api/v1/attendance/team/report` | Team attendance report for a month (summaries computed in parallel) | Attendance |
| POST | `/api/v1/attendance/wfh` | requestWfh | Attendance Requests and Shifts |
| GET | `/api/v1/attendance/wfh/me` | myWfh | Attendance Requests and Shifts |
| GET | `/api/v1/attendance/wfh/pending` | pendingWfh | Attendance Requests and Shifts |
| POST | `/api/v1/attendance/wfh/{id}/approve` | approveWfh | Attendance Requests and Shifts |
| POST | `/api/v1/attendance/wfh/{id}/cancel` | cancelWfh | Attendance Requests and Shifts |
| POST | `/api/v1/attendance/wfh/{id}/reject` | rejectWfh | Attendance Requests and Shifts |
| GET | `/ping` | ping | ping-controller |

## Holiday service (13 endpoints)

| Method | Path | Operation | Group |
|---|---|---|---|
| GET | `/api/v1/holidays` | Holidays of a year, optionally for one location / department | Holidays |
| POST | `/api/v1/holidays` | create | Holidays |
| GET | `/api/v1/holidays/audit` | search | Audit History |
| GET | `/api/v1/holidays/calendar/{year}` | Calendar of a year grouped by month | Holidays |
| GET | `/api/v1/holidays/range` | Holidays inside a date range (used by the Attendance and Leave services) | Holidays |
| GET | `/api/v1/holidays/upcoming` | upcoming | Holidays |
| GET | `/api/v1/holidays/years` | list | Holiday Years |
| POST | `/api/v1/holidays/years` | create_1 | Holiday Years |
| PUT | `/api/v1/holidays/years/{id}` | update_1 | Holiday Years |
| GET | `/api/v1/holidays/{id}` | get | Holidays |
| PUT | `/api/v1/holidays/{id}` | update | Holidays |
| DELETE | `/api/v1/holidays/{id}` | delete | Holidays |
| GET | `/ping` | ping | ping-controller |

## Payroll service (42 endpoints)

| Method | Path | Operation | Group |
|---|---|---|---|
| GET | `/api/v1/payroll/adjustments` | adjustments | Payroll Processing |
| POST | `/api/v1/payroll/adjustments` | addAdjustment | Payroll Processing |
| DELETE | `/api/v1/payroll/adjustments/{id}` | cancelAdjustment | Payroll Processing |
| GET | `/api/v1/payroll/audit` | search | Audit History |
| GET | `/api/v1/payroll/components` | components | Salary Setup |
| POST | `/api/v1/payroll/components` | createComponent | Salary Setup |
| PUT | `/api/v1/payroll/components/{id}` | updateComponent | Salary Setup |
| GET | `/api/v1/payroll/config` | Payroll / statutory configuration (sample values - verify before production use) | Salary Setup |
| PUT | `/api/v1/payroll/config/{key}` | updateConfig | Salary Setup |
| POST | `/api/v1/payroll/employees/{employeeId}/revisions` | propose | Salary Setup |
| GET | `/api/v1/payroll/employees/{employeeId}/salary` | Current salary: the employee, payroll, finance and super admin only | Salary Setup |
| POST | `/api/v1/payroll/employees/{employeeId}/salary` | Assign the first salary of an employee | Salary Setup |
| GET | `/api/v1/payroll/employees/{employeeId}/salary-summary` | Employee salary summary: current CTC and financial-year-to-date payroll figures (used by Tax and Exit) | Salary Setup |
| GET | `/api/v1/payroll/employees/{employeeId}/salary/history` | Salary revision history (written by MySQL triggers) | Salary Setup |
| GET | `/api/v1/payroll/entries/{entryId}` | entry | Payroll Processing |
| POST | `/api/v1/payroll/loans` | addLoan | Payroll Processing |
| GET | `/api/v1/payroll/loans/employee/{employeeId}` | loans | Payroll Processing |
| PATCH | `/api/v1/payroll/loans/{id}/close` | closeLoan | Payroll Processing |
| GET | `/api/v1/payroll/payslips/employee/{employeeId}` | payslipsOf | Payroll Processing |
| GET | `/api/v1/payroll/payslips/me` | My payslips | Payroll Processing |
| GET | `/api/v1/payroll/payslips/{id}/download` | Download a payslip PDF (own payslips, or PAYSLIP_VIEW_ALL) | Payroll Processing |
| GET | `/api/v1/payroll/reports/components` | Earnings and deductions grouped by salary component | Payroll Processing |
| GET | `/api/v1/payroll/reports/departments` | departments | Payroll Processing |
| GET | `/api/v1/payroll/reports/monthly` | monthly | Payroll Processing |
| GET | `/api/v1/payroll/revisions` | revisions | Salary Setup |
| POST | `/api/v1/payroll/revisions/{id}/approve` | approveRevision | Salary Setup |
| POST | `/api/v1/payroll/revisions/{id}/reject` | rejectRevision | Salary Setup |
| GET | `/api/v1/payroll/runs` | list | Payroll Processing |
| POST | `/api/v1/payroll/runs` | create | Payroll Processing |
| GET | `/api/v1/payroll/runs/{id}` | get | Payroll Processing |
| DELETE | `/api/v1/payroll/runs/{id}` | delete | Payroll Processing |
| POST | `/api/v1/payroll/runs/{id}/approve` | Approve a processed run (finance; not the person who processed it) | Payroll Processing |
| GET | `/api/v1/payroll/runs/{id}/entries` | entries | Payroll Processing |
| POST | `/api/v1/payroll/runs/{id}/finalize` | Finalize an approved run: publishes payroll.processed and generates the PDF payslips | Payroll Processing |
| POST | `/api/v1/payroll/runs/{id}/payslips/generate` | regenerate | Payroll Processing |
| POST | `/api/v1/payroll/runs/{id}/process` | Calculate payroll for the month (concurrent data gathering, engine, stored procedure) | Payroll Processing |
| GET | `/api/v1/payroll/structures` | structures | Salary Setup |
| POST | `/api/v1/payroll/structures` | createStructure | Salary Setup |
| GET | `/api/v1/payroll/structures/{id}` | structure | Salary Setup |
| PUT | `/api/v1/payroll/structures/{id}` | updateStructure | Salary Setup |
| DELETE | `/api/v1/payroll/structures/{id}` | deleteStructure | Salary Setup |
| GET | `/ping` | ping | ping-controller |

## Tax service (25 endpoints)

| Method | Path | Operation | Group |
|---|---|---|---|
| GET | `/api/v1/tax/audit` | search | Audit History |
| GET | `/api/v1/tax/computation` | Annual tax computation of an employee (self / finance) | Tax |
| PUT | `/api/v1/tax/declarations` | Create / replace my declaration for a financial year (while DRAFT or after a rejection) | Tax |
| GET | `/api/v1/tax/declarations/me` | mine | Tax |
| GET | `/api/v1/tax/declarations/pending-review` | pending | Tax |
| GET | `/api/v1/tax/declarations/{id}` | get | Tax |
| POST | `/api/v1/tax/declarations/{id}/approve` | approve | Tax |
| GET | `/api/v1/tax/declarations/{id}/history` | history | Tax |
| POST | `/api/v1/tax/declarations/{id}/investments/{investmentId}/proofs` | Attach a supporting proof (document id from the Document service) to an investment; also used to resubmit a rejected proof | Tax |
| POST | `/api/v1/tax/declarations/{id}/reject` | reject | Tax |
| POST | `/api/v1/tax/declarations/{id}/start-review` | startReview | Tax |
| POST | `/api/v1/tax/declarations/{id}/submit` | submit | Tax |
| GET | `/api/v1/tax/documents` | documents | Tax |
| POST | `/api/v1/tax/documents` | Register an employee tax document (Form 16 ...) stored in the Document service | Tax |
| GET | `/api/v1/tax/monthly-tds` | Monthly TDS for payroll: (annual tax - TDS of earlier months) / months remaining | Tax |
| GET | `/api/v1/tax/proofs/pending` | proofsPending | Tax |
| POST | `/api/v1/tax/proofs/{proofId}/reject` | rejectProof | Tax |
| POST | `/api/v1/tax/proofs/{proofId}/verify` | verify | Tax |
| POST | `/api/v1/tax/reminders/run` | reminders | Tax |
| GET | `/api/v1/tax/reports/status` | status | Tax |
| GET | `/api/v1/tax/rules` | Tax rules of a financial year (sample values - verify before production use) | Tax |
| POST | `/api/v1/tax/rules` | createRule | Tax |
| PUT | `/api/v1/tax/rules/{id}` | updateRule | Tax |
| GET | `/api/v1/tax/statement` | Income tax statement / annual tax summary with the month-wise TDS table | Tax |
| GET | `/ping` | ping | ping-controller |

## Performance service (33 endpoints)

| Method | Path | Operation | Group |
|---|---|---|---|
| GET | `/api/v1/performance/audit` | search | Audit History |
| GET | `/api/v1/performance/cycles` | cycles | Performance |
| POST | `/api/v1/performance/cycles` | createCycle | Performance |
| POST | `/api/v1/performance/cycles/{id}/activate` | Activate a cycle: one review per active employee is created and employees are notified | Performance |
| POST | `/api/v1/performance/cycles/{id}/close` | close | Performance |
| GET | `/api/v1/performance/cycles/{id}/summary` | Cycle report: status counts, average ratings, final-rating distribution | Performance |
| POST | `/api/v1/performance/feedback` | give | Performance |
| GET | `/api/v1/performance/feedback/employee/{employeeId}` | about | Performance |
| GET | `/api/v1/performance/feedback/me` | aboutMe | Performance |
| GET | `/api/v1/performance/forms` | forms | Performance |
| POST | `/api/v1/performance/forms` | createForm | Performance |
| GET | `/api/v1/performance/forms/{id}` | form | Performance |
| PUT | `/api/v1/performance/forms/{id}` | updateForm | Performance |
| POST | `/api/v1/performance/goals` | createGoal | Performance |
| GET | `/api/v1/performance/goals/employee/{employeeId}` | goalsOf | Performance |
| GET | `/api/v1/performance/goals/me` | myGoals | Performance |
| PUT | `/api/v1/performance/goals/{id}` | updateGoal | Performance |
| DELETE | `/api/v1/performance/goals/{id}` | deleteGoal | Performance |
| PATCH | `/api/v1/performance/goals/{id}/key-results/{keyResultId}` | keyResult | Performance |
| PATCH | `/api/v1/performance/goals/{id}/progress` | progress | Performance |
| POST | `/api/v1/performance/reminders/run` | runReminders | Performance |
| GET | `/api/v1/performance/reviews/employee/{employeeId}` | history | Performance |
| GET | `/api/v1/performance/reviews/me` | myReviews | Performance |
| GET | `/api/v1/performance/reviews/pending` | pending | Performance |
| GET | `/api/v1/performance/reviews/{id}` | review | Performance |
| POST | `/api/v1/performance/reviews/{id}/approve` | approve | Performance |
| GET | `/api/v1/performance/reviews/{id}/history` | trail | Performance |
| PUT | `/api/v1/performance/reviews/{id}/manager` | Manager evaluation: save a draft | Performance |
| POST | `/api/v1/performance/reviews/{id}/manager/submit` | submitManager | Performance |
| POST | `/api/v1/performance/reviews/{id}/return` | returnReview | Performance |
| PUT | `/api/v1/performance/reviews/{id}/self` | Self evaluation: save a draft | Performance |
| POST | `/api/v1/performance/reviews/{id}/self/submit` | submitSelf | Performance |
| GET | `/ping` | ping | ping-controller |

## Project service (25 endpoints)

| Method | Path | Operation | Group |
|---|---|---|---|
| GET | `/api/v1/customers` | list_1 | Customers |
| POST | `/api/v1/customers` | create_1 | Customers |
| GET | `/api/v1/customers/{id}` | get_1 | Customers |
| PUT | `/api/v1/customers/{id}` | update_1 | Customers |
| DELETE | `/api/v1/customers/{id}` | delete | Customers |
| GET | `/api/v1/customers/{id}/contacts` | contacts | Customers |
| POST | `/api/v1/customers/{id}/contacts` | addContact | Customers |
| PUT | `/api/v1/customers/{id}/contacts/{contactId}` | updateContact | Customers |
| DELETE | `/api/v1/customers/{id}/contacts/{contactId}` | deleteContact | Customers |
| GET | `/api/v1/projects` | list | Projects |
| POST | `/api/v1/projects` | create | Projects |
| GET | `/api/v1/projects/audit` | search | Audit History |
| GET | `/api/v1/projects/employees/{employeeId}` | Projects of an employee | Projects |
| GET | `/api/v1/projects/employees/{employeeId}/allocation-summary` | Allocation summary of an employee on a date (stored procedure sp_employee_allocation_summary) | Projects |
| GET | `/api/v1/projects/{id}` | get | Projects |
| PUT | `/api/v1/projects/{id}` | update | Projects |
| GET | `/api/v1/projects/{id}/allocation-check` | Is the employee allocated to the project on a date? (used by the Timesheet service) | Projects |
| GET | `/api/v1/projects/{id}/allocations` | team | Projects |
| POST | `/api/v1/projects/{id}/allocations` | Allocate an employee (a percentage of their time) to the project; rejects more than 100 % on any day | Projects |
| PUT | `/api/v1/projects/{id}/allocations/{allocationId}` | updateAllocation | Projects |
| DELETE | `/api/v1/projects/{id}/allocations/{allocationId}` | endAllocation | Projects |
| GET | `/api/v1/projects/{id}/history` | history | Projects |
| PATCH | `/api/v1/projects/{id}/manager` | manager | Projects |
| PATCH | `/api/v1/projects/{id}/status` | status | Projects |
| GET | `/ping` | ping | ping-controller |

## Timesheet service (20 endpoints)

| Method | Path | Operation | Group |
|---|---|---|---|
| GET | `/api/v1/timesheets/approvals/pending` | pending | Timesheets |
| GET | `/api/v1/timesheets/audit` | search | Audit History |
| GET | `/api/v1/timesheets/employee/{employeeId}` | forEmployee | Timesheets |
| GET | `/api/v1/timesheets/me` | mine | Timesheets |
| PUT | `/api/v1/timesheets/me/entries` | Weekly entry: replaces the lines of a week (validates allocation, daily totals, duplicates) | Timesheets |
| POST | `/api/v1/timesheets/me/entries` | Daily entry: books / replaces one line (project, optional task, day) | Timesheets |
| GET | `/api/v1/timesheets/me/week/{weekStart}` | week | Timesheets |
| POST | `/api/v1/timesheets/me/week/{weekStart}/submit` | Submit a week for approval (first submission or resubmission after a rejection) | Timesheets |
| GET | `/api/v1/timesheets/me/week/{weekStart}/totals` | totals | Timesheets |
| GET | `/api/v1/timesheets/reports/employee/{employeeId}` | Employee work-hour summary (approved hours, billable vs non-billable, per project) - stored procedure | Timesheet Reports and Tasks |
| GET | `/api/v1/timesheets/reports/project/{projectId}` | Project work-hour summary per employee | Timesheet Reports and Tasks |
| GET | `/api/v1/timesheets/tasks` | tasks | Timesheet Reports and Tasks |
| POST | `/api/v1/timesheets/tasks` | createTask | Timesheet Reports and Tasks |
| PUT | `/api/v1/timesheets/tasks/{id}` | updateTask | Timesheet Reports and Tasks |
| GET | `/api/v1/timesheets/{id}` | get | Timesheets |
| POST | `/api/v1/timesheets/{id}/approve` | approve | Timesheets |
| GET | `/api/v1/timesheets/{id}/history` | history | Timesheets |
| POST | `/api/v1/timesheets/{id}/reject` | reject | Timesheets |
| POST | `/api/v1/timesheets/{id}/reopen` | Timesheet correction: reopen an approved sheet | Timesheets |
| GET | `/ping` | ping | ping-controller |

## Exit service (25 endpoints)

| Method | Path | Operation | Group |
|---|---|---|---|
| GET | `/api/v1/exit/audit` | search | Audit History |
| GET | `/api/v1/exit/interview-form` | form | Exit Management |
| GET | `/api/v1/exit/policy` | policy | Exit Management |
| PUT | `/api/v1/exit/policy` | updatePolicy | Exit Management |
| GET | `/api/v1/exit/reports/summary` | summary | Exit Management |
| GET | `/api/v1/exit/resignations` | list | Exit Management |
| POST | `/api/v1/exit/resignations` | Step 1: employee submits a resignation (notice period is calculated from the employee record) | Exit Management |
| GET | `/api/v1/exit/resignations/me` | mine | Exit Management |
| GET | `/api/v1/exit/resignations/pending` | pending | Exit Management |
| GET | `/api/v1/exit/resignations/{id}` | get | Exit Management |
| POST | `/api/v1/exit/resignations/{id}/complete` | Step 8: HR completes the exit - publishes employee.exited (employee status, account, org chart ... are updated by their services) | Exit Management |
| POST | `/api/v1/exit/resignations/{id}/confirm` | Step 3: HR confirms the last working day (notice waiver allowed) and the exit checklist is generated | Exit Management |
| GET | `/api/v1/exit/resignations/{id}/history` | history | Exit Management |
| GET | `/api/v1/exit/resignations/{id}/interview` | interview | Exit Management |
| POST | `/api/v1/exit/resignations/{id}/interview/complete` | Step 6: HR records the exit interview (answers + feedback) | Exit Management |
| PUT | `/api/v1/exit/resignations/{id}/interview/schedule` | schedule | Exit Management |
| POST | `/api/v1/exit/resignations/{id}/manager-decision` | Step 2: manager approves or rejects | Exit Management |
| GET | `/api/v1/exit/resignations/{id}/settlement` | settlement | Exit Management |
| POST | `/api/v1/exit/resignations/{id}/settlement/calculate` | Step 7a: payroll calculates the full and final settlement (salary, leave encashment, notice and loan recovery) | Exit Management |
| POST | `/api/v1/exit/resignations/{id}/settlement/process` | Step 7b: payroll processes (pays) the settlement - publishes settlement.processed | Exit Management |
| GET | `/api/v1/exit/resignations/{id}/tasks` | tasks | Exit Management |
| POST | `/api/v1/exit/resignations/{id}/tasks` | addTask | Exit Management |
| POST | `/api/v1/exit/resignations/{id}/withdraw` | withdraw | Exit Management |
| POST | `/api/v1/exit/tasks/{taskId}/complete` | Steps 4-5: complete a checklist item / clearance / knowledge transfer / asset return / access revocation | Exit Management |
| GET | `/ping` | ping | ping-controller |

## Document service (20 endpoints)

| Method | Path | Operation | Group |
|---|---|---|---|
| POST | `/api/v1/documents` | Upload a document (multipart): allow-listed types, content sniffing, versioning by title + category | Documents |
| GET | `/api/v1/documents/audit` | search | Audit History |
| GET | `/api/v1/documents/categories` | categories | Documents |
| POST | `/api/v1/documents/categories` | createCategory | Documents |
| PUT | `/api/v1/documents/categories/{id}` | updateCategory | Documents |
| GET | `/api/v1/documents/employee/{employeeId}` | Documents of an employee that the caller is allowed to see | Documents |
| GET | `/api/v1/documents/expiring` | expiring | Documents |
| GET | `/api/v1/documents/me` | mine | Documents |
| GET | `/api/v1/documents/pending-verification` | pending | Documents |
| GET | `/api/v1/documents/{id}` | get | Documents |
| POST | `/api/v1/documents/{id}/approve` | approve | Documents |
| GET | `/api/v1/documents/{id}/download` | Download: owner, category read roles, or an explicit permission; every download is recorded | Documents |
| GET | `/api/v1/documents/{id}/history` | history | Documents |
| GET | `/api/v1/documents/{id}/permissions` | permissions | Documents |
| POST | `/api/v1/documents/{id}/permissions` | grant | Documents |
| DELETE | `/api/v1/documents/{id}/permissions/{permissionId}` | revoke | Documents |
| POST | `/api/v1/documents/{id}/reject` | reject | Documents |
| POST | `/api/v1/documents/{id}/verify` | verify | Documents |
| GET | `/api/v1/documents/{id}/versions` | versions | Documents |
| GET | `/ping` | ping | ping-controller |

## Notification service (15 endpoints)

| Method | Path | Operation | Group |
|---|---|---|---|
| GET | `/api/v1/notifications/audit` | search | Audit History |
| GET | `/api/v1/notifications/events/history` | Business event history of all services (who published what, when, partition / offset) | Notifications |
| GET | `/api/v1/notifications/history` | Notification history of everybody (filter by employee / type / delivery status) | Notifications |
| GET | `/api/v1/notifications/kafka/topics` | Kafka topics with partitions and message counts, including retry and dead-letter topics | Notifications |
| GET | `/api/v1/notifications/me` | My in-app notifications (newest first; unreadOnly filter) | Notifications |
| GET | `/api/v1/notifications/me/unread-count` | unread | Notifications |
| POST | `/api/v1/notifications/read-all` | readAll | Notifications |
| POST | `/api/v1/notifications/send` | send | Notifications |
| GET | `/api/v1/notifications/settings/email` | E-mail settings (host, port, user, mode LOG / SMTP); the SMTP password comes from the environment | Notifications |
| PUT | `/api/v1/notifications/settings/email` | updateEmailSettings | Notifications |
| GET | `/api/v1/notifications/templates` | templates | Notifications |
| POST | `/api/v1/notifications/templates` | createTemplate | Notifications |
| PUT | `/api/v1/notifications/templates/{id}` | updateTemplate | Notifications |
| PATCH | `/api/v1/notifications/{id}/read` | read | Notifications |
| GET | `/ping` | ping | ping-controller |

## Reporting service (17 endpoints)

| Method | Path | Operation | Group |
|---|---|---|---|
| GET | `/api/v1/dashboard/employee` | Employee dashboard: profile, leave balance, holidays, attendance, timesheets, payslip, pending items, review status, events (9 services concurrently) | Dashboards |
| GET | `/api/v1/dashboard/manager` | Manager dashboard: team, pending leave / timesheet approvals, team attendance, upcoming reviews, team project allocation | Dashboards |
| GET | `/api/v1/reports/analytics/workforce` | Workforce analytics computed with Java Streams / Collectors (see docs/JAVA_STREAMS_GUIDE.md) | Reports |
| GET | `/api/v1/reports/attendance` | attendance | Reports |
| GET | `/api/v1/reports/audit` | search | Audit History |
| GET | `/api/v1/reports/departments` | Department report: headcount per department (names resolved through the Organization service) | Reports |
| GET | `/api/v1/reports/employees/headcount` | Employee headcount grouped by department | location | designation | status | Reports |
| GET | `/api/v1/reports/employees/joining-exit` | Employee joining and exit summary of a year, by month | Reports |
| GET | `/api/v1/reports/executive-summary` | Executive summary: independent sections computed asynchronously (CompletableFuture) and merged | Reports |
| GET | `/api/v1/reports/exits` | exits | Reports |
| GET | `/api/v1/reports/leave` | leave | Reports |
| GET | `/api/v1/reports/payroll` | Payroll report (payroll, finance and super admin only: it contains salary totals) | Reports |
| GET | `/api/v1/reports/performance` | performance | Reports |
| GET | `/api/v1/reports/project-allocation` | allocation | Reports |
| GET | `/api/v1/reports/tax` | tax | Reports |
| GET | `/api/v1/reports/timesheets` | timesheets | Reports |
| GET | `/ping` | ping | ping-controller |
