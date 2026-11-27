#!/usr/bin/env bash
# Creates the 15 service databases (IF NOT EXISTS) and the least-privilege runtime user on the EXISTING MySQL server.
# Uses the privileged login from .env (MYSQL_MIGRATION_*). Nothing is dropped or altered in unrelated databases.
# Tables, procedures, functions, views and triggers are created later by each service's Flyway migrations at startup.
source "$(dirname "$0")/common.sh"
: "${MYSQL_MIGRATION_PASSWORD:?set MYSQL_MIGRATION_PASSWORD in .env}" "${MYSQL_APP_PASSWORD:?set MYSQL_APP_PASSWORD in .env}"
export MYSQL_PWD="$MYSQL_MIGRATION_PASSWORD"
M="mysql -h ${MYSQL_HOST:-localhost} -P ${MYSQL_PORT:-3306} -u ${MYSQL_MIGRATION_USER}"
$M < "$ROOT/infrastructure/mysql/00-create-databases.sql" && echo "databases ready"
HOST="${HR_DB_USER_HOST:-localhost}"
SQL="CREATE USER IF NOT EXISTS '${MYSQL_APP_USER}'@'${HOST}' IDENTIFIED BY '${MYSQL_APP_PASSWORD}'; ALTER USER '${MYSQL_APP_USER}'@'${HOST}' IDENTIFIED BY '${MYSQL_APP_PASSWORD}';"
for db in "${DATABASES[@]}"; do
  SQL+=" GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON ${db}.* TO '${MYSQL_APP_USER}'@'${HOST}';"
done
$M -e "${SQL} FLUSH PRIVILEGES;" && echo "runtime user '${MYSQL_APP_USER}'@'${HOST}' ready (SELECT, INSERT, UPDATE, DELETE, EXECUTE only)"
