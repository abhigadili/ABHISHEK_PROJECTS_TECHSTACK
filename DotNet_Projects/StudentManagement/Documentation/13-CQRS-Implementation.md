# 13 - CQRS Implementation (Enrollment Service)

## 1. Feature Overview
Commands (create, cancel, update) and queries (get, search, student history, course enrollments) are separate objects with separate handlers.

## 2. Purpose
Keep write logic (saga, events, remote calls) apart from simple read logic; each can evolve independently. Kept deliberately light: one database, no event sourcing or read projections.

## 3. Files Created
`Services/EnrollmentService/Commands/Commands.cs`, `Services/EnrollmentService/Queries/Queries.cs`, wired in `Controllers/EnrollmentsController.cs` and `Program.cs`.

## 4. Files Modified
None.

## 5. Implementation Details
| Side | Object -> handler | Notes |
|---|---|---|
| Command | `CreateEnrollmentCommand` -> `CreateEnrollmentCommandHandler` | duplicate check, runs the saga, maps to `EnrollmentOutcome` |
| Command | `CancelEnrollmentCommand` -> `CancelEnrollmentCommandHandler` | release seat remotely first, then local transaction + `EnrollmentCancelled` outbox row |
| Command | `UpdateEnrollmentCommand` -> `UpdateEnrollmentCommandHandler` | remarks only |
| Query | `GetEnrollmentQuery`, `SearchEnrollmentsQuery`, `StudentEnrollmentHistoryQuery`, `CourseEnrollmentsQuery` -> `EnrollmentQueryHandlers.HandleAsync(...)` overloads | `AsNoTracking`, paging, whitelisted sort (`EnrollmentId, StudentId, CourseId, Status, EnrollmentDate, CreatedAt`), never call other services |

## 6. Architecture Details
The controller only authorises (self-or-staff), builds a command/query and returns the result.

## 7. Dependencies
None extra (no MediatR - avoids unnecessary abstraction).

## 8. Configuration Changes
None.

## 9. Database Changes
None.

## 10. API Changes
Commands: `POST /api/enrollments`, `POST /{id}/cancel`, `PUT /{id}`. Queries: `GET /{id}`, `GET /`, `/student/{id}`, `/course/{id}`.

## 11. Communication Changes
Only command handlers produce events/remote calls.

## 12. Execution Instructions
`e2e.py` exercises both sides (history, course list with `status=Confirmed`, search by student+status, cancel).

## 13. Testing
Unit: `EnrollmentCommandHandlerTests` (outcome mapping, duplicates, cancel rules, cancel with Course down changes nothing, update remarks only) and `EnrollmentQueryTests` (filters, paging, default sort, 404, sort whitelist).

## 14. Pending Items
No separate read model.
