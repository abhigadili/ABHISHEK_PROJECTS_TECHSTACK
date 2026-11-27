#!/usr/bin/env bash
# Starts the 15 microservices + API gateway from the built jars (run scripts/build.sh first).
# Infrastructure must be up: `docker compose up -d` (Kafka, Redis) and the databases created (scripts/create-databases.sh).
source "$(dirname "$0")/common.sh"
[ -z "${MYSQL_APP_PASSWORD:-}" ] && { echo ".env missing - copy .env.example to .env and fill it in"; exit 1; }
start_one() { # name port jar
  local name=$1 port=$2 jar=$3
  if ss -ltn "sport = :$port" | grep -q LISTEN; then echo "  $name: port $port already in use - skipping"; return; fi
  (cd "$ROOT"; nohup java -Xmx${HR_HEAP:-300m} -DLOG_DIR="$LOG_DIR" -jar "$jar" > "$LOG_DIR/$name.out" 2>&1 & echo $! > "$RUN_DIR/$name.pid")
  echo "  $name starting on :$port"
}
for entry in "${SERVICES[@]}"; do
  IFS=: read -r name port dir <<< "$entry"
  jar="$ROOT/$dir/target/$name.jar"
  [ -f "$jar" ] || { echo "jar for $name not found - run scripts/build.sh"; exit 1; }
  start_one "$name" "$port" "$jar"
done
start_one hr-api-gateway 9080 "$ROOT/api-gateway/target/hr-api-gateway.jar"
echo "Waiting for services to answer /ping ..."
for entry in "${SERVICES[@]}" "hr-api-gateway:9080:"; do
  IFS=: read -r name port dir <<< "$entry"
  for i in $(seq 1 120); do
    if [ "$name" = hr-api-gateway ]; then code=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$port/ping"); [ "$code" = 200 ] && ok=1 || ok=0
    else curl -sf "http://localhost:$port/ping" > /dev/null && ok=1 || ok=0; fi
    [ $ok = 1 ] && { echo "  $name UP"; break; }
    sleep 2; [ $i = 120 ] && echo "  $name did NOT come up - see logs/$name.out"
  done
done
