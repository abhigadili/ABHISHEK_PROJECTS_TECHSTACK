# 10 - Saga Pattern (orchestration, Enrollment Service)

## 1. Feature Overview
`EnrollmentSagaOrchestrator` coordinates the multi-service enrollment with **persisted state** and **compensation**.

## 2. Purpose
Enrollment spans three databases; one DB transaction cannot cover it. Local steps + compensating actions keep the data consistent.

## 3. Files Created
`Services/EnrollmentService/Saga/EnrollmentSagaOrchestrator.cs` (orchestrator, `SagaPausedException`, `SagaRecoveryJob`), entity `SagaInstance` in `Entities/Entities.cs`, table `dn_saga_instances`.

## 4. Files Modified
None.

## 5. Implementation Details
| State after step | Step | Failure -> |
|---|---|---|
| Started | `StartAsync` inserts the saga row (unique idempotency key; replay returns the stored saga) | - |
| StudentValidated | Student Service `eligibility` (must be Active) + `get` (name/e-mail snapshot) | Compensating ("does not exist", "not eligible", "validation failed") |
| CourseValidated | Course `get` (Active) + `availability` (available) | Compensating |
| PendingCreated | **one DB transaction**: `Pending` enrollment + `EnrollmentRequested` outbox row + saga update | duplicate active enrollment -> Compensating |
| SeatReserved | Course `seats/reserve` (idempotent per enrollment id) | 409 -> "no seats"; other -> Compensating |
| Completed | **one DB transaction**: `Confirmed` + `EnrollmentConfirmed` outbox row | exception -> Compensating (seat released) |
| Compensating -> Rejected | release seat (idempotent) then **one transaction**: enrollment `Rejected` + `EnrollmentRejected` outbox row | Course unavailable -> `SagaPausedException` |

Remote calls happen **outside** DB transactions. The state is saved after every step (optimistic `Version`). `RunAsync` loops until a terminal state or pause (guard 12 steps). `SagaRecoveryJob` (every 15 s) resumes non-terminal sagas not updated for 30 s (`Saga:RecoveryIntervalMs`, `Saga:StaleAfterSeconds`); a `DbUpdateConcurrencyException` means another worker has it.

## 6. Architecture Details
Called by `CreateEnrollmentCommandHandler`. Results map to HTTP: 201 / 422 / 202 (`05`).

## 7. Dependencies
EF Core, the typed clients (`08`), the outbox recorder (`11`).

## 8. Configuration Changes
`Saga:RecoveryIntervalMs` (15000), `Saga:StaleAfterSeconds` (30).

## 9. Database Changes
`dn_saga_instances` (columns: SagaId, IdempotencyKey unique, StudentId, CourseId, EnrollmentId, State, SeatReserved, FailureReason, StudentName/Email, CourseName, CorrelationId, Attempts, Version, timestamps; index (State, UpdatedAt)).

## 10. API Changes
`POST /api/enrollments` (see `05`).

## 11. Communication Changes
REST to Student/Course; events through the outbox.

## 12. Execution Instructions
`python3 scripts/e2e.py` covers the success, three rejection kinds, seat exhaustion and cancel flows; `scripts/failure-scenarios.py` covers a dependency outage.

## 13. Testing
Unit (`EnrollmentSagaTests`, 10 tests): happy path + events; unknown/ineligible student; inactive/full course; student outage; seat conflict -> release + Rejected; failure **after** seat reservation releases the seat; compensation pause then recovery; idempotent replay; **resume from persisted state without repeating earlier steps**.

## 14. Pending Items
Pause only happens at compensation (see `05` section 14). `max attempts` for recovery is unbounded.
