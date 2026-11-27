#!/usr/bin/env bash
# Read-only: lists the tables each microservice owns and checks connectivity with the app credentials.
source "$(dirname "$0")/common.sh"
export MYSQL_PWD="${MYSQL_PASSWORD:?set MYSQL_PASSWORD}"
for entry in "${SERVICES[@]}"; do
  IFS=: read -r name port dir <<< "$entry"
  db=$(DB_OF "$name")
  if [ "$db" = NotificationDB ]; then filter="table_name like 'hms\\_%'"; else filter="1=1"; fi
  n=$(mysql -h "${MYSQL_HOST:-localhost}" -P "${MYSQL_PORT:-3306}" -u "${MYSQL_USER:-abhig}" -N -e "select count(*) from information_schema.tables where table_schema='$db' and $filter" 2>&1) \
    && echo "OK   $name -> $db ($n tables)" || echo "FAIL $name -> $db : $n"
done
