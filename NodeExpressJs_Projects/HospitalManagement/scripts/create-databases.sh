#!/usr/bin/env bash
# 1) CREATE DATABASE IF NOT EXISTS x10   2) per service: apply the Prisma init migration once (baseline-safe on non-empty databases)
#    and record it in Prisma's history table; later migrations are applied with `prisma migrate deploy`.
# Tables of other applications in the same databases are never read or changed (all tables here are hjs_*).
source "$(dirname "$0")/common.sh"
export MYSQL_PWD="${MYSQL_PASSWORD:?set MYSQL_PASSWORD (see .env.example)}"
M="mysql -h ${MYSQL_HOST:-localhost} -P ${MYSQL_PORT:-3306} -u ${MYSQL_USER:-abhig}"
$M < "$ROOT/database/scripts/00-create-databases.sql" && echo "databases ready"
for entry in "${SERVICES[@]}"; do
  IFS=: read -r name port db <<< "$entry"
  cd "$ROOT/services/$name"
  export DATABASE_URL="$(node "$ROOT/scripts/db-url.mjs" "$db")"
  applied=$($M -N -e "select count(*) from information_schema.tables where table_schema='$db' and table_name='_prisma_migrations'" 2>/dev/null)
  done_init=0
  [ "$applied" = "1" ] && done_init=$($M -N -e "select count(*) from \`$db\`._prisma_migrations where migration_name='$INIT' and finished_at is not null")
  if [ "$done_init" = "0" ]; then
    npx prisma db execute --schema prisma/schema.prisma --file "prisma/migrations/$INIT/migration.sql" > /dev/null && \
    npx prisma migrate resolve --schema prisma/schema.prisma --applied "$INIT" > /dev/null && echo "  $name -> $db: init migration applied"
  else
    npx prisma migrate deploy --schema prisma/schema.prisma 2>&1 | grep -E "No pending|applied" | head -1 | sed "s/^/  $name -> $db: /"
  fi
done
