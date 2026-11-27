#!/usr/bin/env bash
# Starts Redis/Kafka (docker compose), builds, then starts every service + the gateway as background processes.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
[ -f .env ] || { echo "Missing .env (copy .env.example)"; exit 1; }
set -a; . ./.env; set +a
docker compose -f infrastructure/docker-compose.yml up -d kafka redis
npx tsc -b
mkdir -p logs
SERVICES=(auth employee organization holiday leave attendance payroll tax performance project timesheet exit document notification reporting)
for s in "${SERVICES[@]}"; do
  var="$(echo "$s" | tr a-z A-Z)_SERVICE_URL"; port="${!var##*:}"
  if ss -ltn "sport = :$port" | grep -q LISTEN; then echo "$s already running on $port"; continue; fi
  nohup node "$s-service/dist/main.js" > "logs/$s-service.log" 2>&1 &
  echo "started $s-service on $port"
done
sleep 3
if ! ss -ltn "sport = :${GATEWAY_PORT:-31080}" | grep -q LISTEN; then nohup node api-gateway/dist/main.js > logs/api-gateway.log 2>&1 & echo "started api-gateway on ${GATEWAY_PORT:-31080}"; fi
