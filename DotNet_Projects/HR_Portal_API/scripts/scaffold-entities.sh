#!/usr/bin/env bash
# Database First: reverse-engineers the EXISTING hr_* schemas into EF Core entities (read-only against MySQL).
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a
export PATH="$PATH:$HOME/.dotnet/tools"
while IFS=$'\t' read -r n db port; do
  tables=$(mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" -N -e \
    "select table_name from information_schema.tables where table_schema='$db' and table_name not in ('flyway_schema_history','outbox_events','processed_events') order by 1" 2>/dev/null)
  targs=(); for t in $tables; do targs+=(-t "$t"); done
  proj=src/Services/$n/HR.${n}Service
  dotnet ef dbcontext scaffold "Server=$MYSQL_HOST;Port=$MYSQL_PORT;Database=$db;User=$MYSQL_USER;Password=$MYSQL_PASSWORD;SslMode=None;AllowPublicKeyRetrieval=True" \
    Pomelo.EntityFrameworkCore.MySql --project $proj --no-build --force --no-onconfiguring \
    --context ${n}DbContext --context-dir Data --output-dir Entities \
    --namespace HR.${n}Service.Entities --context-namespace HR.${n}Service.Data "${targs[@]}" >/dev/null
  echo "$n scaffolded: $(ls $proj/Entities | wc -l) entities"
done < scripts/services.tsv
bash scripts/postprocess-entities.sh
