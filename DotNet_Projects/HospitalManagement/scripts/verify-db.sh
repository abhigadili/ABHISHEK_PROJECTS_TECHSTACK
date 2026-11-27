#!/usr/bin/env bash
# Read-only: connectivity + the hdn_* tables each microservice owns.
source "$(dirname "$0")/common.sh"
export MYSQL_PWD="${MYSQL_PASSWORD:?set MYSQL_PASSWORD}"
for entry in "${SERVICES[@]}"; do
  IFS=: read -r name proj port db <<< "$entry"
  n=$(mysql -h "${MYSQL_HOST:-localhost}" -P "${MYSQL_PORT:-3306}" -u "${MYSQL_USER:-abhig}" -N -e "select count(*) from information_schema.tables where table_schema='$db' and (table_name like 'hdn\\_%' or table_name='__hdn_migrations_history')" 2>&1) \
    && echo "OK   $name -> $db ($n hdn_ tables)" || echo "FAIL $name -> $db : $n"
done
