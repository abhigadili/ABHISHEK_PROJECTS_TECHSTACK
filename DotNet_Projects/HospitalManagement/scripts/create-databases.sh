#!/usr/bin/env bash
# Creates the 10 databases (IF NOT EXISTS) and applies the EF Core migration scripts (idempotent; they only touch hdn_* tables
# and the __hdn_migrations_history table - tables of other applications in the same databases are never read or changed).
source "$(dirname "$0")/common.sh"
export MYSQL_PWD="${MYSQL_PASSWORD:?set MYSQL_PASSWORD (see .env.example)}"
M="mysql -h ${MYSQL_HOST:-localhost} -P ${MYSQL_PORT:-3306} -u ${MYSQL_USER:-abhig}"
$M < "$ROOT/database/scripts/00-create-databases.sql" && echo "databases ready"
for f in "$ROOT"/database/scripts/[1-9]*.sql; do
  [ -e "$f" ] || continue
  echo "applying $(basename "$f")"; $M < "$f"
done
