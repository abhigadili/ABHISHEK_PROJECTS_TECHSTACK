# 01 – Project Setup and Maven Configuration

## 1. Feature Overview
A Maven multi-module reactor (`com.example:student-management:1.0.0`, packaging `pom`) with 8 modules. Every module is also buildable alone (`mvn -f <module>/pom.xml package`) once the parent and `common/*` are installed.

## 2. Purpose
One place to pin versions (Spring Boot parent + Spring Cloud BOM), shared test/IT wiring, and independent deployable artifacts per service.

## 3. Files Created
| File Path | Change Type | Description |
|---|---|---|
| pom.xml | Created | Parent: `spring-boot-starter-parent:3.4.5`, Spring Cloud BOM `2024.0.1`, managed versions for springdoc, jjwt, Resilience4j, internal modules; failsafe plugin |
| common/event-contracts/pom.xml | Created | Plain jar (no Spring/JPA) with Kafka event records |
| common/common-web/pom.xml | Created | Shared JWT/filter/error-handling library; servlet/security/kafka/springdoc deps are `optional` so the reactive gateway can reuse `JwtTokenService` |
| eureka-server/pom.xml | Created | Eureka server + actuator + Prometheus registry |
| api-gateway/pom.xml | Created | Spring Cloud Gateway (reactive), Eureka client, LoadBalancer, reactor Resilience4j, springdoc WebFlux |
| services/student-service/pom.xml | Created | Web, security, JPA, Flyway(+mysql), Redis/cache, Eureka client, springdoc, Micrometer/OTel, Lombok, Testcontainers |
| services/course-service/pom.xml | Created | As student + Kafka (+ Kafka test container) |
| services/enrollment-service/pom.xml | Created | As course minus Redis, plus OpenFeign, LoadBalancer, circuit-breaker + resilience4j-spring-boot3, AOP, feign-micrometer |
| services/notification-service/pom.xml | Created | JPA, Flyway, Kafka, no Redis/Feign |
| .gitignore | Created | `target/`, `.env`, logs |

## 4. Files Modified
| File Path | Change Type | Description |
|---|---|---|
| common/common-web/pom.xml | Modified | Added `spring-tx`, `springdoc` (optional), `spring-kafka` + `actuator` (optional, for the Kafka health indicator), `spring-boot-starter-test` (test) |
| pom.xml | Modified | Added `maven-failsafe-plugin` so `*IT` classes run on `mvn verify` |

## 5. Implementation Details
* `spring-boot-maven-plugin` is configured in `pluginManagement` to exclude Lombok from the fat jar.
* `common-web` registers its beans through `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` (no component scan of foreign packages).
* Integration tests are named `*IT` (failsafe); unit tests `*Test` (surefire).

## 6. Architecture Details
Suggested structure vs. actual: `common/common-messaging` was **not** created (messaging helpers are tiny and live in each service); the shared HTTP/security code is `common/common-web`; the `tests/` folder was **not** created – tests live next to the code of each module (`src/test/java`); `database/<service>/` contains documentation only because Flyway scripts must be on the classpath (`src/main/resources/db/migration`).

## 7. Dependencies
Maven 3.8.6 (tested), JDK 21. Module dependency graph: `student/course/enrollment/notification → common-web`; `course/enrollment/notification → event-contracts`; `api-gateway → common-web` (JWT only).

## 8. Configuration Changes
None (build only).

## 9. Database Changes
None.

## 10. API Changes
None.

## 11. Communication Changes
None.

## 12. Execution Instructions
```bash
mvn -DskipTests package          # all modules -> target/*.jar
mvn test                          # unit tests
mvn verify                        # unit + Testcontainers integration tests (needs Docker)
mvn -B -pl services/enrollment-service -am package   # one service + the modules it needs
```

## 13. Testing
`mvn clean verify` result: see [26](26-Unit-and-Integration-Testing.md).

## 14. Pending Items
No `tests/` aggregate module and no `common-messaging` module (by design, see §6).
