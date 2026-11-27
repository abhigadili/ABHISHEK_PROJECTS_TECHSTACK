# 29 – Implementation Change Log

Central, chronological record. All work was done on **2026-11-10** (IST, roughly 15:20–17:00) in one session; the prompt's phases were implemented in the order shown in the sequence table (security and Redis were pulled forward into the first service build; the gateway came after the services). Individual file descriptions are in the feature documents ([00](00-Project-Overview.md) → [28](28-Configuration-and-Environment-Variables.md)).

## 1. Feature Overview
This file lists, per implementation phase: features, files created/modified, databases/tables, dependencies, configuration, tests + results, known issues.

## 2. Purpose
Auditable history that matches the code (paths are generated from the file system; modification entries record real edits only).

## 3. Files Created
Per phase below (generated list; every file of the repository except `Documentation/` appears in exactly one phase).

## 4. Files Modified
Per phase below. Files created and edited within the *same* phase are listed only as Created.

## 5. Implementation Details
### Actual implementation sequence
| Time (IST) | Step | Result |
|---|---|---|
| 15:20 | Parent POM, event-contracts, common-web, Eureka | built |
| 15:28 | Student Service (CRUD, auth, Redis) | live-verified |
| 15:31 | Course Service (seats, Kafka, Redis) | live-verified incl. 50-way race |
| 15:34 | Notification Service | consumed 6 events |
| 15:41 | Enrollment Service (Feign, saga, outbox, CQRS, Resilience4j) | first E2E exposed a test-data collision and the non-retryable notification case |
| 15:45 | API Gateway, run scripts, `e2e.py` | 43/43 |
| 15:55–16:20 | Unit tests (82), integration tests (36) | found V2 migration need and DLT bug |
| 16:20–16:45 | Dockerfiles, Compose, Kubernetes, Prometheus/Grafana, JSON logs | Compose app stack blocked (see §14) |
| 16:45–17:00 | Final fixes, docs, `mvn clean verify`, final E2E | all green |

### Defects found by testing and fixed
| Found by | Defect | Fix |
|---|---|---|
| Live E2E (run 1) | Manual seat tests with fake enrollment ids collided with real ids (test-data artefact, not a code bug) | Cleared my own `sms_*` test rows (original tables untouched) |
| Live E2E (run 1) | Notification with no recipient retried like a transient failure | `NonRetryableNotificationException` → FAILED immediately |
| Notification start-up | `KafkaTemplate` bean missing once a custom template was defined | Explicit JSON template bean |
| `StudentApiIT` | Deleting a student that has a login → 409 FK error | Flyway `V2` (`ON DELETE CASCADE`) |
| `NotificationKafkaIT` | Dead-letter topic mismatch (`-dlt` vs `.DLT`) blocked the consumer 60 s | Explicit destination resolver + `max.block.ms` |
| Live check | `/actuator/prometheus` hung | Self-inflicted: jars rebuilt under running JVMs; restart (documented in troubleshooting) |
| Live check | Request log line had no traceId | Filter order moved inside the observation scope |
| Review | Student search accepted any sort field (would 500) | Whitelist (400) |


## Phase 1 – Project Setup, Persistence and CRUD APIs

**Implementation date:** 2026-11-10  
**Features completed:** Maven reactor, common modules, 4 databases connected, Flyway baseline + V1 migrations, JPA entities/repositories, DTOs/mappers/validation, CRUD + search/filter/paging APIs for Student, Course, Enrollment (basic) and Notification history, error handling, OpenAPI annotations.

**Files created (80)**

| File Path | Change Type | Description |
|---|---|---|
| .gitignore | Created | Ignore rules |
| common/common-web/pom.xml | Created | Module POM |
| common/common-web/src/main/java/com/example/common/CommonAutoConfiguration.java | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| common/common-web/src/main/java/com/example/common/exception/ApiError.java | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| common/common-web/src/main/java/com/example/common/exception/BusinessRuleException.java | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| common/common-web/src/main/java/com/example/common/exception/ConflictException.java | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| common/common-web/src/main/java/com/example/common/exception/GlobalExceptionHandler.java | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| common/common-web/src/main/java/com/example/common/exception/ResourceNotFoundException.java | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| common/common-web/src/main/java/com/example/common/exception/ServiceUnavailableException.java | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| common/common-web/src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| common/event-contracts/pom.xml | Created | Module POM |
| database/course-service/README.md | Created | Per-service schema notes |
| database/enrollment-service/README.md | Created | Per-service schema notes |
| database/notification-service/README.md | Created | Per-service schema notes |
| database/student-service/README.md | Created | Per-service schema notes |
| pom.xml | Created | Parent POM / reactor |
| services/course-service/pom.xml | Created | Service module POM |
| services/course-service/src/main/java/com/example/course/CourseServiceApplication.java | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| services/course-service/src/main/java/com/example/course/controller/CategoryController.java | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| services/course-service/src/main/java/com/example/course/controller/CourseController.java | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| services/course-service/src/main/java/com/example/course/dto/CategoryDtos.java | Created | DTO records |
| services/course-service/src/main/java/com/example/course/dto/CourseAvailabilityResponse.java | Created | DTO records |
| services/course-service/src/main/java/com/example/course/dto/CourseRequest.java | Created | DTO records |
| services/course-service/src/main/java/com/example/course/dto/CourseResponse.java | Created | DTO records |
| services/course-service/src/main/java/com/example/course/dto/StatusRequest.java | Created | DTO records |
| services/course-service/src/main/java/com/example/course/entity/Course.java | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| services/course-service/src/main/java/com/example/course/entity/CourseCategory.java | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| services/course-service/src/main/java/com/example/course/entity/CourseStatus.java | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| services/course-service/src/main/java/com/example/course/mapper/CourseMapper.java | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| services/course-service/src/main/java/com/example/course/repository/CourseCategoryRepository.java | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| services/course-service/src/main/java/com/example/course/repository/CourseRepository.java | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| services/course-service/src/main/java/com/example/course/repository/CourseSpecifications.java | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| services/course-service/src/main/java/com/example/course/service/CategoryService.java | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| services/course-service/src/main/java/com/example/course/service/CourseService.java | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| services/course-service/src/main/java/com/example/course/validation/CourseCodeValidator.java | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| services/course-service/src/main/java/com/example/course/validation/ValidCourseCode.java | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| services/course-service/src/main/resources/application.yml | Created | Service configuration (datasource, Flyway, JPA, Eureka, actuator, tracing, ...) |
| services/course-service/src/main/resources/db/migration/V1__create_course_tables.sql | Created | Flyway migration (new sms_* tables only) |
| services/enrollment-service/pom.xml | Created | Service module POM |
| services/enrollment-service/src/main/java/com/example/enrollment/EnrollmentServiceApplication.java | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| services/enrollment-service/src/main/java/com/example/enrollment/controller/EnrollmentController.java | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| services/enrollment-service/src/main/java/com/example/enrollment/dto/CancelRequest.java | Created | DTO records |
| services/enrollment-service/src/main/java/com/example/enrollment/dto/EnrollmentRequest.java | Created | DTO records |
| services/enrollment-service/src/main/java/com/example/enrollment/dto/EnrollmentResponse.java | Created | DTO records |
| services/enrollment-service/src/main/java/com/example/enrollment/dto/EnrollmentUpdateRequest.java | Created | DTO records |
| services/enrollment-service/src/main/java/com/example/enrollment/entity/Enrollment.java | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| services/enrollment-service/src/main/java/com/example/enrollment/entity/EnrollmentStatus.java | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| services/enrollment-service/src/main/java/com/example/enrollment/repository/EnrollmentRepository.java | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| services/enrollment-service/src/main/resources/application.yml | Created | Service configuration (datasource, Flyway, JPA, Eureka, actuator, tracing, ...) |
| services/enrollment-service/src/main/resources/db/migration/V1__create_enrollment_tables.sql | Created | Flyway migration (new sms_* tables only) |
| services/notification-service/pom.xml | Created | Service module POM |
| services/notification-service/src/main/java/com/example/notification/NotificationServiceApplication.java | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| services/notification-service/src/main/java/com/example/notification/controller/NotificationController.java | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| services/notification-service/src/main/java/com/example/notification/dto/NotificationResponse.java | Created | DTO records |
| services/notification-service/src/main/java/com/example/notification/entity/Notification.java | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| services/notification-service/src/main/java/com/example/notification/entity/NotificationStatus.java | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| services/notification-service/src/main/java/com/example/notification/entity/NotificationType.java | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| services/notification-service/src/main/java/com/example/notification/mapper/NotificationMapper.java | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| services/notification-service/src/main/java/com/example/notification/repository/NotificationRepository.java | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| services/notification-service/src/main/java/com/example/notification/service/NotificationQueryService.java | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| services/notification-service/src/main/resources/application.yml | Created | Service configuration (datasource, Flyway, JPA, Eureka, actuator, tracing, ...) |
| services/notification-service/src/main/resources/db/migration/V1__create_notification_tables.sql | Created | Flyway migration (new sms_* tables only) |
| services/student-service/pom.xml | Created | Service module POM |
| services/student-service/src/main/java/com/example/student/StudentServiceApplication.java | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| services/student-service/src/main/java/com/example/student/controller/StudentController.java | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| services/student-service/src/main/java/com/example/student/dto/EligibilityResponse.java | Created | DTO records |
| services/student-service/src/main/java/com/example/student/dto/StatusUpdateRequest.java | Created | DTO records |
| services/student-service/src/main/java/com/example/student/dto/StudentRequest.java | Created | DTO records |
| services/student-service/src/main/java/com/example/student/dto/StudentResponse.java | Created | DTO records |
| services/student-service/src/main/java/com/example/student/entity/Gender.java | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| services/student-service/src/main/java/com/example/student/entity/Student.java | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| services/student-service/src/main/java/com/example/student/entity/StudentStatus.java | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| services/student-service/src/main/java/com/example/student/mapper/StudentMapper.java | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| services/student-service/src/main/java/com/example/student/repository/StudentRepository.java | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| services/student-service/src/main/java/com/example/student/repository/StudentSpecifications.java | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| services/student-service/src/main/java/com/example/student/service/StudentService.java | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| services/student-service/src/main/java/com/example/student/validation/PhoneNumberValidator.java | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| services/student-service/src/main/java/com/example/student/validation/ValidPhoneNumber.java | Created | Application source (entities, DTOs, mappers, services, controllers, repositories, validation, configuration, migrations) |
| services/student-service/src/main/resources/application.yml | Created | Service configuration (datasource, Flyway, JPA, Eureka, actuator, tracing, ...) |
| services/student-service/src/main/resources/db/migration/V1__create_student_and_auth_tables.sql | Created | Flyway migration (new sms_* tables only) |

**Files modified:** none.

**Databases and tables affected:** StudentDB: sms_students, sms_users, sms_refresh_tokens (+flyway_schema_history); CourseDB: sms_course_categories, sms_courses, sms_seat_reservations; EnrollmentDB: sms_enrollments, sms_saga_instances, sms_outbox_events; NotificationDB: sms_notifications, sms_inbox_messages. (Created in the phase that introduced the Flyway V1 scripts; saga/outbox/inbox/seat-reservation/auth tables were part of those V1 scripts.)

**Maven dependencies added or updated:** spring-boot-starter-web/validation/data-jpa/actuator, mysql-connector-j, flyway-core + flyway-mysql, lombok, springdoc-openapi-starter-webmvc-ui, spring-boot-starter-test, testcontainers (junit-jupiter, mysql), jjwt 0.12.6, spring-boot-starter-security (in common-web)

**Configuration changes:** `application.yml` for 4 services (datasource, flyway, jpa, eureka, management, logging pattern)

**Tests executed and results:** Live (curl): student CRUD/validation/duplicate/search, auth (login, refresh rotation, role checks), Redis cache key present; course CRUD/validation, **50 parallel reservations on 10 seats → 10×200 / 40×409, final seats 0, 10 RESERVED rows**, idempotent replay/release.


## Phase 2 – API Gateway and Service Discovery

**Implementation date:** 2026-11-10  
**Features completed:** Eureka server; all services register; Spring Cloud Gateway with 4 service routes, circuit-breaker fallbacks, CORS, correlation id, request logging, Swagger aggregation, JWT edge filter.

**Files created (11)**

| File Path | Change Type | Description |
|---|---|---|
| api-gateway/pom.xml | Created | Gateway module POM |
| api-gateway/src/main/java/com/example/gateway/ApiGatewayApplication.java | Created | API Gateway (routes, filters, fallback, Swagger aggregation) |
| api-gateway/src/main/java/com/example/gateway/controller/FallbackController.java | Created | API Gateway (routes, filters, fallback, Swagger aggregation) |
| api-gateway/src/main/java/com/example/gateway/filter/CorrelationIdGlobalFilter.java | Created | API Gateway (routes, filters, fallback, Swagger aggregation) |
| api-gateway/src/main/java/com/example/gateway/filter/JwtAuthGlobalFilter.java | Created | API Gateway (routes, filters, fallback, Swagger aggregation) |
| api-gateway/src/main/resources/application.yml | Created | API Gateway (routes, filters, fallback, Swagger aggregation) |
| eureka-server/pom.xml | Created | Eureka module POM |
| eureka-server/src/main/java/com/example/eureka/EurekaServerApplication.java | Created | Eureka server |
| eureka-server/src/main/resources/application.yml | Created | Eureka server |
| scripts/start-local.sh | Created | Starts Eureka, services and gateway on the host |
| scripts/stop-local.sh | Created | Stops them by listening port |

**Files modified**

| File Path | Change Type | Description |
|---|---|---|
| services/student-service/src/main/resources/application.yml | Modified | Added `server.forward-headers-strategy: framework` |
| services/course-service/src/main/resources/application.yml | Modified | Same |
| services/enrollment-service/src/main/resources/application.yml | Modified | Same |
| services/notification-service/src/main/resources/application.yml | Modified | Same |

**Databases and tables affected:** none

**Maven dependencies added or updated:** spring-cloud-starter-netflix-eureka-server/client, spring-cloud-starter-gateway, spring-cloud-starter-loadbalancer, spring-cloud-starter-circuitbreaker-reactor-resilience4j, springdoc-openapi-starter-webflux-ui

**Configuration changes:** `application.yml` for gateway/Eureka; `forward-headers-strategy` in services

**Tests executed and results:** Live: whole stack through the gateway; Eureka registrations; `scripts/e2e.py` 43/43 PASS.


## Phase 3 – Synchronous Communication

**Implementation date:** 2026-11-10  
**Features completed:** Feign clients for Student/Course, error decoder (404/409/4xx/5xx), service-to-service JWT, timeouts, retry/circuit-breaker/time-limiter/bulkhead facades, graceful failure mapping.

**Files created (9)**

| File Path | Change Type | Description |
|---|---|---|
| services/enrollment-service/src/main/java/com/example/enrollment/client/CourseClient.java | Created | Feign clients, error decoding, Resilience4j gateways (sync communication) |
| services/enrollment-service/src/main/java/com/example/enrollment/client/CourseGateway.java | Created | Feign clients, error decoding, Resilience4j gateways (sync communication) |
| services/enrollment-service/src/main/java/com/example/enrollment/client/FeignConfig.java | Created | Feign clients, error decoding, Resilience4j gateways (sync communication) |
| services/enrollment-service/src/main/java/com/example/enrollment/client/RemoteCall.java | Created | Feign clients, error decoding, Resilience4j gateways (sync communication) |
| services/enrollment-service/src/main/java/com/example/enrollment/client/RemoteDtos.java | Created | Feign clients, error decoding, Resilience4j gateways (sync communication) |
| services/enrollment-service/src/main/java/com/example/enrollment/client/RemoteExceptions.java | Created | Feign clients, error decoding, Resilience4j gateways (sync communication) |
| services/enrollment-service/src/main/java/com/example/enrollment/client/StudentClient.java | Created | Feign clients, error decoding, Resilience4j gateways (sync communication) |
| services/enrollment-service/src/main/java/com/example/enrollment/client/StudentGateway.java | Created | Feign clients, error decoding, Resilience4j gateways (sync communication) |
| services/enrollment-service/src/main/java/com/example/enrollment/client/TracingContextPropagator.java | Created | Feign clients, error decoding, Resilience4j gateways (sync communication) |

**Files modified:** none.

**Databases and tables affected:** none

**Maven dependencies added or updated:** spring-cloud-starter-openfeign, spring-cloud-starter-circuitbreaker-resilience4j, resilience4j-spring-boot3 2.2.0, spring-boot-starter-aop, feign-micrometer

**Configuration changes:** `spring.cloud.openfeign.client.config.default.*`, `resilience4j.*` (enrollment)

**Tests executed and results:** Live E2E (real Student/Course calls); unit tests of gateways via mocks; `ResilienceIT` 7/7.


## Phase 4 – Asynchronous Communication

**Implementation date:** 2026-11-10  
**Features completed:** Kafka topics + DLTs, event contracts, Notification consumers (retry then dead-letter), Course low-availability publisher, Kafka health check.

**Files created (12)**

| File Path | Change Type | Description |
|---|---|---|
| .env | Created | Compose variables (created with the infrastructure compose file) |
| .env.example | Created | Compose variables (created with the infrastructure compose file) |
| common/event-contracts/src/main/java/com/example/events/EnrollmentEvent.java | Created | Kafka event contracts and topic names |
| common/event-contracts/src/main/java/com/example/events/EnrollmentEventType.java | Created | Kafka event contracts and topic names |
| common/event-contracts/src/main/java/com/example/events/LowCourseAvailabilityEvent.java | Created | Kafka event contracts and topic names |
| common/event-contracts/src/main/java/com/example/events/Topics.java | Created | Kafka event contracts and topic names |
| docker-compose.yml | Created | Compose file, first created with the infrastructure services only (kafka, redis, jaeger) |
| services/course-service/src/main/java/com/example/course/config/KafkaConfig.java | Created | Course topic declaration |
| services/course-service/src/main/java/com/example/course/service/LowAvailabilityPublisher.java | Created | LowCourseAvailability publisher (after commit) |
| services/enrollment-service/src/main/java/com/example/enrollment/config/KafkaConfig.java | Created | Enrollment topic declarations |
| services/notification-service/src/main/java/com/example/notification/config/KafkaConfig.java | Created | Topics/DLT, templates, retry + dead-letter error handler |
| services/notification-service/src/main/java/com/example/notification/consumer/EventConsumers.java | Created | Kafka consumers |

**Files modified**

| File Path | Change Type | Description |
|---|---|---|
| services/notification-service/src/main/java/com/example/notification/config/KafkaConfig.java | Modified | Added explicit `KafkaTemplate<String,Object>` bean (Boot backs off once another template exists; first start failed with a missing-bean error) |

**Databases and tables affected:** none

**Maven dependencies added or updated:** spring-kafka (+ event-contracts module), testcontainers kafka

**Configuration changes:** `spring.kafka.*` (course, enrollment, notification), `notification.consumer.*`

**Tests executed and results:** Live: Notification service consumed 6 low-availability events written earlier by Course Service (group started at `earliest`) → 6 notifications SENT; `NotificationKafkaIT` 6/6 (after the DLT fix).


## Phase 5 – Distributed Workflows (Saga, Outbox, Inbox, Idempotency)

**Implementation date:** 2026-11-10  
**Features completed:** Persistent orchestration saga with compensation + recovery job; transactional outbox with background publisher; inbox/processed-message table; idempotency keys and unique constraints; background notification dispatcher with retry.

**Files created (18)**

| File Path | Change Type | Description |
|---|---|---|
| services/enrollment-service/src/main/java/com/example/enrollment/entity/OutboxEvent.java | Created | Outbox entity/enum |
| services/enrollment-service/src/main/java/com/example/enrollment/entity/OutboxStatus.java | Created | Outbox entity/enum |
| services/enrollment-service/src/main/java/com/example/enrollment/entity/SagaInstance.java | Created | Saga state entity/enum |
| services/enrollment-service/src/main/java/com/example/enrollment/entity/SagaState.java | Created | Saga state entity/enum |
| services/enrollment-service/src/main/java/com/example/enrollment/event/EnrollmentEventRecorder.java | Created | Event recorder (outbox writer facade) |
| services/enrollment-service/src/main/java/com/example/enrollment/outbox/OutboxPublisher.java | Created | Transactional outbox |
| services/enrollment-service/src/main/java/com/example/enrollment/outbox/OutboxWriter.java | Created | Transactional outbox |
| services/enrollment-service/src/main/java/com/example/enrollment/repository/OutboxEventRepository.java | Created | Outbox repository |
| services/enrollment-service/src/main/java/com/example/enrollment/repository/SagaInstanceRepository.java | Created | Saga repository |
| services/enrollment-service/src/main/java/com/example/enrollment/saga/EnrollmentSagaOrchestrator.java | Created | Orchestration saga + recovery |
| services/enrollment-service/src/main/java/com/example/enrollment/saga/SagaPausedException.java | Created | Orchestration saga + recovery |
| services/enrollment-service/src/main/java/com/example/enrollment/saga/SagaRecoveryJob.java | Created | Orchestration saga + recovery |
| services/notification-service/src/main/java/com/example/notification/entity/InboxMessage.java | Created | Inbox entity |
| services/notification-service/src/main/java/com/example/notification/processing/EmailSimulator.java | Created | Background dispatcher, retry/backoff, e-mail simulation |
| services/notification-service/src/main/java/com/example/notification/processing/NotificationDispatcher.java | Created | Background dispatcher, retry/backoff, e-mail simulation |
| services/notification-service/src/main/java/com/example/notification/processing/NotificationProcessor.java | Created | Background dispatcher, retry/backoff, e-mail simulation |
| services/notification-service/src/main/java/com/example/notification/repository/InboxMessageRepository.java | Created | Inbox repository |
| services/notification-service/src/main/java/com/example/notification/service/NotificationIngestService.java | Created | Inbox + notification creation (idempotent) |

**Files modified**

| File Path | Change Type | Description |
|---|---|---|
| services/notification-service/src/main/java/com/example/notification/processing/EmailSimulator.java | Modified | Missing recipient now throws `NonRetryableNotificationException` |
| services/notification-service/src/main/java/com/example/notification/processing/NotificationProcessor.java | Modified | Non-retryable failures go straight to FAILED (found in the first live E2E run: unknown-student notifications were retried) |

**Databases and tables affected:** none (tables already in V1)

**Maven dependencies added or updated:** (none new)

**Configuration changes:** `enrollment.saga.*`, `enrollment.outbox.*`, `notification.dispatch.*`

**Tests executed and results:** Live E2E: success, replay, duplicate 409, unknown/inactive/sold-out rejections, cancel, re-enroll, notifications, 15-way concurrency; units (saga 10, outbox 4, ingest 6, processor 6); `EnrollmentFlowIT` 9/9 incl. Kafka outage.


## Phase 6 – Security

**Implementation date:** 2026-11-10  
**Features completed:** User registration/login, BCrypt, JWT + refresh-token rotation, roles ADMIN/STAFF/STUDENT (+SERVICE), method security in all services, bootstrap admin. Implemented early (together with Phase 1) because every endpoint needed it.

**Files created (19)**

| File Path | Change Type | Description |
|---|---|---|
| common/common-web/src/main/java/com/example/common/exception/UnauthorizedException.java | Created | 401 exception |
| common/common-web/src/main/java/com/example/common/security/AuthenticatedUser.java | Created | JWT service, filter, principal, JSON 401/403 |
| common/common-web/src/main/java/com/example/common/security/JsonSecurityHandlers.java | Created | JWT service, filter, principal, JSON 401/403 |
| common/common-web/src/main/java/com/example/common/security/JwtAuthenticationFilter.java | Created | JWT service, filter, principal, JSON 401/403 |
| common/common-web/src/main/java/com/example/common/security/JwtProperties.java | Created | JWT service, filter, principal, JSON 401/403 |
| common/common-web/src/main/java/com/example/common/security/JwtTokenService.java | Created | JWT service, filter, principal, JSON 401/403 |
| services/course-service/src/main/java/com/example/course/config/SecurityConfig.java | Created | Stateless JWT security chain |
| services/enrollment-service/src/main/java/com/example/enrollment/config/SecurityConfig.java | Created | Stateless JWT security chain |
| services/notification-service/src/main/java/com/example/notification/config/SecurityConfig.java | Created | Stateless JWT security chain |
| services/student-service/src/main/java/com/example/student/config/AdminBootstrap.java | Created | Bootstrap admin account |
| services/student-service/src/main/java/com/example/student/config/SecurityConfig.java | Created | Stateless JWT security chain |
| services/student-service/src/main/java/com/example/student/controller/AuthController.java | Created | Auth endpoints |
| services/student-service/src/main/java/com/example/student/dto/AuthDtos.java | Created | Auth DTO records |
| services/student-service/src/main/java/com/example/student/entity/RefreshToken.java | Created | Refresh-token entity |
| services/student-service/src/main/java/com/example/student/entity/Role.java | Created | Role enum |
| services/student-service/src/main/java/com/example/student/entity/UserAccount.java | Created | User entity |
| services/student-service/src/main/java/com/example/student/repository/RefreshTokenRepository.java | Created | Refresh-token repository |
| services/student-service/src/main/java/com/example/student/repository/UserAccountRepository.java | Created | User repository |
| services/student-service/src/main/java/com/example/student/service/AuthService.java | Created | Registration/login/refresh rotation |

**Files modified**

| File Path | Change Type | Description |
|---|---|---|
| common/common-web/src/main/java/com/example/common/exception/GlobalExceptionHandler.java | Modified | Handler for `UnauthorizedException` (401) |
| common/common-web/src/main/java/com/example/common/CommonAutoConfiguration.java | Modified | Added OpenAPI bean with the JWT bearer scheme |
| common/common-web/pom.xml | Modified | Added `spring-tx` and optional springdoc dependency |

**Databases and tables affected:** none (tables already in V1)

**Maven dependencies added or updated:** spring-boot-starter-security (services), spring-security-test, jjwt-api/impl/jackson

**Configuration changes:** `app.security.jwt.*`, `app.bootstrap.*`

**Tests executed and results:** Units (JWT 4, auth 8, gateway filter 3); `StudentApiIT` RBAC/BCrypt/refresh; 15 E2E assertions.


## Phase 7 – Performance and Resilience (Redis, CQRS, Resilience4j, Concurrency)

**Implementation date:** 2026-11-10  
**Features completed:** Redis caches (student, course, availability) with TTL/eviction, CQRS commands/queries, Resilience4j config, atomic seat updates + CHECK constraint + optimistic lock. Redis caching was first written together with the Student/Course services in Phase 1.

**Files created (18)**

| File Path | Change Type | Description |
|---|---|---|
| services/course-service/src/main/java/com/example/course/config/CacheConfig.java | Created | Redis cache manager + error handler |
| services/course-service/src/main/java/com/example/course/config/CourseCacheEvictor.java | Created | After-commit cache eviction |
| services/course-service/src/main/java/com/example/course/dto/SeatDtos.java | Created | Seat DTOs |
| services/course-service/src/main/java/com/example/course/entity/ReservationStatus.java | Created | Enum |
| services/course-service/src/main/java/com/example/course/entity/SeatReservation.java | Created | Seat reservation (idempotency key) |
| services/course-service/src/main/java/com/example/course/repository/SeatReservationRepository.java | Created | Repository |
| services/course-service/src/main/java/com/example/course/service/SeatService.java | Created | Atomic, idempotent seat reserve/release |
| services/enrollment-service/src/main/java/com/example/enrollment/command/CancelEnrollmentCommand.java | Created | CQRS command side |
| services/enrollment-service/src/main/java/com/example/enrollment/command/CancelEnrollmentCommandHandler.java | Created | CQRS command side |
| services/enrollment-service/src/main/java/com/example/enrollment/command/CreateEnrollmentCommand.java | Created | CQRS command side |
| services/enrollment-service/src/main/java/com/example/enrollment/command/CreateEnrollmentCommandHandler.java | Created | CQRS command side |
| services/enrollment-service/src/main/java/com/example/enrollment/command/EnrollmentOutcome.java | Created | CQRS command side |
| services/enrollment-service/src/main/java/com/example/enrollment/command/UpdateEnrollmentCommand.java | Created | CQRS command side |
| services/enrollment-service/src/main/java/com/example/enrollment/command/UpdateEnrollmentCommandHandler.java | Created | CQRS command side |
| services/enrollment-service/src/main/java/com/example/enrollment/query/EnrollmentQueries.java | Created | CQRS query side |
| services/enrollment-service/src/main/java/com/example/enrollment/query/EnrollmentQueryHandlers.java | Created | CQRS query side |
| services/enrollment-service/src/main/java/com/example/enrollment/query/EnrollmentSpecifications.java | Created | CQRS query side |
| services/student-service/src/main/java/com/example/student/config/CacheConfig.java | Created | Redis cache manager + error handler |

**Files modified**

| File Path | Change Type | Description |
|---|---|---|
| services/enrollment-service/src/main/resources/application.yml | Modified | Added `thread-pool-bulkhead…context-propagators` |

**Databases and tables affected:** none (CHECK constraint, `@Version` column and generated `active_key` already in V1)

**Maven dependencies added or updated:** spring-boot-starter-data-redis, spring-boot-starter-cache

**Configuration changes:** `spring.data.redis.*`, `spring.cache.type`, `app.cache.*`, `app.course.low-availability-threshold`, context propagator

**Tests executed and results:** `SeatConcurrencyIT` 7/7; cache assertions in `StudentApiIT`; `ResilienceIT`; handler unit tests (8).


## Phase 8 – Observability

**Implementation date:** 2026-11-10  
**Features completed:** Correlation-id/trace-id logging, structured JSON logging switch, OpenTelemetry tracing to Jaeger, Micrometer + Prometheus + Grafana provisioning, Actuator liveness/readiness with MySQL/Redis/Kafka checks, custom outbox metrics.

**Files created (7)**

| File Path | Change Type | Description |
|---|---|---|
| common/common-web/src/main/java/com/example/common/KafkaHealthAutoConfiguration.java | Created | Kafka health indicator |
| common/common-web/src/main/java/com/example/common/web/CorrelationIdFilter.java | Created | Correlation id + request logging filter |
| monitoring/grafana/dashboards/student-management.json | Created | Prometheus + Grafana configuration |
| monitoring/grafana/provisioning/dashboards/dashboards.yml | Created | Prometheus + Grafana configuration |
| monitoring/grafana/provisioning/datasources/prometheus.yml | Created | Prometheus + Grafana configuration |
| monitoring/prometheus/prometheus-host.yml | Created | Prometheus + Grafana configuration |
| monitoring/prometheus/prometheus.yml | Created | Prometheus + Grafana configuration |

**Files modified**

| File Path | Change Type | Description |
|---|---|---|
| common/common-web/pom.xml | Modified | Added optional `spring-kafka` + `actuator` (Kafka health) |
| common/common-web/src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports | Modified | Registered `KafkaHealthAutoConfiguration` |
| services/course-service/src/main/resources/application.yml | Modified | `spring.kafka.template.observation-enabled: true` |
| services/enrollment-service/src/main/resources/application.yml | Modified | `spring.kafka.template.observation-enabled: true` |
| services/notification-service/src/main/resources/application.yml | Modified | Kafka template + listener observation |
| common/common-web/src/main/java/com/example/common/CommonAutoConfiguration.java | Modified | Request-log filter ordered inside the observation scope (traceId in the request log) |

**Databases and tables affected:** none

**Maven dependencies added or updated:** micrometer-registry-prometheus, micrometer-tracing-bridge-otel, opentelemetry-exporter-otlp, spring-boot-starter-actuator

**Configuration changes:** `management.tracing.*`, `management.otlp.tracing.endpoint`, Kafka observation, `LOGGING_STRUCTURED_FORMAT_CONSOLE`

**Tests executed and results:** Jaeger: one trace of 48 spans across api-gateway, enrollment-, student-, course-service; Prometheus 6/6 targets up + custom metrics; Grafana health/datasource/dashboard/query; JSON log line with correlationId; health components checked on every service.


## Phase 9 – Containerization

**Implementation date:** 2026-11-10  
**Features completed:** Dockerfile per module, Compose stack (Kafka, Redis, Jaeger, Prometheus, Grafana, apps), `.env`, MySQL-reachability options. Images built; full app stack under Compose NOT run (see known issues).

**Files created (8)**

| File Path | Change Type | Description |
|---|---|---|
| .dockerignore | Created | Docker ignore |
| api-gateway/Dockerfile | Created | Multi-stage Dockerfile |
| docker/README.md | Created | Docker notes (MySQL reachability) |
| eureka-server/Dockerfile | Created | Multi-stage Dockerfile |
| services/course-service/Dockerfile | Created | Multi-stage Dockerfile |
| services/enrollment-service/Dockerfile | Created | Multi-stage Dockerfile |
| services/notification-service/Dockerfile | Created | Multi-stage Dockerfile |
| services/student-service/Dockerfile | Created | Multi-stage Dockerfile |

**Files modified**

| File Path | Change Type | Description |
|---|---|---|
| docker-compose.yml | Modified | Application, monitoring and mysql-proxy services added to the infrastructure-only file created earlier in Phase 4 for local Kafka/Redis/Jaeger |
| .env | Modified | Added `DOCKER_BRIDGE_IP`, `GRAFANA_PASSWORD`, `MYSQL_PORT` note |
| .env.example | Modified | Same |

**Databases and tables affected:** none

**Maven dependencies added or updated:** (Docker images only: maven, eclipse-temurin, apache/kafka, redis, jaeger, prometheus, grafana, alpine/socat)

**Configuration changes:** `docker-compose.yml`, `.env`

**Tests executed and results:** `docker compose config` valid; all 6 images built; kafka/redis/jaeger/prometheus/grafana containers run. Application containers: not run.


## Phase 10 – Testing, Kubernetes and Final Hardening

**Implementation date:** 2026-11-10  
**Features completed:** 82 unit tests, 36 Testcontainers integration tests, E2E script, Kubernetes manifests, README, documentation set, defect fixes found by the tests (V2 migration, DLT naming, sort whitelist).

**Files created (40)**

| File Path | Change Type | Description |
|---|---|---|
| README.md | Created | README |
| api-gateway/src/test/java/com/example/gateway/filter/JwtAuthGlobalFilterTest.java | Created | Gateway unit test |
| common/common-web/src/test/java/com/example/common/security/JwtTokenServiceTest.java | Created | Unit test |
| kubernetes/00-namespace.yaml | Created | Kubernetes manifest |
| kubernetes/01-configmap.yaml | Created | Kubernetes manifest |
| kubernetes/02-mysql-external.yaml | Created | Kubernetes manifest |
| kubernetes/03-secret.yaml | Created | Kubernetes manifest |
| kubernetes/10-redis.yaml | Created | Kubernetes manifest |
| kubernetes/11-kafka.yaml | Created | Kubernetes manifest |
| kubernetes/20-eureka-server.yaml | Created | Kubernetes manifest |
| kubernetes/30-student-service.yaml | Created | Kubernetes manifest |
| kubernetes/31-course-service.yaml | Created | Kubernetes manifest |
| kubernetes/32-enrollment-service.yaml | Created | Kubernetes manifest |
| kubernetes/33-notification-service.yaml | Created | Kubernetes manifest |
| kubernetes/40-api-gateway.yaml | Created | Kubernetes manifest |
| kubernetes/kustomization.yaml | Created | Kubernetes manifest |
| scripts/e2e.py | Created | E2E / DB verification script |
| scripts/verify-db.sh | Created | E2E / DB verification script |
| services/course-service/src/test/java/com/example/course/it/AbstractIT.java | Created | Unit / integration test or test resource |
| services/course-service/src/test/java/com/example/course/it/SeatConcurrencyIT.java | Created | Unit / integration test or test resource |
| services/course-service/src/test/java/com/example/course/service/CourseServiceTest.java | Created | Unit / integration test or test resource |
| services/course-service/src/test/java/com/example/course/service/SeatServiceTest.java | Created | Unit / integration test or test resource |
| services/enrollment-service/src/test/java/com/example/enrollment/command/CommandHandlersTest.java | Created | Unit / integration test or test resource |
| services/enrollment-service/src/test/java/com/example/enrollment/entity/EnrollmentStatusTest.java | Created | Unit / integration test or test resource |
| services/enrollment-service/src/test/java/com/example/enrollment/it/AbstractIT.java | Created | Unit / integration test or test resource |
| services/enrollment-service/src/test/java/com/example/enrollment/it/EnrollmentFlowIT.java | Created | Unit / integration test or test resource |
| services/enrollment-service/src/test/java/com/example/enrollment/it/ResilienceIT.java | Created | Unit / integration test or test resource |
| services/enrollment-service/src/test/java/com/example/enrollment/outbox/OutboxPublisherTest.java | Created | Unit / integration test or test resource |
| services/enrollment-service/src/test/java/com/example/enrollment/saga/EnrollmentSagaOrchestratorTest.java | Created | Unit / integration test or test resource |
| services/notification-service/src/test/java/com/example/notification/it/AbstractIT.java | Created | Unit / integration test or test resource |
| services/notification-service/src/test/java/com/example/notification/it/NotificationKafkaIT.java | Created | Unit / integration test or test resource |
| services/notification-service/src/test/java/com/example/notification/processing/NotificationProcessorTest.java | Created | Unit / integration test or test resource |
| services/notification-service/src/test/java/com/example/notification/service/NotificationIngestServiceTest.java | Created | Unit / integration test or test resource |
| services/student-service/src/main/resources/db/migration/V2__user_deleted_with_student.sql | Created | FK cascade from student to login account (found by integration test) |
| services/student-service/src/test/java/com/example/student/it/AbstractIT.java | Created | Unit / integration test or test resource |
| services/student-service/src/test/java/com/example/student/it/StudentApiIT.java | Created | Unit / integration test or test resource |
| services/student-service/src/test/java/com/example/student/service/AuthServiceTest.java | Created | Unit / integration test or test resource |
| services/student-service/src/test/java/com/example/student/service/StudentServiceTest.java | Created | Unit / integration test or test resource |
| services/student-service/src/test/java/com/example/student/validation/PhoneNumberValidatorTest.java | Created | Unit / integration test or test resource |
| services/student-service/src/test/resources/db/existing-student-schema.sql | Created | Unit / integration test or test resource |

**Files modified**

| File Path | Change Type | Description |
|---|---|---|
| pom.xml | Modified | Added `maven-failsafe-plugin` |
| common/common-web/pom.xml | Modified | Added `spring-boot-starter-test` (test scope) |
| services/notification-service/src/main/java/com/example/notification/config/KafkaConfig.java | Modified | Dead-letter destination resolver `<topic>.DLT` (default `-dlt` mismatch found by `NotificationKafkaIT`) |
| services/notification-service/src/main/resources/application.yml | Modified | Producer `max.block.ms: 5000` |
| services/student-service/src/main/java/com/example/student/controller/StudentController.java | Modified | Sort-field whitelist (400 instead of 500) |

**Databases and tables affected:** StudentDB: V2 migration altered FK `sms_users.student_id` → ON DELETE CASCADE

**Maven dependencies added or updated:** maven-failsafe-plugin (managed), spring-boot-testcontainers

**Configuration changes:** failsafe in root POM; notification producer `max.block.ms`; K8s ConfigMap/Secret

**Tests executed and results:** `mvn clean verify`: BUILD SUCCESS for all 9 reactor projects – 82 unit + 36 integration tests, 0 failures; `e2e.py` 43/43 PASS on the final jars; Kubernetes YAML structure check (22 objects, no problems).


## Known issues and pending items
1. **Docker Compose application stack not run (acceptance #18).** Images build and Kafka/Redis/Jaeger/Prometheus/Grafana containers work, but starting the app containers requires the containers to reach the host MySQL (bound to 127.0.0.1, user `@localhost`). The optional `mysql-proxy` step that would have done this without touching MySQL was refused by the auto-mode safety classifier, and the alternative (change `bind-address`, grants, restart MySQL) needs sudo and interrupts other applications – neither was done. Steps to finish: `docker/README.md`.
2. **Kubernetes manifests not applied** (no cluster/`kubectl`); only structurally validated.
3. **Dev credentials in source**: `abhig` / the dev password set in `application.yml` (and dev JWT/admin secrets) are fallback defaults in `application.yml` and `.env` at the owner's explicit request – contradicts the prompt's "no credentials in source"; remove before publishing.
4. **Legacy data not migrated**: rows in the original `Students`, `Courses`, … tables are preserved but not imported into the new `sms_*` tables.
5. **Trace continuity** is broken across the outbox → Kafka → consumer hop (separate traces linked by `correlationId`).
6. **`enrollment.saga.max-recovery-attempts`** is configured but not enforced; a permanently failing compensation is retried every 15 s without alerting.
7. **Security hardening not done**: HS256 shared secret, unauthenticated `/actuator/*` and Eureka, health details shown to anonymous callers, no rate limiting/lockout, no TLS.
8. **Retention**: no purge of outbox, inbox, finished sagas, idempotency keys, notifications.
9. **Single-node Kafka/Redis**, replication factor 1 (development sizing).
10. **Not covered by automated tests**: Swagger UI in a browser, Grafana panels visually, gateway as a Spring context (covered by live E2E only), live fault injection of "confirm fails after seat reserved" (unit-tested).
11. **Documentation file names** follow the prompt (`Documentation/NN-Name.md`, `README.md`) rather than the user's usual `YYYYMMDDHHmm_` prefix convention.
12. The suggested `tests/` aggregate directory and `common/common-messaging` module were intentionally not created (tests live per module; see [01](01-Project-Setup-and-Maven-Configuration.md)).

## 6. Architecture Details
See [00](00-Project-Overview.md).

## 7. Dependencies
Per phase above; versions in [02](02-Java-and-Spring-Boot-Configuration.md).

## 8. Configuration Changes
Per phase above; reference in [28](28-Configuration-and-Environment-Variables.md).

## 9. Database Changes
Per phase above; schema in [03](03-MySQL-Database-Configuration.md).

## 10. API Changes
See README §7 and the service documents.

## 11. Communication Changes
See [10](10-Service-to-Service-Communication.md) and [11](11-Kafka-Event-Driven-Architecture.md).

## 12. Execution Instructions
See README §6.

## 13. Testing
Final verified totals: **82 unit + 36 integration tests (BUILD SUCCESS)**, **43 E2E assertions** – [26](26-Unit-and-Integration-Testing.md).

## 14. Pending Items
Section "Known issues and pending items" above.
