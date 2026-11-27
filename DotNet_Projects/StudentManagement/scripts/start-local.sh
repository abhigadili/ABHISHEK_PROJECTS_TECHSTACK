#!/usr/bin/env bash
# Starts the 4 services + API Gateway as plain dotnet processes on the host.
# Prerequisites: infra up (docker compose up -d rabbitmq redis jaeger), host MySQL running, solution built (dotnet build StudentManagement.sln).
# Order matters little (no registry) but the gateway goes last so its downstream clusters are already healthy.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$PATH:$HOME/.dotnet"
mkdir -p logs
# traces go to Jaeger (docker compose up -d jaeger); set OpenTelemetry__OtlpEndpoint="" to switch the exporter off
export OpenTelemetry__OtlpEndpoint="${OpenTelemetry__OtlpEndpoint-http://localhost:4317}"
start() { # name project port
  if (echo > /dev/tcp/127.0.0.1/$3) 2>/dev/null; then echo "$1 already listening on :$3"; return; fi
  nohup dotnet run --no-build --no-launch-profile --project "$2" > "logs/$1.log" 2>&1 &
  echo "$1 starting (pid $!, port $3, log logs/$1.log)"
}
wait_up() { # name port
  for _ in $(seq 1 90); do
    curl -fs "http://localhost:$2/health/live" >/dev/null 2>&1 && { echo "$1 UP"; return; }
    sleep 1
  done
  echo "$1 did not become healthy - see logs/$1.log"; return 1
}
start student      Services/StudentService      8081
start course       Services/CourseService       8082
start enrollment   Services/EnrollmentService   8083
start notification Services/NotificationService 8084
for p in "student 8081" "course 8082" "enrollment 8083" "notification 8084"; do wait_up $p; done
start gateway      ApiGateway                   8080; wait_up gateway 8080
echo "All up. Gateway: http://localhost:8080  Swagger: http://localhost:8080/swagger  RabbitMQ UI: http://localhost:15672  Jaeger: http://localhost:16686"
