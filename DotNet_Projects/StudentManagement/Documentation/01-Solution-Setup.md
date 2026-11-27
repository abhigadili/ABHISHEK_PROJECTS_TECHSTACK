# 01 - Solution Setup

## 1. Feature Overview
Solution `StudentManagement.sln` with 11 projects, central build settings and the folder structure requested in the specification.

## 2. Purpose
One buildable unit (`dotnet build StudentManagement.sln`), shared language/nullable settings and shared libraries instead of copy-pasted code, while keeping services decoupled (they share *infrastructure* code only, never business logic or entities).

## 3. Files Created
| File Path | Change Type | Description |
|---|---|---|
| StudentManagement.sln | Created | Solution with all projects |
| Directory.Build.props | Created | `net8.0`, `Nullable`, `ImplicitUsings`, C# 12 for every project |
| .gitignore, .dockerignore | Created | bin/obj/logs/.env excluded |
| ApiGateway/ApiGateway.csproj | Created | Web SDK, Yarp.ReverseProxy |
| Services/{Student,Course,Enrollment,Notification}Service/*.csproj | Created | Web SDK projects (EF Core, Pomelo, health checks; Enrollment adds Http.Resilience) |
| BuildingBlocks/Common/Common.csproj | Created | JWT bearer, Redis cache, Swashbuckle (framework reference) |
| BuildingBlocks/EventContracts/EventContracts.csproj | Created | Plain class library (no dependencies) |
| BuildingBlocks/Messaging/Messaging.csproj | Created | RabbitMQ.Client 6.8.1 |
| BuildingBlocks/Observability/Observability.csproj | Created | Serilog + OpenTelemetry |
| Tests/UnitTests/UnitTests.csproj, Tests/IntegrationTests/IntegrationTests.csproj | Created | xUnit projects |

## 4. Files Modified
None.

## 5. Implementation Details
- Target framework **.NET 8 (current LTS supported by the installed SDK 8.0.422)**.
- Project references: every service -> Common + Observability; Course/Enrollment/Notification -> Messaging (-> EventContracts); gateway -> Common + Observability.
- The `dotnet new` template sample files (WeatherForecast etc.) were removed.

## 6. Architecture Details
BuildingBlocks contain **no business rules**. Each service has its own Entities/Dtos/Data/Repositories/Services/Controllers (+ Commands/Queries/Saga/Outbox for Enrollment), as required by the structure in the specification. A `Middleware` and `Configurations` folder exists per service for service-specific middleware/config (the shared middleware lives in `BuildingBlocks/Common/Web`; the folders are placeholders kept for the required structure - **no service-specific middleware was needed**).

## 7. Dependencies
.NET SDK 8.0.422, `dotnet-ef` 8.0.10 (global tool).

## 8. Configuration Changes
`Directory.Build.props` only.

## 9. Database Changes
None.

## 10. API Changes
None.

## 11. Communication Changes
None.

## 12. Execution Instructions
`dotnet build StudentManagement.sln` (0 errors; 2 NU1902 warnings about a moderate advisory in `OpenTelemetry.Exporter.OpenTelemetryProtocol 1.9.0`).

## 13. Testing
Build verified after every phase.

## 14. Pending Items
- Upgrade OpenTelemetry packages past 1.9.0 to clear the NU1902 advisory (not done; no functional impact locally).
