#!/usr/bin/env bash
# Regenerates each service's Flyway baseline (db/migration/V1__init.sql) FROM THE JPA ENTITIES:
# starts the service once against a throw-away database "<db>_gen" with Hibernate ddl-auto=update and Flyway off,
# then dumps the resulting structure. At runtime the services use Flyway + ddl-auto=validate (entities must match the migration).
. "$(dirname "$0")/common.sh"
export DB_SUFFIX=_gen
ONLY="${1:-}"
for s in "${SERVICES[@]}"; do
  name="${s%%:*}"; rest="${s#*:}"; port="${rest%%:*}"; db="${s##*:}"
  [ -n "$ONLY" ] && [ "$ONLY" != "$name" ] && continue
  echo "== $name"
  start_jar "$name" "$port" DB_SUFFIX=_gen DDL_AUTO=update FLYWAY_ENABLED=false EUREKA_URL=http://localhost:9/eureka
  wait_health "$port" 120 || { echo "   did not become healthy; see logs/$name.out"; stop_port "$port"; continue; }
  sleep 1; stop_port "$port"; sleep 2
  out="$ROOT/$name/src/main/resources/db/migration/V1__init.sql"
  mkdir -p "$(dirname "$out")"
  { echo "-- Baseline schema of $db generated from the JPA entities (scripts/gen-schema.sh). Owned by $name only."; 
    MYSQL_PWD="$MYSQL_PASSWORD" mysqldump -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" --no-data --skip-comments --skip-add-drop-table --skip-triggers \
      --set-gtid-purged=OFF --no-tablespaces "${db}_gen" \
    | sed -E '/^\/\*!/d; /^--/d; /^LOCK|^UNLOCK/d; s/ AUTO_INCREMENT=[0-9]+//; s/^CREATE TABLE `/CREATE TABLE IF NOT EXISTS `/; /^$/N;/^\n$/D'; } > "$out"
  python3 "$ROOT/scripts/post_process_migration.py" "$out"
  echo "   wrote $out ($(grep -c 'CREATE TABLE' "$out") tables)"
done
