#!/usr/bin/env bash
# Starts Eureka + 4 services + gateway as plain JVMs on the host (infra: docker compose up -d kafka redis jaeger).
# Usage: scripts/start-local.sh   (build first: mvn -DskipTests package)
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p logs
start() { # name jar port
  if (echo > /dev/tcp/127.0.0.1/$3) 2>/dev/null; then echo "$1 already listening on :$3"; return; fi
  nohup java -jar "$2" > "logs/$1.log" 2>&1 &
  echo "$1 starting (pid $!, port $3, log logs/$1.log)"
}
wait_up() { # name port
  for _ in $(seq 1 90); do
    curl -fs "http://localhost:$2/actuator/health" >/dev/null 2>&1 && { echo "$1 UP"; return; }
    sleep 2
  done
  echo "$1 did not become healthy - see logs/$1.log"; return 1
}
start eureka-server       eureka-server/target/eureka-server-1.0.0.jar 8761; wait_up eureka-server 8761
start student-service     services/student-service/target/student-service-1.0.0.jar 8081
start course-service      services/course-service/target/course-service-1.0.0.jar 8082
start enrollment-service  services/enrollment-service/target/enrollment-service-1.0.0.jar 8083
start notification-service services/notification-service/target/notification-service-1.0.0.jar 8084
for p in "student-service 8081" "course-service 8082" "enrollment-service 8083" "notification-service 8084"; do wait_up $p; done
start api-gateway         api-gateway/target/api-gateway-1.0.0.jar 8080; wait_up api-gateway 8080
echo "All up. Gateway: http://localhost:8080  Eureka: http://localhost:8761  Swagger: http://localhost:8080/swagger-ui.html"
