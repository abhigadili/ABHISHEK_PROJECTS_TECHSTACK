# 23 – Health Checks and Actuator

## 1. Feature Overview
Spring Boot Actuator health with liveness/readiness probes and component checks for MySQL, Kafka, Redis and circuit breakers on all services.

## 2. Purpose
Correct container/Kubernetes orchestration and quick diagnosis.

## 3. Files Created
`common/common-web/src/main/java/com/example/common/KafkaHealthAutoConfiguration.java` (cluster reachability via `AdminClient.describeCluster`, 3 s timeout). MySQL (`db`) and Redis (`redis`) indicators and `circuitBreakers` come from Spring Boot / Resilience4j.

## 4. Files Modified
None.

## 5. Implementation Details
`management.endpoint.health.probes.enabled=true` → `/actuator/health/liveness`, `/actuator/health/readiness`. Readiness groups: student `readinessState, db, redis`; course `readinessState, db, redis, kafka`; enrollment and notification `readinessState, db, kafka`. `show-details: always`. Eureka server and gateway expose probes too. Docker `HEALTHCHECK`s and Kubernetes probes use these URLs; Compose `depends_on: condition: service_healthy` orders startup.

## 6. Architecture Details
Liveness = process alive; readiness = can serve (dependencies up).

## 7. Dependencies
`spring-boot-starter-actuator`.

## 8. Configuration Changes
`management.*` blocks in each `application.yml`.

## 9. Database Changes
None.

## 10. API Changes
`GET /actuator/health[/liveness|/readiness]`, `/actuator/info`, `/actuator/circuitbreakers` (enrollment, authenticated).

## 11. Communication Changes
Probes call the endpoints over HTTP.

## 12. Execution Instructions
`curl -s localhost:8083/actuator/health | jq '.components | keys'`. Verified outputs: course `db, kafka, redis` UP; enrollment `circuitBreakers, db, kafka` UP; notification readiness `db, kafka, readinessState` UP.

## 13. Testing
Verified live on every service; the Dockerfile `HEALTHCHECK` command was not exercised in a running container (see [24](24-Docker-and-Docker-Compose.md)).

## 14. Pending Items
Health endpoints show details to anonymous callers (`show-details: always`) – set to `when-authorized` for production.
