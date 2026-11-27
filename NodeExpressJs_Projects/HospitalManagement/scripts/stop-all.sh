#!/usr/bin/env bash
# Sends SIGTERM (graceful shutdown) to the processes LISTENING on the project ports - never by name pattern.
source "$(dirname "$0")/common.sh"
for entry in "${SERVICES[@]}" "api-gateway:30080:"; do
  IFS=: read -r name port db <<< "$entry"
  pid=$(ss -ltnp "sport = :$port" 2>/dev/null | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2)
  [ -n "$pid" ] && kill "$pid" && echo "stopped $name (pid $pid, port $port)"
done
