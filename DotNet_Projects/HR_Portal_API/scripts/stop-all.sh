#!/usr/bin/env bash
# Stops the gateway and all services by their listening ports (never pattern-kills other projects' processes).
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ports="32080 $(cut -f3 "$ROOT/scripts/services.tsv" | tr '\n' ' ')"
for p in $ports; do
  pid=$(ss -ltnp "sport = :$p" 2>/dev/null | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2 || true)
  [ -n "${pid:-}" ] && kill "$pid" && echo "stopped :$p (pid $pid)"
done
[ "${1:-}" = "--infra" ] && (cd "$ROOT" && docker compose stop kafka kafka-ui redis)
exit 0
