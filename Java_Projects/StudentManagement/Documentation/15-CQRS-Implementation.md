# 15 – CQRS Implementation

## 1. Feature Overview
Enrollment Service separates writes (commands + handlers) from reads (queries + read-only handlers) – no mediator framework, plain Spring beans.

## 2. Purpose
Clear responsibilities: commands change state and orchestrate (saga/outbox); queries are side-effect-free and never call other services.

## 3. Files Created
| File Path | Change Type | Description |
|---|---|---|
| services/enrollment-service/src/main/java/com/example/enrollment/command/CreateEnrollmentCommand.java, CreateEnrollmentCommandHandler.java | Created | Create (duplicate pre-check, runs the saga, maps to `EnrollmentOutcome`) |
| …/command/CancelEnrollmentCommand.java, CancelEnrollmentCommandHandler.java | Created | Cancel (release seat → CANCELLED + event) |
| …/command/UpdateEnrollmentCommand.java, UpdateEnrollmentCommandHandler.java | Created | Update remarks |
| …/command/EnrollmentOutcome.java | Created | Create result (`CONFIRMED`/`REJECTED`/`IN_PROGRESS`) |
| …/query/EnrollmentQueries.java | Created | `GetEnrollmentQuery`, `SearchEnrollmentsQuery`, `StudentEnrollmentHistoryQuery`, `CourseEnrollmentsQuery` |
| …/query/EnrollmentQueryHandlers.java | Created | `@Transactional(readOnly = true)` handlers |
| …/query/EnrollmentSpecifications.java | Created | Filters (student, course, status, date range) |
| …/controller/EnrollmentController.java | Created | Maps HTTP to commands/queries |

## 4. Files Modified
None.

## 5. Implementation Details
Commands: create, update (remarks only), cancel. Queries: get, search (paged/sorted/filtered), student history, course enrollments. `status` is never settable by the update command – transitions belong to the saga and cancel and are enforced by `EnrollmentStatus.allowedNext()`. Both sides use the same database (a single-DB CQRS, no separate read model – deliberately, to avoid unnecessary complexity).

## 6. Architecture Details
`Controller → CommandHandler → (Saga | repository + EnrollmentEventRecorder)` and `Controller → QueryHandlers → repository`.

## 7. Dependencies
Spring Data JPA specifications.

## 8. Configuration Changes
None.

## 9. Database Changes
None (reads `sms_enrollments`).

## 10. API Changes
See [06](06-Enrollment-Service.md): `GET` endpoints = queries; `POST/PUT/cancel` = commands.

## 11. Communication Changes
Only commands publish events (via outbox) and call other services.

## 12. Execution Instructions
`GET /api/enrollments/student/1?page=0&size=10&sort=enrollmentId,desc` (allowed sort fields: `enrollmentId, studentId, courseId, status, enrollmentDate, createdAt`).

## 13. Testing
`CommandHandlersTest` (8), `EnrollmentFlowIT.queriesProvideHistoryCourseViewSearchAndPaging`, E2E history/search/course-view assertions.

## 14. Pending Items
No materialised read model/projection (not needed at this scale).
