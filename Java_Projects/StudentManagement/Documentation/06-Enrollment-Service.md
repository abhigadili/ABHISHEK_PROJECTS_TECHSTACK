# 06 – Enrollment Service

## 1. Feature Overview
Enrolls students into courses through a persistent orchestration saga, with CQRS command/query separation, transactional outbox publishing, idempotency and duplicate prevention. Deep dives: [12 Saga](12-Saga-Pattern.md), [13 Outbox](13-Outbox-and-Inbox-Patterns.md), [14 Idempotency](14-Idempotency.md), [15 CQRS](15-CQRS-Implementation.md), [18 Resilience4j](18-Resilience4j-Patterns.md).

## 2. Purpose
Coordinate Student Service, Course Service and notifications without distributed transactions.

## 3. Files Created
Base `services/enrollment-service/src/main/java/com/example/enrollment/`:

| File Path | Change Type | Description |
|---|---|---|
| …/EnrollmentServiceApplication.java | Created | `@EnableFeignClients @EnableScheduling` |
| …/controller/EnrollmentController.java | Created | Enrollment endpoints (dispatches to command/query handlers) |
| …/command/*.java (CreateEnrollmentCommand, CancelEnrollmentCommand, UpdateEnrollmentCommand, EnrollmentOutcome, CreateEnrollmentCommandHandler, CancelEnrollmentCommandHandler, UpdateEnrollmentCommandHandler) | Created | Write side |
| …/query/EnrollmentQueries.java, EnrollmentQueryHandlers.java, EnrollmentSpecifications.java | Created | Read side |
| …/saga/EnrollmentSagaOrchestrator.java, SagaRecoveryJob.java, SagaPausedException.java | Created | Saga |
| …/outbox/OutboxWriter.java, OutboxPublisher.java | Created | Transactional outbox |
| …/event/EnrollmentEventRecorder.java | Created | Builds events, writes them to the outbox (MANDATORY transaction) |
| …/client/StudentClient.java, CourseClient.java, StudentGateway.java, CourseGateway.java, FeignConfig.java, RemoteCall.java, RemoteDtos.java, RemoteExceptions.java, TracingContextPropagator.java | Created | Synchronous communication ([10](10-Service-to-Service-Communication.md)) |
| …/entity/Enrollment.java, EnrollmentStatus.java, SagaInstance.java, SagaState.java, OutboxEvent.java, OutboxStatus.java | Created | Entities / state machines |
| …/repository/EnrollmentRepository.java, SagaInstanceRepository.java, OutboxEventRepository.java | Created | `lockDue` uses `FOR UPDATE SKIP LOCKED` |
| …/dto/EnrollmentRequest.java, EnrollmentResponse.java, EnrollmentUpdateRequest.java, CancelRequest.java | Created | Records |
| …/config/SecurityConfig.java, KafkaConfig.java | Created | JWT chain; declares the four enrollment topics |
| services/enrollment-service/src/main/resources/application.yml, db/migration/V1__create_enrollment_tables.sql | Created | Config incl. Resilience4j; schema |
| services/enrollment-service/src/test/java/com/example/enrollment/saga/EnrollmentSagaOrchestratorTest.java, command/CommandHandlersTest.java, outbox/OutboxPublisherTest.java, entity/EnrollmentStatusTest.java | Created | Unit tests |
| services/enrollment-service/src/test/java/com/example/enrollment/it/AbstractIT.java, EnrollmentFlowIT.java, ResilienceIT.java | Created | Integration tests |
| services/enrollment-service/Dockerfile | Created | |

## 4. Files Modified
| File Path | Change Type | Description |
|---|---|---|
| services/enrollment-service/src/main/resources/application.yml | Modified | `server.forward-headers-strategy`; Kafka template observation; `thread-pool-bulkhead…context-propagators` |

## 5. Implementation Details
* Statuses: `PENDING → CONFIRMED | REJECTED`, `CONFIRMED → CANCELLED` (enforced by `EnrollmentStatus.allowedNext()`; illegal transitions → 422).
* `POST /api/enrollments` outcome mapping: `201 CONFIRMED`, `422 REJECTED` (reason in body), `202 IN_PROGRESS` (saga paused; recovery resumes it), `409` (active duplicate), `403` (student enrolling someone else).
* `student_name`, `student_email`, `course_name` are snapshotted into the enrollment so events and cancellations need no extra remote calls.

## 6. Architecture Details
Owns EnrollmentDB. Consumes Student/Course over REST (Eureka + client-side load balancing), produces all `enrollment.*` events through the outbox.

## 7. Dependencies
Web, Validation, Security, JPA, Flyway, Kafka, OpenFeign, LoadBalancer, circuit-breaker-resilience4j, `resilience4j-spring-boot3`, AOP, `feign-micrometer`, Eureka client, springdoc, Micrometer/OTel, `event-contracts`, `common-web`.

## 8. Configuration Changes
`enrollment.saga.*`, `enrollment.outbox.*`, `resilience4j.*`, `spring.cloud.openfeign.client.config.default.*` ([28](28-Configuration-and-Environment-Variables.md)).

## 9. Database Changes
`sms_enrollments`, `sms_saga_instances`, `sms_outbox_events` ([03](03-MySQL-Database-Configuration.md)).

## 10. API Changes
| Method & path | Roles |
|---|---|
| `POST /api/enrollments` (`Idempotency-Key` header optional) | ADMIN, STAFF, STUDENT(self) |
| `POST /api/enrollments/{id}/cancel` `{"reason":"…"}` | ADMIN, STAFF, STUDENT(own) |
| `PUT /api/enrollments/{id}` `{"remarks":"…"}` | ADMIN, STAFF |
| `GET /api/enrollments/{id}` | ADMIN, STAFF, STUDENT(own) |
| `GET /api/enrollments?studentId&courseId&status&from&to&page&size&sort` | ADMIN, STAFF |
| `GET /api/enrollments/student/{studentId}` | ADMIN, STAFF, STUDENT(own) |
| `GET /api/enrollments/course/{courseId}?status=` | ADMIN, STAFF |

## 11. Communication Changes
Feign → `student-service` (`/api/students/{id}`, `/eligibility`), `course-service` (`/api/courses/{id}`, `/availability`, `/seats/reserve|release`). Kafka producer of `enrollment.requested|confirmed|rejected|cancelled` (outbox), no consumers.

## 12. Execution Instructions
`scripts/start-local.sh`; `python3 scripts/e2e.py` exercises every workflow (below).

## 13. Testing
Unit: saga (10), command handlers (8), outbox publisher (4), status machine (2). Integration: `EnrollmentFlowIT` (9) – happy path to Kafka, idempotent replay, DB duplicate guard, cancel + re-enroll, rejection + compensation, atomic outbox rollback, crash recovery, CQRS queries, **Kafka outage** (outbox keeps events and delivers after recovery); `ResilienceIT` (7). End-to-end through the gateway: success, replay, duplicate (409), unknown student/course, inactive student, sold-out, cancel, re-enroll, 15-way concurrency – all green ([26](26-Unit-and-Integration-Testing.md)).

## 14. Pending Items
Trace context is not propagated across the outbox hop (the poller runs in its own thread/span), so the Kafka consumer's trace is separate from the HTTP request's trace.
