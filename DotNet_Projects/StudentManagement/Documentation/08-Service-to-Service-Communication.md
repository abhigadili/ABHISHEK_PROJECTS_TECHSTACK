# 08 - Service-to-Service Communication (synchronous)

## 1. Feature Overview
Enrollment Service calls Student and Course Service through typed `HttpClient`s created by `IHttpClientFactory`, with resilience, status handling and a service JWT.

## 2. Purpose
Validate students/courses and reserve/release seats without sharing databases.

## 3. Files Created
| File Path | Change Type | Description |
|---|---|---|
| Services/EnrollmentService/Clients/Clients.cs | Created | `IStudentClient`/`StudentClient`, `ICourseClient`/`CourseClient`, consumer-side DTOs, `RemoteNotFound/Conflict/RejectedException`, `ServiceAuthHandler`, `SagaCorrelation` |
| Services/EnrollmentService/Clients/ClientRegistration.cs | Created | `AddRemoteClients` (HttpClient + handler + resilience) |

## 4. Files Modified
None beyond `Program.cs` (calls `AddRemoteClients`).

## 5. Implementation Details
- Status handling: 404 -> `RemoteNotFoundException`; 409 -> `RemoteConflictException`; other 4xx (not 408/429) -> `RemoteRejectedException`; 5xx/408/429/network -> retried, then `ServiceUnavailableException`.
- `ServiceAuthHandler` adds `Authorization: Bearer <5-min JWT role Service>` and `X-Correlation-Id` (from the request, or the saga's stored id in background work).
- Consumer-side DTO records (`StudentInfo`, `CourseInfo`, `AvailabilityInfo`, `SeatResult`) deserialise only what Enrollment needs; no entity sharing.
- Resilience: `16-Resilience-Patterns.md`.

## 6. Architecture Details
Direct service-to-service HTTP (not via the gateway). No service discovery: URLs come from configuration (`Services:Student|Course`; compose/K8s use DNS names).

## 7. Dependencies
`Microsoft.Extensions.Http.Resilience 8.10.0` (Polly 8).

## 8. Configuration Changes
`Services:Student`, `Services:Course`, `Resilience:*`.

## 9. Database Changes
None.

## 10. API Changes
Consumes: `GET /api/students/{id}/eligibility`, `GET /api/students/{id}`, `GET /api/courses/{id}`, `GET /api/courses/{id}/availability`, `POST /api/courses/{id}/seats/reserve`, `POST /api/courses/{id}/seats/release`.

## 11. Communication Changes
Synchronous REST only.

## 12. Execution Instructions
Stop Course Service and enrol: `422 ... Course validation failed: ... unreachable` (see `scripts/failure-scenarios.py`).

## 13. Testing
Integration `Tests/IntegrationTests/RemoteClientIntegrationTests.cs` runs the real clients against a stub Kestrel server: JWT header + role, status mapping with exactly one attempt for 404, retry of transient 500s, open circuit breaker failing fast, unreachable host.

## 14. Pending Items
None known.
