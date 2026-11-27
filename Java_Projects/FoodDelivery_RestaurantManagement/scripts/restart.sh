#!/usr/bin/env bash
# Rebuild and restart selected services (jars are never rebuilt while they run: stop -> build -> start).
#   scripts/restart.sh order-service menu-service
. "$(dirname "$0")/common.sh"
[ $# -eq 0 ] && { echo "usage: $0 <service-name>..."; exit 1; }
declare -A PORTS; for s in "${SERVICES[@]}"; do n="${s%%:*}"; r="${s#*:}"; PORTS[$n]="${r%%:*}"; done
PORTS[api-gateway]=$GATEWAY_PORT; PORTS[service-discovery]=$DISCOVERY_PORT
for n in "$@"; do stop_port "${PORTS[$n]}"; done; sleep 3
( cd "$ROOT" && mvn -q -pl "$(IFS=,; echo "$*")" install -DskipTests ) || exit 1
for n in "$@"; do start_jar "$n" "${PORTS[$n]}"; done
for n in "$@"; do wait_health "${PORTS[$n]}" 240 && echo "UP   $n :${PORTS[$n]}" || echo "FAIL $n (see logs/$n.out)"; done
