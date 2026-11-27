# 26 – Unit and Integration Testing

## 1. Feature Overview
JUnit 5 + Mockito unit tests, Spring Boot Test + Testcontainers integration tests (real MySQL 8, Kafka, Redis in containers) and a gateway-level end-to-end script.

## 2. Purpose
Prove the business rules, the data-consistency patterns (saga, outbox, inbox, idempotency, concurrency) and the infrastructure behaviour without touching the real databases.

## 3. Files Created
| File Path | Change Type | Description |
|---|---|---|
| common/common-web/src/test/java/com/example/common/security/JwtTokenServiceTest.java | Created | 4 tests |
| api-gateway/src/test/java/com/example/gateway/filter/JwtAuthGlobalFilterTest.java | Created | 3 tests |
| services/student-service/src/test/java/com/example/student/service/StudentServiceTest.java, AuthServiceTest.java; validation/PhoneNumberValidatorTest.java | Created | 7 + 8 + 11 |
| services/student-service/src/test/java/com/example/student/it/AbstractIT.java, StudentApiIT.java; src/test/resources/db/existing-student-schema.sql | Created | IT base (MySQL + Redis containers, legacy table), 7 ITs |
| services/course-service/src/test/java/com/example/course/service/SeatServiceTest.java, CourseServiceTest.java | Created | 9 + 4 |
| services/course-service/src/test/java/com/example/course/it/AbstractIT.java, SeatConcurrencyIT.java | Created | MySQL + Redis + Kafka containers, 7 ITs |
| services/enrollment-service/src/test/java/com/example/enrollment/saga/EnrollmentSagaOrchestratorTest.java; command/CommandHandlersTest.java; outbox/OutboxPublisherTest.java; entity/EnrollmentStatusTest.java | Created | 10 + 8 + 4 + 2 |
| services/enrollment-service/src/test/java/com/example/enrollment/it/AbstractIT.java, EnrollmentFlowIT.java, ResilienceIT.java | Created | MySQL + Kafka containers; 9 + 7 ITs |
| services/notification-service/src/test/java/com/example/notification/service/NotificationIngestServiceTest.java; processing/NotificationProcessorTest.java | Created | 6 + 6 |
| services/notification-service/src/test/java/com/example/notification/it/AbstractIT.java, NotificationKafkaIT.java | Created | MySQL + Kafka containers; 6 ITs |
| scripts/e2e.py | Created | 43 end-to-end assertions through the gateway |

## 4. Files Modified
`pom.xml` (failsafe plugin), `common/common-web/pom.xml` (test dependency), `services/student-service/src/test/java/…/StudentApiIT.java` and `services/course-service/src/test/java/…/it/AbstractIT.java` were adjusted *within* the testing phase (sort-whitelist assertion; Kafka container image) – see [29](29-Implementation-Change-Log.md).

## 5. Implementation Details
**Unit (82):** Student business logic and validation; Auth rules; Course/seat logic and capacity rules; Enrollment status machine; **saga orchestration and compensation** (10 scenarios incl. release after reservation failure, pause/recovery, duplicate constraint, idempotent replay, resume from persisted state); **CQRS command handlers**; outbox publisher (backoff, ordering); Notification ingest (inbox, duplicate), processor (retry/backoff/FAILED); JWT; gateway public paths.
**Integration (36):**
| Class | Count | What it proves |
|---|---|---|
| `StudentApiIT` | 7 | Flyway adds tables and preserves a legacy table/row; 401 without token; CRUD + **Redis** fill/update/evict + TTL; validation/duplicate; search/paging/sort; RBAC; BCrypt + hashed refresh tokens + rotation |
| `SeatConcurrencyIT` | 7 | 50-thread race (10 seats), idempotent concurrent release, same-enrollment race, CHECK constraint, cache eviction after commit, capacity change rules, low-availability event in Kafka |
| `EnrollmentFlowIT` | 9 | Happy path → events in Kafka; idempotent replay; DB duplicate guard; cancel + re-enroll; seat shortage + compensation; **atomic outbox rollback**; saga crash recovery; CQRS queries; **Kafka outage** (outbox retains, then delivers) |
| `ResilienceIT` | 7 | Feign↔HTTP stub: decoding, auth/correlation headers, 404/409 no-retry, retry, circuit breaker open/half-open/closed, timeouts, independent breakers |
| `NotificationKafkaIT` | 6 | Consume → notification SENT; duplicate event ids / facts → one notification; retry to success; retries exhausted → FAILED; low availability; poison message → `.DLT` and next message still processed |

**End-to-end (`scripts/e2e.py`, 43 assertions, through the gateway):** auth (6), master data (3), RBAC (9), enrollment workflows (15: success, replay, duplicate, unknown student/course, inactive, fill, sold-out, history/search, cancel, release, re-enroll), async notifications (4), 15-student/4-seat concurrency (3), plus availability checks.

## 6. Architecture Details
Integration tests start their own containers (MySQL `mysql:8.0`, Redis `redis:7-alpine`, Kafka `confluentinc/cp-kafka:7.6.0`) per module via static singletons and `@DynamicPropertySource`; Eureka is disabled; Enrollment ITs replace the Feign gateways with `@MockitoBean` except `ResilienceIT`, which uses a JDK `HttpServer` stub. **No test connects to the real StudentDB/CourseDB/EnrollmentDB/NotificationDB.**

## 7. Dependencies
`spring-boot-starter-test`, `spring-security-test`, `spring-boot-testcontainers`, `org.testcontainers:junit-jupiter|mysql|kafka`; Docker daemon required for `*IT`.

## 8. Configuration Changes
Tests override via properties (`eureka.client.enabled=false`, short scheduler intervals, `notification.dispatch.*`, `clients.*.url`).

## 9. Database Changes
None on real databases (containers only).

## 10. API Changes
None.

## 11. Communication Changes
None.

## 12. Execution Instructions
```bash
mvn test                                                      # unit tests only
mvn verify                                                    # unit + integration (Docker needed, ~12 min)
mvn -B verify -pl services/course-service -Dtest=NONE -Dsurefire.failIfNoSpecifiedTests=false   # ITs of one module
mvn -B verify -pl services/enrollment-service -Dtest=NONE -Dit.test=ResilienceIT -Dsurefire.failIfNoSpecifiedTests=false
scripts/start-local.sh && python3 scripts/e2e.py              # end-to-end
```

## 13. Testing – verified results
`mvn -B clean verify` (final): **BUILD SUCCESS**, reactor of 9 projects –

| Module | Unit | Integration |
|---|---|---|
| common-web | 4 | – |
| api-gateway | 3 | – |
| student-service | 26 | 7 |
| course-service | 13 | 7 |
| enrollment-service | 24 | 16 |
| notification-service | 12 | 6 |
| **Total** | **82** | **36** – 0 failures, 0 errors, 0 skipped |

`python3 scripts/e2e.py` on the final jars: **ALL CHECKS PASSED (43/43)**. Defects these tests uncovered (and that were fixed) are listed in [29](29-Implementation-Change-Log.md).

## 14. Pending Items
No gateway Spring-context test, no UI/browser tests, no performance/soak test, no Pact contract tests; the Docker Compose application stack is not covered by any test ([24](24-Docker-and-Docker-Compose.md)).
