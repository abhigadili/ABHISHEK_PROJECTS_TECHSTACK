#!/usr/bin/env bash
# Stops the Node processes by listening port (never by name pattern).
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"; set -a; . ./.env; set +a
for port in "${GATEWAY_PORT:-31080}" 31101 31102 31103 31104 31105 31106 31107 31108 31109 31110 31111 31112 31113 31114 31115; do
  pid="$(ss -ltnp "sport = :$port" 2>/dev/null | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2 || true)"
  [ -n "${pid:-}" ] && kill "$pid" && echo "stopped $port (pid $pid)"
done
