#!/usr/bin/env bash
# Starts the 10 services + the API gateway as detached Node processes (logs/<name>.out + Pino rolling files).
# Infrastructure must be up: `docker compose up -d` (Kafka :39092, Redis :36379). Run `npm install` and `scripts/create-databases.sh` once.
source "$(dirname "$0")/common.sh"
[ -z "${MYSQL_PASSWORD:-}" ] && { echo "MYSQL_PASSWORD is not set - create .env from .env.example"; exit 1; }
start_one() { # dir name port
  local dir=$1 name=$2 port=$3
  if ss -ltn "sport = :$port" | grep -q LISTEN; then echo "  $name: port $port already in use - skipping"; return; fi
  (cd "$ROOT/$dir"; nohup node src/index.js > "$LOG_DIR/$name.out" 2>&1 &)
  echo "  $name starting on :$port"
}
for entry in "${SERVICES[@]}"; do IFS=: read -r name port db <<< "$entry"; start_one "services/$name" "$name" "$port"; done
start_one api-gateway api-gateway 30080
echo "Waiting for services ..."
for entry in "${SERVICES[@]}" "api-gateway:30080:"; do
  IFS=: read -r name port db <<< "$entry"
  path=/ping; [ "$name" = api-gateway ] && path=/gateway/ping
  for i in $(seq 1 60); do curl -sf "http://localhost:$port$path" > /dev/null && { echo "  $name UP"; break; }; sleep 2; [ $i = 60 ] && echo "  $name did NOT come up - see logs/$name.out"; done
done
