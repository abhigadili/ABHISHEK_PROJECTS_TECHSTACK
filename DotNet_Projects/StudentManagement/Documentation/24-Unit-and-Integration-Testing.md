# 24 - Unit and Integration Testing

## 1. Feature Overview
xUnit + Moq unit tests and Testcontainers-based integration tests (real MySQL 8, RabbitMQ, Redis), plus two scripted end-to-end suites against the running stack.

## 2. Purpose
Prove business rules, concurrency, messaging reliability and security without touching the existing databases.

## 3. Files Created
| File Path | Change Type | Description |
|---|---|---|
| Tests/UnitTests/UnitTests.csproj | Created | xUnit, Moq, EF InMemory |
| Tests/UnitTests/Common/CommonTests.cs | Created | JWT, paging/sort whitelist, exception -> HTTP mapping |
| Tests/UnitTests/Student/StudentTests.cs | Created | Student logic, cache, phone validation, token hash |
| Tests/UnitTests/Course/CourseTests.cs | Created | Course logic, seat reserve/release rules, low-availability event |
| Tests/UnitTests/Enrollment/EnrollmentTests.cs | Created | Saga, compensation, idempotency, state machine, CQRS handlers |
| Tests/UnitTests/Notification/NotificationTests.cs | Created | Inbox idempotency, message text, processor retry/back-off |
| Tests/IntegrationTests/IntegrationTests.csproj, InfraFixture.cs | Created | Container fixture (own databases per test class) |
| Tests/IntegrationTests/CourseSeatIntegrationTests.cs | Created | Real-MySQL concurrency and constraints |
| Tests/IntegrationTests/EnrollmentOutboxIntegrationTests.cs | Created | DB rules + outbox with real RabbitMQ |
| Tests/IntegrationTests/NotificationMessagingIntegrationTests.cs | Created | Consumers, duplicates, DLQ |
| Tests/IntegrationTests/RedisCacheIntegrationTests.cs | Created | Redis cache behaviour |
| Tests/IntegrationTests/RemoteClientIntegrationTests.cs | Created | REST clients + resilience vs stub server |
| Tests/IntegrationTests/StudentApiIntegrationTests.cs | Created | Real Student Service pipeline: JWT, roles, cache, health |
| scripts/e2e.py, scripts/failure-scenarios.py | Created | Live end-to-end suites |

## 4. Files Modified
`BuildingBlocks/Common/Caching/CacheService.cs` - cache JSON now writes enums as strings (found by an integration test comparing the cached payload).

## 5. Implementation Details
- Unit tests use Moq for repositories/clients/cache/publisher and EF InMemory (transaction warning ignored) for DbContext-based logic (saga, notification).
- Integration tests never touch `StudentDB/CourseDB/EnrollmentDB/NotificationDB`: each test class creates `CREATE DATABASE <random>` inside a **throw-away MySQL container**.
- Lesson recorded: the first version of the Student API tests set configuration through `WebApplicationFactory.ConfigureAppConfiguration`, which applies *after* `Program.cs` has read the connection string. The tests therefore briefly ran against the real StudentDB and created one extra test user (`locky`) plus its student profile (removed by exact id/e-mail afterwards; nothing pre-existing was modified). The fix: overrides are now passed as environment variables, and the test asserts the service is using the container database before running.
- Execution:
```bash
dotnet test Tests/UnitTests                         # no Docker needed
dotnet test Tests/IntegrationTests                  # needs Docker (pulls mysql:8.0, rabbitmq:3.13-management-alpine, redis:7-alpine)
docker compose up -d rabbitmq redis jaeger && scripts/start-local.sh && python3 scripts/e2e.py && python3 scripts/failure-scenarios.py
```

## 6. Architecture Details
Test pyramid: many fast unit tests, fewer container-backed integration tests, two live suites for cross-service behaviour.

## 7. Dependencies
xunit 2.9.2, Moq 4.20.72, Microsoft.EntityFrameworkCore.InMemory 8.0.10, Microsoft.AspNetCore.Mvc.Testing 8.0.10, Testcontainers.MySql/RabbitMq/Redis 3.10.0.

## 8. Configuration Changes
None.

## 9. Database Changes
None on real databases.

## 10. API Changes
None.

## 11. Communication Changes
None.

## 12. Execution Instructions
See section 5.

## 13. Testing
Results are recorded in `27-Implementation-Change-Log.md` (final run) - unit 84 passed, integration 37 passed, e2e 49 checks passed, failure scenarios all scenarios passed.

## 14. Pending Items
Not covered by automated tests: gateway (verified live only), Docker Compose application stack, Kubernetes. Notification service HTTP API is covered by e2e only.
