#!/usr/bin/env bash
. "$(dirname "$0")/common.sh"
printf "%-24s %-6s %s\n" SERVICE PORT STATE
for s in "${SERVICES[@]}"; do name="${s%%:*}"; rest="${s#*:}"; port="${rest%%:*}"
  st=$(curl -s -m 2 "http://localhost:$port/actuator/health" | sed -nE 's/.*"status":"([A-Z_]+)".*/\1/p' | head -1); printf "%-24s %-6s %s\n" "$name" "$port" "${st:-DOWN}"; done
for p in "service-discovery:$DISCOVERY_PORT" "api-gateway:$GATEWAY_PORT"; do n="${p%%:*}"; port="${p##*:}"
  st=$(curl -s -m 2 "http://localhost:$port/actuator/health" | sed -nE 's/.*"status":"([A-Z_]+)".*/\1/p' | head -1); printf "%-24s %-6s %s\n" "$n" "$port" "${st:-DOWN}"; done
