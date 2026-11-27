# 25 - API Documentation (Swagger / OpenAPI)

## 1. Feature Overview
Swagger/OpenAPI for all four services with the JWT "Authorize" button, XML-comment descriptions and request examples; the gateway aggregates them in one UI and documents its routes.

## 2. Purpose
Self-documenting, try-it-out API for developers.

## 3. Files Created
| File Path | Change Type | Description |
|---|---|---|
| BuildingBlocks/Common/ServiceCollectionExtensions.cs (`AddSmsWebDefaults`, `UseSmsWebDefaults`) | Created | SwaggerGen with Bearer security scheme + XML comments; Swagger + SwaggerUI middleware |
| Services/*/Controllers/*.cs | Created | `/// <summary>`, `/// <remarks>` examples, `[Tags]`, `[ProducesResponseType]` |
| ApiGateway/Program.cs | Created | Swagger UI at `/swagger` listing the four service documents; `GET /gateway/routes` |
| ApiGateway/appsettings.json | Created | `docs-*` routes exposing each service's `/swagger/v1/swagger.json` as `/docs/<name>/swagger.json` |

## 4. Files Modified
Service `.csproj` files: `GenerateDocumentationFile=true` (CS1591 suppressed).

## 5. Implementation Details
- Every service serves `/swagger` (UI) and `/swagger/v1/swagger.json`; **Authorize** takes the access token from `POST /api/auth/login`.
- Gateway UI: `http://localhost:8080/swagger` (dropdown Student/Course/Enrollment/Notification). The docs routes are public; "Try it out" calls the real endpoints through the gateway (so the JWT is required).
- **Integration events** are documented here (and in `09`): `EnrollmentEvent {eventId, eventType, enrollmentId, studentId, courseId, studentName, studentEmail, courseName, reason, correlationId, occurredAt}` on `enrollment.requested|confirmed|rejected|cancelled`; `LowCourseAvailabilityEvent {eventId, courseId, courseCode, courseName, availableSeats, totalSeats, occurredAt}` on `course.low-availability`.
- **Gateway routes:** table in `07`, live list at `GET /gateway/routes`.
- Error body for all non-2xx: `{"timestamp","status","error","message","path","fieldErrors?","correlationId?"}`.

## 6. Architecture Details
Documentation is generated from code at runtime; no separate spec files to maintain.

## 7. Dependencies
`Swashbuckle.AspNetCore 6.8.1`.

## 8. Configuration Changes
None.

## 9. Database Changes
None.

## 10. API Changes
`GET /swagger`, `/swagger/v1/swagger.json` on each service; gateway: `/swagger`, `/docs/*/swagger.json`, `/gateway/routes`.

## 11. Communication Changes
None.

## 12. Execution Instructions
Open `http://localhost:8080/swagger`; verified: `/swagger/index.html` -> 200, `/docs/student/swagger.json` -> 200 without a token.

## 13. Testing
Integration test checks `/swagger/v1/swagger.json` -> 200 on Student Service; gateway endpoints verified live.

## 14. Pending Items
Response examples exist as `<remarks>` text on key endpoints, not as full OpenAPI example objects for every operation.
