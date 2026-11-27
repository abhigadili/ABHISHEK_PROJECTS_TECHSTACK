#!/usr/bin/env bash
# usage: scripts/restart.sh Auth   -> rebuilds one service (Release) and restarts it on its port
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$ROOT"
set -a; . ./.env; set +a
case "${STORAGE_DIR:-./storage}" in /*) ;; *) STORAGE_DIR="$ROOT/${STORAGE_DIR#./}" ;; esac; export STORAGE_DIR   # one shared file store for every service
n="$1"
if [ "$n" = "ApiGateway" ] || [ "$n" = "Gateway" ]; then dir=src/ApiGateway/HR.ApiGateway; asm=HR.ApiGateway; port=32080
else dir=src/Services/$n/HR.${n}Service; asm=HR.${n}Service; port=$(awk -F'\t' -v n="$n" '$1==n{print $3}' scripts/services.tsv); fi
pid=$(ss -ltnp "sport = :$port" 2>/dev/null | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2 || true)
[ -n "${pid:-}" ] && kill "$pid" && sleep 1
dotnet build "$dir" -c Release -v q --nologo 2>&1 | grep -E " error " | sed 's/\[.*//' | sort -u | head -20 || true
mkdir -p logs; ( cd "$dir" && nohup dotnet "bin/Release/net8.0/$asm.dll" > "$ROOT/logs/$n.out" 2>&1 & )
for i in $(seq 1 30); do sleep 1; curl -fs "localhost:$port/ping" >/dev/null 2>&1 && { echo "$n up on :$port"; exit 0; }; done
echo "$n did not come up"; tail -5 "logs/$n.out" | cut -c1-250; exit 1
