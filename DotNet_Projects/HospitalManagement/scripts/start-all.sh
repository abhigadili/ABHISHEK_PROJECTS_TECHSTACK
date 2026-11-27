#!/usr/bin/env bash
# Starts the 10 services + the YARP gateway from the published output (run scripts/build.sh first).
# Infrastructure must already be up: `docker compose up -d` (Kafka :29092, Redis :26379).
source "$(dirname "$0")/common.sh"
[ -z "${MYSQL_PASSWORD:-}" ] && { echo "MYSQL_PASSWORD is not set - create .env from .env.example"; exit 1; }
start_one() { # name project port
  local name=$1 proj=$2 port=$3
  if ss -ltn "sport = :$port" | grep -q LISTEN; then echo "  $name: port $port already in use - skipping"; return; fi
  [ -f "$PUBLISH_DIR/$proj/$proj.dll" ] || { echo "$proj not published - run scripts/build.sh"; exit 1; }
  (cd "$PUBLISH_DIR/$proj"; nohup dotnet "$proj.dll" > "$LOG_DIR/$name.out" 2>&1 &)
  echo "  $name starting on :$port"
}
for entry in "${SERVICES[@]}" "$GATEWAY"; do
  IFS=: read -r name proj port db <<< "$entry"
  start_one "$name" "$proj" "$port"
done
echo "Waiting for services to answer ..."
for entry in "${SERVICES[@]}" "$GATEWAY"; do
  IFS=: read -r name proj port db <<< "$entry"
  for i in $(seq 1 90); do
    if [ "$name" = api-gateway ]; then code=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$port/api/doctors"); [ "$code" = 401 ] && ok=1 || ok=0
    else curl -sf "http://localhost:$port/ping" > /dev/null && ok=1 || ok=0; fi
    [ $ok = 1 ] && { echo "  $name UP"; break; }
    sleep 2; [ $i = 90 ] && echo "  $name did NOT come up - see logs/$name.out"
  done
done
