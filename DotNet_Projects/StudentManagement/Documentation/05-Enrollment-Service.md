# 05 - Enrollment Service

## 1. Feature Overview
Enroll a student in a course, cancel, annotate, history/search - implemented with an **orchestrated saga**, **transactional outbox** and **CQRS**. Port 8083, database **EnrollmentDB**.

## 2. Purpose
The business core that coordinates Student and Course services and publishes enrollment events reliably.

## 3. Files Created
| File Path | Change Type | Description |
|---|---|---|
| Services/EnrollmentService/Program.cs | Created | DbContext, JWT, RabbitMQ publisher, HTTP clients, handlers, background services |
| Services/EnrollmentService/Entities/Entities.cs | Created | `Enrollment` (+state machine), `SagaInstance`, `OutboxMessage`, enums |
| Services/EnrollmentService/Data/EnrollmentDbContext.cs, Configurations/EntityConfigurations.cs, DesignTimeFactory.cs | Created | Mapping incl. generated `ActiveKey` |
| Services/EnrollmentService/Commands/Commands.cs | Created | Create/Cancel/Update command handlers |
| Services/EnrollmentService/Queries/Queries.cs | Created | Query objects + `EnrollmentQueryHandlers` |
| Services/EnrollmentService/Saga/EnrollmentSagaOrchestrator.cs | Created | Saga steps, compensation, `SagaRecoveryJob` |
| Services/EnrollmentService/Outbox/OutboxPublisher.cs | Created | Background outbox publisher |
| Services/EnrollmentService/EventHandlers/EnrollmentEventRecorder.cs | Created | Builds events into the outbox (transaction required) |
| Services/EnrollmentService/Clients/Clients.cs, ClientRegistration.cs | Created | Typed HTTP clients, exceptions, service-JWT handler, resilience |
| Services/EnrollmentService/Controllers/EnrollmentsController.cs | Created | Endpoints |
| Services/EnrollmentService/Dtos/Dtos.cs | Created | DTOs |
| Services/EnrollmentService/appsettings.json | Created | Config, port 8083 |
| Services/EnrollmentService/Data/Migrations/* | Created | `InitialCreate` |

## 4. Files Modified
`Services/EnrollmentService/Program.cs` - HTTP client registration moved into `Clients/ClientRegistration.cs` so integration tests exercise the same resilience pipeline as production.

## 5. Implementation Details
- States: `Pending -> Confirmed | Rejected`, `Confirmed -> Cancelled` (`Enrollment.TransitionTo` rejects anything else).
- Duplicate protection: application pre-check **and** DB unique index on the generated column `ActiveKey` (non-null only for Pending/Confirmed).
- `Idempotency-Key` header (<= 64 chars; UUID generated if absent). HTTP mapping: Confirmed 201, Rejected 422, InProgress 202, duplicate 409.
- A Student-role caller may only enrol/cancel/read their own enrolments (403 otherwise).
- Details: `10-Saga-Pattern.md`, `11-Outbox-Pattern.md`, `13-CQRS-Implementation.md`, `08`, `16`.

## 6. Architecture Details
Synchronous out: Student Service, Course Service. Asynchronous out: RabbitMQ via outbox (`enrollment.requested|confirmed|rejected|cancelled`).

## 7. Dependencies
Pomelo/EF Core, `Microsoft.Extensions.Http.Resilience 8.10.0`, RabbitMQ.Client, Common/Messaging/Observability blocks.

## 8. Configuration Changes
`ConnectionStrings:EnrollmentDb`, `Services:Student|Course`, `Resilience:*`, `Saga:RecoveryIntervalMs|StaleAfterSeconds`, `Outbox:IntervalMs|BatchSize`, `RabbitMq:*`, `Jwt:*`.

## 9. Database Changes
EnrollmentDB: `dn_enrollments` (unique `IdempotencyKey`, unique generated `ActiveKey`, indexes), `dn_saga_instances` (unique key, index (State, UpdatedAt)), `dn_outbox_messages` (unique `EventId`, index (Status, NextAttemptAt, OutboxId)).

## 10. API Changes
`POST /api/enrollments`, `POST /{id}/cancel`, `PUT /{id}` (remarks only), `GET /{id}`, `GET /api/enrollments` (filters studentId, courseId, status, from, to, paging, sort), `GET /student/{studentId}`, `GET /course/{courseId}`.
Example: `POST /api/enrollments {"studentId":1,"courseId":1}` + `Idempotency-Key: demo-1` -> `201 {"result":"Confirmed","message":"Enrollment confirmed","enrollment":{...}}`.

## 11. Communication Changes
REST to Student (`/eligibility`, `/{id}`) and Course (`/{id}`, `/availability`, `/seats/reserve`, `/seats/release`); RabbitMQ publish through the outbox.

## 12. Execution Instructions
`scripts/start-local.sh`; `python3 scripts/e2e.py`; failure paths: `python3 scripts/failure-scenarios.py`.

## 13. Testing
Unit: `Tests/UnitTests/Enrollment/EnrollmentTests.cs` (saga happy path, every rejection, compensation, pause/recovery, resume after crash, idempotent replay, state machine, command and query handlers). Integration: `Tests/IntegrationTests/EnrollmentOutboxIntegrationTests.cs`, `RemoteClientIntegrationTests.cs`.

## 14. Pending Items
Observed behaviour to be aware of: if Student/Course Service is **down during validation**, the saga compensates immediately and the client gets **422 Rejected** (reason "validation failed"); a saga only *pauses* (202 InProgress, resumed by `SagaRecoveryJob`) when the **compensation** (seat release) cannot reach Course Service. This mirrors the Java implementation.
