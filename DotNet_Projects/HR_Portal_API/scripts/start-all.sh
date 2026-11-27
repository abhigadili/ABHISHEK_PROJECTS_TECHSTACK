#!/usr/bin/env bash
# Starts Kafka + Redis (docker compose), builds the solution, then starts the gateway and every service as background processes.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
[ -f .env ] || { echo "Missing .env (copy .env.example)"; exit 1; }
set -a; . ./.env; set +a
case "${STORAGE_DIR:-./storage}" in /*) ;; *) STORAGE_DIR="$ROOT/${STORAGE_DIR#./}" ;; esac; export STORAGE_DIR   # one shared file store for every service
docker compose up -d kafka redis
dotnet build HRPortal.sln -c Release -v q --nologo 2>&1 | grep -E "error|Build succeeded" | head -20
mkdir -p logs storage
export ASPNETCORE_ENVIRONMENT="${ASPNETCORE_ENVIRONMENT:-Production}"
start() { # name port dll
  if ss -ltn "sport = :$2" | grep -q LISTEN; then echo "$1 already running on $2"; return; fi
  ( cd "$3" && nohup dotnet "bin/Release/net8.0/$4.dll" > "$ROOT/logs/$1.out" 2>&1 & )
  echo "started $1 on $2"
}
while IFS=$'\t' read -r n db port; do
  start "$n" "$port" "src/Services/$n/HR.${n}Service" "HR.${n}Service"
done < scripts/services.tsv
sleep 3
start gateway "${GATEWAY_PORT:-32080}" src/ApiGateway/HR.ApiGateway HR.ApiGateway
