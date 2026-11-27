#!/usr/bin/env bash
# Stops the locally started JVMs by listening port (never uses pkill -f).
for port in 8080 8081 8082 8083 8084 8761; do
  pid=$(lsof -ti tcp:$port -sTCP:LISTEN 2>/dev/null || true)
  [ -n "$pid" ] && { kill $pid && echo "stopped :$port (pid $pid)"; }
done
