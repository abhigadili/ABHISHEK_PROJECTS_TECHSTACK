#!/usr/bin/env bash
# Starts the 10 microservices + API gateway from the built jars (run scripts/build.sh first).
# Infrastructure must already be up: `docker compose -f docker/docker-compose.yml up -d`.
source "$(dirname "$0")/common.sh"
[ -z "${MYSQL_PASSWORD:-}" ] && { echo "MYSQL_PASSWORD is not set - create .env from .env.example"; exit 1; }
start_one() { # name port jar
  local name=$1 port=$2 jar=$3
  if ss -ltn "sport = :$port" | grep -q LISTEN; then echo "  $name: port $port already in use - skipping"; return; fi
  (cd "$ROOT"; nohup java -DLOG_DIR="$LOG_DIR" -jar "$jar" > "$LOG_DIR/$name.out" 2>&1 & echo $! > "$RUN_DIR/$name.pid")
  echo "  $name starting on :$port (pid $(cat "$RUN_DIR/$name.pid"))"
}
for entry in "${SERVICES[@]}"; do
  IFS=: read -r name port dir <<< "$entry"
  jar=$(ls "$ROOT/$dir/target/$name"-*.jar 2>/dev/null | grep -v original | head -1)
  [ -z "$jar" ] && { echo "jar for $name not found - run scripts/build.sh"; exit 1; }
  start_one "$name" "$port" "$jar"
done
start_one api-gateway 18080 "$(ls "$ROOT"/gateway/target/api-gateway-*.jar | grep -v original | head -1)"
echo "Waiting for services to answer /ping ..."
for entry in "${SERVICES[@]}" "api-gateway:18080:"; do
  IFS=: read -r name port dir <<< "$entry"
  for i in $(seq 1 90); do
    if [ "$name" = api-gateway ]; then code=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$port/api/auth/login" -X POST -H 'Content-Type: application/json' -d '{}' ); [ "$code" != 000 ] && ok=1 || ok=0
    else curl -sf "http://localhost:$port/ping" > /dev/null && ok=1 || ok=0; fi
    [ $ok = 1 ] && { echo "  $name UP"; break; }
    sleep 2; [ $i = 90 ] && echo "  $name did NOT come up - see logs/$name.out"
  done
done
