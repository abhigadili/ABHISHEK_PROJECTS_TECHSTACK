#!/usr/bin/env bash
# Shared helpers: project root, .env loading, service table (name:port:module-dir).
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ -f "$ROOT/.env" ]; then set -a; . "$ROOT/.env"; set +a; fi
RUN_DIR="$ROOT/.run"; LOG_DIR="$ROOT/logs"; mkdir -p "$RUN_DIR" "$LOG_DIR"
# Start order: identity + reference data first, then the services that call them.
SERVICES=(
  "hr-auth-service:9101:auth-service"
  "hr-organization-service:9103:organization-service"
  "hr-holiday-service:9106:holiday-service"
  "hr-employee-service:9102:employee-service"
  "hr-leave-service:9104:leave-service"
  "hr-attendance-service:9105:attendance-service"
  "hr-project-service:9110:project-service"
  "hr-timesheet-service:9111:timesheet-service"
  "hr-payroll-service:9107:payroll-service"
  "hr-tax-service:9108:tax-service"
  "hr-performance-service:9109:performance-service"
  "hr-exit-service:9112:exit-service"
  "hr-document-service:9113:document-service"
  "hr-notification-service:9114:notification-service"
  "hr-reporting-service:9115:reporting-service"
)
DATABASES=(hr_auth_db hr_employee_db hr_organization_db hr_leave_db hr_attendance_db hr_holiday_db hr_payroll_db hr_tax_db hr_performance_db hr_project_db hr_timesheet_db hr_exit_db hr_document_db hr_notification_db hr_reporting_db)
