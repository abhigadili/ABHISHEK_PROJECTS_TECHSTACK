#!/usr/bin/env bash
# Regenerates database/scripts/NN-<DB>-migrations.sql from the EF Core migrations (idempotent scripts). No database connection needed.
source "$(dirname "$0")/common.sh"
cd "$ROOT"
i=10
for entry in "${SERVICES[@]}"; do
  IFS=: read -r name proj port db <<< "$entry"; i=$((i+1))
  out="database/scripts/${i}-${db}-migrations.sql"
  { echo "-- EF Core migrations of the $proj (database $db). Idempotent: safe to run repeatedly. Only hdn_* tables + __hdn_migrations_history are touched."; echo "USE $db;"; echo
    (cd src/$proj && dotnet ef migrations script --idempotent --no-build 2>/dev/null | grep -v '^$'); } > "$out"
  echo "generated $out ($(wc -l < "$out") lines)"
done
