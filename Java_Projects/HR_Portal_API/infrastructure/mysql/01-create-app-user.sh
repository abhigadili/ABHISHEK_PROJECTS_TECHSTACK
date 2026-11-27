#!/usr/bin/env bash
# Container init: creates the least-privilege runtime user (DML + EXECUTE only, no DDL) on every hr_* database.
set -euo pipefail
HOST="${HR_DB_USER_HOST:-%}"
SQL="CREATE USER IF NOT EXISTS '${MYSQL_APP_USER}'@'${HOST}' IDENTIFIED BY '${MYSQL_APP_PASSWORD}';"
for db in hr_auth_db hr_employee_db hr_organization_db hr_leave_db hr_attendance_db hr_holiday_db hr_payroll_db hr_tax_db hr_performance_db hr_project_db hr_timesheet_db hr_exit_db hr_document_db hr_notification_db hr_reporting_db; do
  SQL+=" GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON ${db}.* TO '${MYSQL_APP_USER}'@'${HOST}';"
done
mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" -e "${SQL} FLUSH PRIVILEGES;"
