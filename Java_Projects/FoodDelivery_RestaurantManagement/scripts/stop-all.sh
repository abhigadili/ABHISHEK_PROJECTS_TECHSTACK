#!/usr/bin/env bash
# Stops the Java processes by listening port (never by name pattern). Infrastructure containers keep running unless --infra is passed.
. "$(dirname "$0")/common.sh"
stop_port $GATEWAY_PORT
for s in "${SERVICES[@]}"; do rest="${s#*:}"; stop_port "${rest%%:*}"; done
stop_port $DISCOVERY_PORT
[ "${1:-}" = "--infra" ] && docker compose -f "$ROOT/infrastructure/docker-compose.yml" --env-file "$ROOT/.env" stop
exit 0
