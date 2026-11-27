#!/usr/bin/env bash
# Usage: scripts/svc.sh start|stop|restart|status [service ...]   (default: all services)
# Runs each FastAPI service with uvicorn from its own directory; logs in var/logs, PIDs in var/run.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
declare -A PORTS=([auth]=8001 [student]=8002 [course]=8003 [enrollment]=8004 [notification]=8005 [gateway]=8000)
ORDER=(auth student course enrollment notification gateway)
cmd="${1:-status}"; shift || true
SERVICES=("${@:-${ORDER[@]}}")
mkdir -p "$ROOT/var/logs" "$ROOT/var/run"
start() {
  local s=$1 port=${PORTS[$1]} pidf="$ROOT/var/run/$1.pid"
  if [[ -f $pidf ]] && kill -0 "$(cat "$pidf")" 2>/dev/null; then echo "$s already running"; return; fi
  # exec => the subshell *becomes* uvicorn, so $! is the real server PID
  ( cd "$ROOT/services/$s" && exec nohup "$ROOT/.venv/bin/uvicorn" app.main:app --host 0.0.0.0 \
      --port "$port" ) >"$ROOT/var/logs/$s.log" 2>&1 &
  echo $! >"$pidf"
  for i in $(seq 1 40); do
    if curl -fs "http://127.0.0.1:$port/health" >/dev/null 2>&1; then echo "$s up on :$port"; return; fi
    sleep 0.5
  done
  echo "$s FAILED to start (see var/logs/$s.log)"; tail -5 "$ROOT/var/logs/$s.log"
}
stop() {
  local pidf="$ROOT/var/run/$1.pid"
  if [[ -f $pidf ]]; then
    local pid; pid=$(cat "$pidf")
    if kill -0 "$pid" 2>/dev/null; then kill "$pid"; for i in $(seq 1 20); do kill -0 "$pid" 2>/dev/null || break; sleep 0.25; done; kill -9 "$pid" 2>/dev/null || true; fi
    rm -f "$pidf"; echo "$1 stopped"
  fi
}
status() {
  local port=${PORTS[$1]}
  if curl -fs "http://127.0.0.1:$port/health" >/dev/null 2>&1; then echo "$1: UP (:$port)"; else echo "$1: down"; fi
}
for s in "${SERVICES[@]}"; do
  case $cmd in
    start) start "$s";; stop) stop "$s";; restart) stop "$s"; start "$s";; status) status "$s";;
    *) echo "usage: $0 start|stop|restart|status [service...]"; exit 2;;
  esac
done
