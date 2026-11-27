# 07 - API Gateway (YARP)

## 1. Feature Overview
Single entry point `http://localhost:8080`: reverse proxy (YARP 2.2.0), central JWT authentication, correlation ids, CORS, graceful 503, aggregated Swagger UI, health and metrics. Port 8080.

## 2. Purpose
Clients never call services directly; cross-cutting edge concerns live in one place.

## 3. Files Created
| File Path | Change Type | Description |
|---|---|---|
| ApiGateway/ApiGateway.csproj | Created | Yarp.ReverseProxy + building blocks |
| ApiGateway/Program.cs | Created | Auth, policies, proxy pipeline, 503 handler, Swagger UI, `/gateway/routes` |
| ApiGateway/appsettings.json | Created | Routes, clusters, JWT, CORS |

## 4. Files Modified
`BuildingBlocks/Common/Web/CorrelationIdMiddleware.cs` - also writes the generated id into the **request** headers so the proxy forwards it downstream.

## 5. Implementation Details
| Route | Path | Policy | Cluster |
|---|---|---|---|
| auth-public | `POST /api/auth/{login|register|refresh|logout}` | public | student |
| auth-protected | `/api/auth/{**}` | authenticated | student |
| students, courses, enrollments, notifications (+ `-root` variants) | `/api/<area>/{**}` and `/api/<area>` | authenticated | per service |
| docs-* | `/docs/<name>/swagger.json` -> `/swagger/v1/swagger.json` | public | per service |
Cluster: round-robin load balancing, passive health checks (transport-failure rate), 30 s activity timeout. Role checks stay in each service (defence in depth). If a downstream service is unreachable, the proxy pipeline replaces the empty 502/504 by `503 {"message":"<cluster> is currently unavailable. Please retry shortly."}` (verified by stopping Course Service).

## 6. Architecture Details
Validates the JWT (same secret/issuer/audience as the services) and forwards the original `Authorization` header. Not a business component.

## 7. Dependencies
`Yarp.ReverseProxy 2.2.0`, `Microsoft.AspNetCore.Authentication.JwtBearer`, Swashbuckle (UI only).

## 8. Configuration Changes
`ReverseProxy:Routes|Clusters` (override a destination with `ReverseProxy__Clusters__student__Destinations__d1__Address`), `Jwt:*`, `Cors:AllowedOrigins`, `Urls`.

## 9. Database Changes
None.

## 10. API Changes
Gateway-only: `GET /gateway/routes` (route table), `GET /swagger` (UI listing all four services), `/health*`, `/metrics`.

## 11. Communication Changes
HTTP proxying to the four services.

## 12. Execution Instructions
`scripts/start-local.sh` (gateway starts last). `curl localhost:8080/gateway/routes`.

## 13. Testing
Verified live: 401 without token, 401 on garbage token, public docs 200, routes for all four areas, `X-Correlation-Id` echoed, 503 when a service is down, full `scripts/e2e.py` through the gateway.

## 14. Pending Items
No rate limiting. No gateway-level response caching.
