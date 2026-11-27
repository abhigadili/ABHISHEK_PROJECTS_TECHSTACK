#!/usr/bin/env bash
# Shared helpers: loads .env, service table (name:port:database), per-service pid/log handling.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
set -a; [ -f "$ROOT/.env" ] && . "$ROOT/.env"; set +a
export SPRING_PROFILES_ACTIVE="${SPRING_PROFILES_ACTIVE:-dev}"
mkdir -p "$ROOT/logs" "$ROOT/.run" "$ROOT/uploads"

# name : port : database
SERVICES=(
  "user-service:9101:food_user_db"
  "customer-service:9102:food_customer_db"
  "restaurant-service:9103:food_restaurant_db"
  "menu-service:9104:food_menu_db"
  "cart-service:9105:food_cart_db"
  "order-service:9106:food_order_db"
  "payment-service:9107:food_payment_db"
  "delivery-service:9108:food_delivery_db"
  "notification-service:9109:food_notification_db"
  "review-service:9110:food_review_db"
  "coupon-service:9111:food_coupon_db"
  "inventory-service:9112:food_inventory_db"
  "search-service:9113:food_search_db"
  "admin-service:9114:food_admin_db"
  "event-audit-service:9115:food_event_audit_db"
)
DISCOVERY_PORT=9761
GATEWAY_PORT=9080

port_pid() { ss -ltnp 2>/dev/null | grep -E ":$1 " | sed -E 's/.*pid=([0-9]+).*/\1/' | head -1; }

wait_port() {  # wait_port <port> <seconds>
  for _ in $(seq 1 "$2"); do ss -ltn 2>/dev/null | grep -q ":$1 " && return 0; sleep 1; done
  return 1
}

wait_health() {  # wait_health <port> <seconds>
  for _ in $(seq 1 "$2"); do
    curl -s "http://localhost:$1/actuator/health" 2>/dev/null | grep -q '"status":"UP"' && return 0; sleep 1
  done
  return 1
}

start_jar() {  # start_jar <module-dir> <port> [extra env assignments...]
  local mod="$1" port="$2"; shift 2
  local jar; jar="$(ls "$ROOT/$mod"/target/*.jar 2>/dev/null | grep -v original | head -1)"
  [ -z "$jar" ] && { echo "no jar for $mod (run scripts/build.sh)"; return 1; }
  if [ -n "$(port_pid "$port")" ]; then echo "$mod already listening on $port"; return 0; fi
  ( cd "$ROOT" && exec env "$@" nohup java -Xms128m -Xmx384m -jar "$jar" > "$ROOT/logs/$mod.out" 2>&1 ) &
  disown
}

stop_port() {
  local pid; pid="$(port_pid "$1")"
  [ -n "$pid" ] && kill "$pid" 2>/dev/null && echo "stopped pid $pid on :$1"
}
