# 27 – API Documentation (Springdoc OpenAPI)

## 1. Feature Overview
Swagger UI and OpenAPI 3 JSON for every service, aggregated at the gateway, with the JWT bearer scheme.

## 2. Purpose
Self-describing, try-it-out APIs.

## 3. Files Created
| File Path | Change Type | Description |
|---|---|---|
| common/common-web/src/main/java/com/example/common/CommonAutoConfiguration.java | Created | `OpenAPI` bean (title, description, `bearerAuth` HTTP/JWT scheme + global security requirement) shared by all services |
| Controllers (`StudentController`, `AuthController`, `CourseController`, `CategoryController`, `EnrollmentController`, `NotificationController`) | Created | `@Tag`, `@Operation` summaries/descriptions, `@ApiResponses` (status codes), request examples |
| api-gateway/src/main/resources/application.yml | Created | `springdoc.swagger-ui.urls` + `/docs/*/v3/api-docs` routes |

## 4. Files Modified
`CommonAutoConfiguration.java` was modified after creation (OpenAPI bean added, later the filter order); service `application.yml` files got `server.forward-headers-strategy: framework` so Swagger shows the gateway host.

## 5. Implementation Details
* URLs: each service `http://localhost:808x/swagger-ui.html` (`/v3/api-docs`); gateway `http://localhost:8080/swagger-ui.html` with a dropdown of all four services.
* **JWT in Swagger**: click *Authorize*, paste the `accessToken` from `/api/auth/login`.
* Examples: create-student, create-course, enroll bodies are annotated; HTTP codes (200/201/202/400/401/403/404/409/422/503) are documented per operation where they differ from the defaults.
* **Gateway routes** are documented in [08](08-API-Gateway-Spring-Cloud-Gateway.md); **integration events** in [11](11-Kafka-Event-Driven-Architecture.md) (event schemas are Java records in `event-contracts`, not REST schemas, so they are documented in Markdown rather than OpenAPI).

## 6. Architecture Details
The gateway serves Swagger UI (WebFlux flavour) and proxies each service's `/v3/api-docs` through `RewritePath` routes.

## 7. Dependencies
`springdoc-openapi-starter-webmvc-ui` 2.8.6 (services), `…-webflux-ui` (gateway).

## 8. Configuration Changes
`springdoc.swagger-ui.urls[*]` (gateway).

## 9. Database Changes
None.

## 10. API Changes
Documentation endpoints only.

## 11. Communication Changes
None.

## 12. Execution Instructions
Open `http://localhost:8080/swagger-ui.html`, choose a service, *Authorize*, *Try it out*.

## 13. Testing
The OpenAPI JSON endpoints are public and are routed by the gateway; the gateway filter test covers their public-path rules. The Swagger UI pages were **not** exercised in a browser (no automated UI test).

## 14. Pending Items
Request/response *examples* exist for the main create/enroll calls only; error schema (`ApiError`) is referenced on a few operations rather than all.
