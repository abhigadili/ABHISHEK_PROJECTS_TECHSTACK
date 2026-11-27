#!/usr/bin/env bash
# Starts (in dependency order) infrastructure containers, Eureka, the 15 services and the gateway. Waits for each to be UP.
. "$(dirname "$0")/common.sh"
if [ "${1:-}" != "--no-infra" ]; then
  docker compose -f "$ROOT/infrastructure/docker-compose.yml" --env-file "$ROOT/.env" up -d kafka redis elasticsearch logstash kibana
  echo "waiting for Kafka/Redis/Elasticsearch..."
  for c in food-kafka food-redis food-elasticsearch; do
    for _ in $(seq 1 90); do [ "$(docker inspect -f '{{.State.Health.Status}}' $c 2>/dev/null)" = healthy ] && break; sleep 2; done
  done
  "$ROOT/infrastructure/elasticsearch/setup-elasticsearch.sh" >/dev/null 2>&1
fi
start_jar service-discovery $DISCOVERY_PORT
wait_port $DISCOVERY_PORT 60 || { echo "Eureka did not start"; exit 1; }
# Start in batches of 5 (15 JVMs booting at once on a laptop is slower than 3 waves of 5)
BATCH=5; i=0; batch=()
flush() {
  for s in "${batch[@]}"; do name="${s%%:*}"; rest="${s#*:}"; port="${rest%%:*}"
    if wait_health "$port" 240; then echo "UP   $name :$port"; else echo "FAIL $name :$port (see logs/$name.out)"; fi
  done; batch=()
}
for s in "${SERVICES[@]}"; do
  name="${s%%:*}"; rest="${s#*:}"; port="${rest%%:*}"
  start_jar "$name" "$port"; batch+=("$s"); i=$((i+1))
  [ $((i % BATCH)) -eq 0 ] && flush
done
flush
start_jar api-gateway $GATEWAY_PORT
wait_health $GATEWAY_PORT 90 && echo "UP   api-gateway :$GATEWAY_PORT" || echo "FAIL api-gateway (see logs/api-gateway.out)"
echo "Swagger (all services): http://localhost:$GATEWAY_PORT/swagger-ui.html   Eureka: http://localhost:$DISCOVERY_PORT   Kibana: http://localhost:5601"
