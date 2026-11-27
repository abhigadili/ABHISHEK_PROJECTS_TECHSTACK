#!/usr/bin/env bash
# Stops the services by the process that LISTENS on each project port (never by name pattern).
source "$(dirname "$0")/common.sh"
for entry in "${SERVICES[@]}" "hr-api-gateway:9080:"; do
  IFS=: read -r name port dir <<< "$entry"
  pid=$(ss -ltnp "sport = :$port" 2>/dev/null | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2)
  if [ -n "$pid" ]; then kill "$pid" && echo "stopped $name (pid $pid, port $port)"; fi
  rm -f "$RUN_DIR/$name.pid"
done
