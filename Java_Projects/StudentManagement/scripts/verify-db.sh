#!/usr/bin/env bash
# READ-ONLY check of the four databases: lists tables (original vs sms_*), row counts of the ORIGINAL tables and Flyway history.
# Usage: MYSQL_USER=... MYSQL_PASSWORD=... scripts/verify-db.sh      (defaults come from .env if present)
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] && set -a && . <(grep -E '^(MYSQL_USER|MYSQL_PASSWORD)=' .env | sed 's/ *#.*//') && set +a
: "${MYSQL_USER:?set MYSQL_USER}"; : "${MYSQL_PASSWORD:?set MYSQL_PASSWORD}"
M=(mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" -N -B)
for db in StudentDB CourseDB EnrollmentDB NotificationDB; do
  echo "=== $db"
  echo "-- pre-existing tables (row counts must be unchanged by this project):"
  "${M[@]}" -e "SELECT table_name FROM information_schema.tables WHERE table_schema='$db' AND table_name NOT LIKE 'sms\\_%' AND table_name <> 'flyway_schema_history'" 2>/dev/null \
    | while read -r t; do printf "   %-22s %s rows\n" "$t" "$("${M[@]}" -e "SELECT COUNT(*) FROM \`$db\`.\`$t\`" 2>/dev/null)"; done
  echo "-- tables added by Flyway:"
  "${M[@]}" -e "SELECT CONCAT('   ', table_name) FROM information_schema.tables WHERE table_schema='$db' AND (table_name LIKE 'sms\\_%' OR table_name='flyway_schema_history')" 2>/dev/null
  echo "-- Flyway history:"
  "${M[@]}" -e "SELECT CONCAT('   V', version, '  ', description, '  success=', success) FROM \`$db\`.flyway_schema_history WHERE version IS NOT NULL" 2>/dev/null
done
