# Producer / consumer mapping

Derived from the code (`producer/` and `consumer/` packages of each service).

## Producers (class → topics)

| Service | Producer class | Topics published |
|---|---|---|
| attendance-service | AttendanceEventProducer | `attendance.checked-in`, `attendance.checked-out`, `attendance.corrected`, `notification.requested` |
| document-service | DocumentEventProducer | `notification.requested` |
| employee-service | EmployeeEventProducer | `employee.created`, `employee.updated`, `employee.terminated` |
| exit-service | ExitEventProducer | `resignation.submitted`, `employee.exited`, `settlement.processed`, `notification.requested` |
| leave-service | LeaveEventProducer | `leave.applied`, `leave.approved`, `leave.rejected`, `leave.cancelled`, `notification.requested` |
| payroll-service | PayrollEventProducer | `payroll.processed`, `payslip.generated`, `notification.requested` |
| performance-service | PerformanceEventProducer | `performance.review.submitted`, `performance.review.approved`, `notification.requested` |
| project-service | ProjectEventProducer | `project.allocation.changed`, `notification.requested` |
| tax-service | TaxEventProducer | `tax.declaration.submitted`, `tax.declaration.reviewed`, `notification.requested` |
| timesheet-service | TimesheetEventProducer | `timesheet.submitted`, `timesheet.approved`, `notification.requested` |
| holiday-service | `HolidayService` (publishes via `EventPublisher`) | `holiday.changed` |
| auth-service | `AuthService`, `UserAdminService` | `notification.requested` |

## Consumers (class → topics)

| Service | Consumer class | Topics consumed | What it does |
|---|---|---|---|
| attendance-service | AttendanceEventsConsumer | `employee.created`, `employee.updated`, `employee.terminated`, `employee.exited`, `leave.approved`, `leave.cancelled`, `holiday.changed` | employee read model; leave days / holiday snapshot used by check-in and monthly summary |
| auth-service | EmployeeLifecycleConsumer | `employee.created`, `employee.terminated`, `employee.exited` | creates / disables login accounts |
| document-service | PayslipConsumer | `payslip.generated` | registers payslip PDFs as documents |
| employee-service | ExitEventsConsumer | `resignation.submitted`, `employee.exited` | moves employee to NOTICE / EXITED |
| leave-service | EmployeeEventsConsumer | `employee.created`, `employee.updated`, `employee.terminated`, `employee.exited` | employee read model (leave_employees) |
| notification-service | NotificationConsumers, NotificationConsumers (history) | `notification.requested`, `employee.created`, `employee.updated`, `employee.terminated`, `leave.applied`, `leave.approved`, `leave.rejected`, `leave.cancelled`, `attendance.checked-in`, `attendance.checked-out`, `attendance.corrected`, `payroll.processed`, `payslip.generated`, `tax.declaration.submitted`, `tax.declaration.reviewed`, `performance.review.submitted`, `performance.review.approved`, `timesheet.submitted`, `timesheet.approved`, `resignation.submitted`, `employee.exited`, `settlement.processed`, `holiday.changed`, `project.allocation.changed` | notifications + event history |
| organization-service | EmployeeNodeConsumer | `employee.created`, `employee.updated`, `employee.terminated`, `employee.exited` | org chart nodes |
| payroll-service | SettlementConsumer | `settlement.processed` | marks final settlement paid |
| performance-service | EmployeeEventsConsumer | `employee.created`, `employee.updated`, `employee.terminated`, `employee.exited` | employee read model |
| project-service | EmployeeExitConsumer | `employee.exited`, `employee.terminated` | closes allocations of leavers |
| reporting-service | ReportingConsumers | `employee.created`, `employee.updated`, `employee.terminated`, `employee.exited`, `leave.applied`, `leave.approved`, `leave.rejected`, `leave.cancelled`, `attendance.checked-in`, `attendance.checked-out`, `attendance.corrected`, `payroll.processed`, `tax.declaration.submitted`, `tax.declaration.reviewed`, `timesheet.submitted`, `timesheet.approved`, `performance.review.submitted`, `performance.review.approved`, `resignation.submitted`, `project.allocation.changed` | rank-protected upserts of report facts |
| tax-service | EmployeeEventsConsumer | `employee.created`, `employee.updated`, `employee.terminated`, `employee.exited` | employee read model |
| timesheet-service | EmployeeEventsConsumer | `employee.created`, `employee.updated`, `employee.terminated`, `employee.exited` | employee read model |
