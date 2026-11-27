#!/usr/bin/env bash
# Stops the processes LISTENING on the project ports (never by name pattern).
source "$(dirname "$0")/common.sh"
for entry in "${SERVICES[@]}" "$GATEWAY"; do
  IFS=: read -r name proj port db <<< "$entry"
  pid=$(ss -ltnp "sport = :$port" 2>/dev/null | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2)
  if [ -n "$pid" ]; then kill "$pid" && echo "stopped $name (pid $pid, port $port)"; fi
done
# gRPC listeners follow their service; nothing else to stop
