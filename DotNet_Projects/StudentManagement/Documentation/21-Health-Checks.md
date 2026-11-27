# 21 - Health Checks

## 1. Feature Overview
Liveness and readiness endpoints with MySQL, RabbitMQ and Redis connectivity checks on every program.

## 2. Purpose
Container/Kubernetes probes and quick operational diagnosis.

## 3. Files Created
`BuildingBlocks/Common/ServiceCollectionExtensions.cs` (`MapSmsHealth`, `RedisHealthCheck`, `HealthWriter`), `BuildingBlocks/Messaging/RabbitMq.cs` (`RabbitMqHealthCheck`), per-service `AddDbContextCheck<...>("mysql")` in each `Program.cs`, `Docker/healthcheck.sh`.

## 4. Files Modified
None.

## 5. Implementation Details
| Endpoint | Meaning |
|---|---|
| `GET /health/live` | process is up (no dependency checks) - used by Docker `HEALTHCHECK`, Compose and the Kubernetes liveness probe |
| `GET /health/ready`, `GET /health` | dependencies tagged `ready`: `mysql` (EF `CanConnect`), `rabbitmq` (opens a channel), `redis` (PING) - JSON `{status, checks:{name:{status,detail}}}`; 503 when unhealthy |
| Dependencies per program | Student: mysql, redis; Course: mysql, redis, rabbitmq; Enrollment: mysql, rabbitmq; Notification: mysql, rabbitmq; Gateway: self only |
Example (Course): `{"status":"Healthy","checks":{"redis":{"status":"Healthy","detail":"ping 0 ms"},"rabbitmq":{"status":"Healthy","detail":"connected"},"mysql":{"status":"Healthy","detail":null}}}`.

## 6. Architecture Details
Readiness gates traffic in Kubernetes (`/health/ready`); liveness never depends on external systems so a broker outage does not restart pods.

## 7. Dependencies
`Microsoft.Extensions.Diagnostics.HealthChecks.EntityFrameworkCore 8.0.10`.

## 8. Configuration Changes
None.

## 9. Database Changes
None.

## 10. API Changes
`/health`, `/health/live`, `/health/ready` (anonymous).

## 11. Communication Changes
Checks connect to MySQL/RabbitMQ/Redis.

## 12. Execution Instructions
`curl localhost:8082/health/ready`. `scripts/e2e.py` asserts readiness of all five programs.

## 13. Testing
Integration test asserts mysql + redis `Healthy` on Student Service; e2e asserts `200` for all five readiness endpoints.

## 14. Pending Items
The gateway readiness does not probe downstream services (YARP passive health only).
