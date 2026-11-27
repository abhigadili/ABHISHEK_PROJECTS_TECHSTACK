#!/usr/bin/env bash
# Pre-creates every business topic (3 partitions) plus its dead-letter twin. Idempotent (--if-not-exists).
set -euo pipefail
BS="${BOOTSTRAP_SERVER:-localhost:29092}"
TOPICS=("employee.created" "employee.updated" "employee.terminated" "leave.applied" "leave.approved" "leave.rejected" "leave.cancelled" "attendance.checked-in" "attendance.checked-out" "attendance.corrected" "payroll.processed" "payslip.generated" "tax.declaration.submitted" "tax.declaration.reviewed" "performance.review.submitted" "performance.review.approved" "timesheet.submitted" "timesheet.approved" "resignation.submitted" "employee.exited" "settlement.processed" "holiday.changed" "project.allocation.changed" "notification.requested")
for t in "${TOPICS[@]}"; do
  /opt/kafka/bin/kafka-topics.sh --bootstrap-server "$BS" --create --if-not-exists --topic "$t" --partitions 3 --replication-factor 1
  /opt/kafka/bin/kafka-topics.sh --bootstrap-server "$BS" --create --if-not-exists --topic "$t.DLT" --partitions 3 --replication-factor 1
done
echo "topics ready"
