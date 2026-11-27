# 09 – Eureka Service Discovery

## 1. Feature Overview
Netflix Eureka server (:8761) and Eureka clients in the gateway and the four services. Names: `student-service`, `course-service`, `enrollment-service`, `notification-service`, `api-gateway`.

## 2. Purpose
No hard-coded service URLs; `lb://` and `@FeignClient(name="…")` resolve through the registry with client-side load balancing.

## 3. Files Created
| File Path | Change Type | Description |
|---|---|---|
| eureka-server/pom.xml | Created | |
| eureka-server/src/main/java/com/example/eureka/EurekaServerApplication.java | Created | `@EnableEurekaServer` |
| eureka-server/src/main/resources/application.yml | Created | Port 8761, standalone (no self-registration), self-preservation off (dev), 5 s eviction |
| eureka-server/Dockerfile | Created | |

## 4. Files Modified
None.

## 5. Implementation Details
Clients use `eureka.client.service-url.defaultZone: ${EUREKA_URL:http://localhost:8761/eureka}` and `eureka.instance.prefer-ip-address: true` (reliable in containers). Health is reported through actuator; the Docker/K8s probes use `/actuator/health/readiness`.

## 6. Architecture Details
Registration happens at service start; the gateway and Feign clients cache the registry and load-balance round-robin (Spring Cloud LoadBalancer). Verified: after start the dashboard lists `API-GATEWAY, COURSE-SERVICE, ENROLLMENT-SERVICE, NOTIFICATION-SERVICE, STUDENT-SERVICE`, and routed calls succeed through `lb://`.

## 7. Dependencies
`spring-cloud-starter-netflix-eureka-server` / `-client`, `spring-cloud-starter-loadbalancer`.

## 8. Configuration Changes
`EUREKA_URL` (services), `EUREKA_HOSTNAME` (server).

## 9. Database Changes
None.

## 10. API Changes
`GET http://localhost:8761/eureka/apps` (registry), dashboard at `/`.

## 11. Communication Changes
Heartbeats every 30 s (Eureka default); no Kafka.

## 12. Execution Instructions
`curl -s localhost:8761/eureka/apps -H 'Accept: application/json' | jq '.applications.application[].name'`.

## 13. Testing
Exercised implicitly by the live E2E run (gateway → services). Integration tests disable Eureka (`eureka.client.enabled=false`) and use direct URLs / mocks.

## 14. Pending Items
Single Eureka node, no authentication, self-preservation disabled (dev convenience) – harden for production.
