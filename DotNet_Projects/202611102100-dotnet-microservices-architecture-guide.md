# Student Management System (.NET) — Architecture and Execution Flow Guide

**A beginner-friendly, source-verified walkthrough of the ASP.NET Core 8 microservices project**

| | |
|---|---|
| Project root | `~/Documents/DotNet_Projects/StudentManagement` (all paths are relative to it unless stated) |
| Generated | 10 November 2026 |
| Scope | Documentation only. No source file, configuration, migration, script, container or database was modified, and nothing was started, stopped or rebuilt to produce this guide. |
| Test files | `Tests/**` are excluded from the file-by-file explanations (mentioned only where they prove a behaviour). |
| Secrets | No password, JWT secret, token or connection-string credential is printed; where one exists the guide says "a development default exists". `.env` was not opened. |


## Table of Contents

- **1. How to Read This Guide**
    - 1.1 Who this is for
    - 1.2 Conventions
    - 1.3 The ten-second summary
    - 1.4 Recommended way to read
- **2. Project Structure and Build**
    - 2.1 Folder-by-folder purpose
    - 2.2 Solution, project types and references
    - 2.3 NuGet packages by purpose
- **3. Startup Flow From Zero**
    - 3.1 Step by step (Student Service)
    - 3.2 Dependency injection in beginner terms
    - 3.3 The middleware pipeline (service programs)
    - 3.4 Database, migrations and `EnableRetryOnFailure`
    - 3.5 Background (hosted) services that start with the host
    - 3.6 Kestrel, ports and "ready"
    - 3.7 What is special at startup, per program
- **4. Configuration in Depth**
    - 4.1 How configuration works
    - 4.2 Keys common to the services
    - 4.3 Service-specific keys
    - 4.4 All environment variables in one table
    - 4.5 Which configuration is used where
- **5. The Scripts, Line by Line**
    - 5.1 `scripts/start-local.sh` — start the five programs on the host
    - 5.2 `scripts/stop-local.sh` — stop by port
    - 5.3 `scripts/e2e.py` — end-to-end checks through the gateway
    - 5.4 `scripts/failure-scenarios.py` (briefly)
    - 5.5 What runs, in which order, when you type the three commands
- **6. Every Endpoint and the Flow Behind It**
    - 6.1 Endpoint catalogue (36 business endpoints + infrastructure)
    - 6.2 The common prefix and suffix of every flow
    - 6.3 Student Service endpoints
    - 6.4 Course Service endpoints
    - 6.5 Enrollment Service endpoints
    - 6.6 Notification Service endpoints
    - 6.7 Gateway-only behaviour
- **7. File-by-File Explanation (non-test files)**
    - 7.1 Solution and root files
    - 7.2 BuildingBlocks/Common (shared infrastructure)
    - 7.3 BuildingBlocks/EventContracts, Messaging, Observability
    - 7.4 ApiGateway
    - 7.5 Services/StudentService
    - 7.6 Services/CourseService
    - 7.7 Services/EnrollmentService
    - 7.8 Services/NotificationService
    - 7.9 Generated EF Core migration files (group explanation)
    - 7.10 Docker, Kubernetes, Monitoring, scripts
- **8. Layers, Patterns and Architecture**
    - 8.1 The layers
    - 8.2 EF Core features actually used
    - 8.3 Identity + JWT + roles
    - 8.4 YARP gateway
    - 8.5 RabbitMQ
    - 8.6 Saga, outbox, inbox, idempotency
    - 8.7 Resilience for HTTP calls (Enrollment → Student/Course)
    - 8.8 CQRS, cache, background jobs, observability
- **9. Code Tracing Examples**
    - 9.1 Create a student through the gateway
    - 9.2 Log in and call a protected endpoint
    - 9.3 Enrol a student (saga, remote calls, outbox)
    - 9.4 From outbox row to RabbitMQ message to notification "sent" (asynchronous path)
    - 9.5 Failed requests with exact error bodies
- **10. Cross-Cutting Behaviour**
    - 10.1 Exception → HTTP mapping
    - 10.2 Logging and following one request
    - 10.3 When a dependency is down
- **11. Learning Path, Glossary and Index**
    - 11.1 Recommended reading order
    - 11.2 Glossary
    - 11.3 How to follow a request in the logs (summary)
    - 11.4 Index of all non-test source files
- **12. Verification and Honesty**
    - 12.1 How this guide was verified
    - 12.2 What could not be verified
    - 12.3 Gaps and oddities a beginner might not expect

---

# 1. How to Read This Guide

## 1.1 Who this is for
You are new to C#, ASP.NET Core and microservices. Every technical term is explained the first time it appears: **what** it is, **why** it exists, **where** it lives in this project and **how** it behaves at run time.

## 1.2 Conventions
| Convention | Meaning |
|---|---|
| `path/File.cs` | A real file, checked against the file system by a script (section 12). |
| `Class.Method` | A method (or member) of a class, e.g. `SeatService.ReserveAsync`. |
| "Base path" line above a table | Directory prefix shared by the files in that table. |
| Numbered lists | Execution flows: follow them top to bottom. |
| **Not implemented** | Used whenever a feature is absent. Nothing is invented. |
| **Could not be verified** | The source cannot prove it (section 12 lists these). |

No diagrams or flowcharts are used, only numbered text flows. (The project `README.md` contains Mermaid diagrams; they are not reproduced here.)

## 1.3 The ten-second summary
A **student course-enrolment system** split into small independent ASP.NET Core programs ("microservices"). A client talks only to the **API Gateway** (port 8080, built with YARP). The gateway checks the login token and forwards the call to one of four business services:

| Program | Port | Own database | Job |
|---|---|---|---|
| API Gateway (`ApiGateway/`) | 8080 | — | single front door: routing, JWT check, correlation id, CORS, 503 fallback, Swagger UI |
| Student Service | 8081 | `StudentDB` | students, **user accounts and login (JWT)**, refresh tokens |
| Course Service | 8082 | `CourseDB` | courses, categories, **seat counts**, seat reserve/release |
| Enrollment Service | 8083 | `EnrollmentDB` | enrolling/cancelling (a multi-step **saga**), history, **outbox** |
| Notification Service | 8084 | `NotificationDB` | consumes RabbitMQ events, notification history, simulated e-mail |

Infrastructure (Docker containers, started separately): **RabbitMQ** (message broker, ports 5672/15672), **Redis** (cache, 6379), **Jaeger** (trace UI, 16686/4317), **Prometheus** (9090) and **Grafana** (3001). **MySQL** is *not* in Docker: it is the server already running on the host, and each service uses one existing database in it.

## 1.4 Recommended way to read
Read sections 2 → 4 once for vocabulary, section 5 for the scripts (the "how do I run it" layer), then section 6 (endpoints) and section 9 (traces) with the real source open beside you. Section 11 gives a precise file reading order.

---

# 2. Project Structure and Build

## 2.1 Folder-by-folder purpose
| Folder / file | Purpose |
|---|---|
| `StudentManagement.sln` | Solution: lists the 11 projects so `dotnet build StudentManagement.sln` builds all of them. |
| `Directory.Build.props` | Settings applied to **every** project automatically (`net8.0`, `Nullable`, `ImplicitUsings`, C# 12). |
| `ApiGateway/` | YARP reverse-proxy program (`Program.cs`, `appsettings.json`). |
| `Services/StudentService/`, `CourseService/`, `EnrollmentService/`, `NotificationService/` | The four business programs. |
| `BuildingBlocks/Common/` | Shared infrastructure library: JWT, error handling, paging, Redis cache, correlation id, health helpers. |
| `BuildingBlocks/EventContracts/` | The RabbitMQ message shapes (plain records) and topology names. |
| `BuildingBlocks/Messaging/` | RabbitMQ connection, topology, publisher, consumer base class. |
| `BuildingBlocks/Observability/` | Serilog + OpenTelemetry setup. |
| `Tests/` | xUnit unit and integration tests (excluded from this guide). |
| `Docker/` | One parameterised `Dockerfile` and `healthcheck.sh`. |
| `docker-compose.yml`, `.env.example` | Infrastructure containers (+ the five app containers under profile `apps`); variable template. |
| `Kubernetes/` | 12 manifests (never applied). |
| `Monitoring/` | Prometheus scrape configs and Grafana provisioning + dashboard JSON. |
| `scripts/` | `start-local.sh`, `stop-local.sh`, `e2e.py`, `failure-scenarios.py`. |
| `Documentation/` | 28 topic documents (00–27). |
| `logs/` | Runtime logs written by `start-local.sh` (created at run time). |

Inside each service the same layered folders repeat: `Controllers/` (HTTP), `Services/` (business rules), `Repositories/` (database queries), `Entities/` (table classes), `Dtos/` (request/response shapes), `Data/` (DbContext, `Configurations/`, `Migrations/`). Enrollment adds `Commands/ Queries/ Saga/ Outbox/ EventHandlers/ Clients/`; Notification adds `Consumers/ Processing/`. Some service folders (`Middleware/`, `Configurations/`, and a few others) are **empty placeholders** kept for the required structure: the shared middleware lives in `BuildingBlocks/Common/Web`.

## 2.2 Solution, project types and references
- A **`.csproj`** file describes one project: its type (SDK), package references and project references.
- **Runnable programs** use `Microsoft.NET.Sdk.Web` (they have a `Program.cs` with the entry point): the gateway and the four services.
- **Libraries** use `Microsoft.NET.Sdk` and have no `Main`: the four BuildingBlocks. They are linked with `<ProjectReference>`.
| Project | References |
|---|---|
| Every service | `Common`, `Observability` |
| Course, Enrollment, Notification | also `Messaging` (which references `EventContracts`) |
| ApiGateway | `Common`, `Observability` |
| `Common`, `Observability`, `Messaging` | `Common` uses `FrameworkReference Microsoft.AspNetCore.App`; `Messaging` references `EventContracts` |
**Why BuildingBlocks contain no business rules:** they hold *infrastructure* every service needs (authentication, error format, messaging plumbing). If business logic or entities were shared, services would become tightly coupled and could no longer be changed or deployed independently — the opposite of the goal.

## 2.3 NuGet packages by purpose
A **NuGet package** is a library downloaded by the build.
| Purpose | Package (version) | Where | Why |
|---|---|---|---|
| Web | `Microsoft.AspNetCore.App` (framework reference) | all programs | Kestrel server, MVC controllers, middleware |
| Database | `Microsoft.EntityFrameworkCore` 8.0.10, `Pomelo.EntityFrameworkCore.MySql` 8.0.2 | Common, services | EF Core ORM and the MySQL provider |
| Database tooling | `Microsoft.EntityFrameworkCore.Design` 8.0.10 | services | `dotnet ef migrations ...` |
| Identity | `Microsoft.AspNetCore.Identity.EntityFrameworkCore` 8.0.10 | Student | users, roles, password hashing |
| JWT | `Microsoft.AspNetCore.Authentication.JwtBearer` 8.0.10 | Common | validates bearer tokens |
| Gateway | `Yarp.ReverseProxy` 2.2.0 | ApiGateway | reverse proxy |
| Messaging | `RabbitMQ.Client` 6.8.1 | Messaging | AMQP client |
| Cache | `Microsoft.Extensions.Caching.StackExchangeRedis` 8.0.10 | Common | Redis-backed `IDistributedCache` |
| Resilience | `Microsoft.Extensions.Http.Resilience` 8.10.0 | Enrollment | retry, circuit breaker, timeouts for HttpClient |
| Health | `Microsoft.Extensions.Diagnostics.HealthChecks` 8.0.10, `...HealthChecks.EntityFrameworkCore` 8.0.10 | Common, services | `/health` endpoints, MySQL check |
| Logging | `Serilog.AspNetCore` 8.0.3 | Common, Observability | structured logs |
| Tracing/metrics | `OpenTelemetry.Extensions.Hosting`, `.Instrumentation.AspNetCore/Http/Runtime` 1.9.0, `.Exporter.OpenTelemetryProtocol` 1.9.0, `.Exporter.Prometheus.AspNetCore` 1.9.0-beta.2 | Observability | traces to Jaeger, `/metrics` for Prometheus |
| API docs | `Swashbuckle.AspNetCore` 6.8.1 | Common | Swagger/OpenAPI |
| Testing | xunit, Moq, EF InMemory, Mvc.Testing, Testcontainers | Tests | (not covered) |

---

# 3. Startup Flow From Zero

This section explains what happens between typing `dotnet run` (or `dotnet StudentService.dll`) and "ready for requests". The detailed example is `Services/StudentService/Program.cs`; the other programs follow the same sequence.

## 3.1 Step by step (Student Service)
1. **The .NET runtime starts `Program.cs`.** There is no `Main` method written out: C# "top-level statements" make the file's statements the entry point. `public partial class Program { }` at the bottom only gives tests a type to refer to.
2. **`WebApplication.CreateBuilder(args)`** creates the *builder* and **builds configuration** from, in increasing priority: `appsettings.json` → environment variables (nested keys use `__`, e.g. `Jwt__Secret`) → command-line arguments. Higher wins. Reading values happens through `builder.Configuration`.
3. **`builder.AddSmsObservability("student-service")`** (`BuildingBlocks/Observability/ObservabilityExtensions.cs`) configures Serilog (console log format with trace and correlation ids) and OpenTelemetry tracing/metrics. The OTLP trace exporter is added only when `OpenTelemetry:OtlpEndpoint` is non-empty.
4. **Database registration:** `builder.Services.AddDbContext<StudentDbContext>(o => o.UseMySql(cs, new MySqlServerVersion(new Version(8,0,36)), my => my.EnableRetryOnFailure(3)))`. `cs` comes from `ConnectionStrings:StudentDb`. Pomelo is the MySQL provider; the server version is given explicitly so no connection is opened just to detect it. `EnableRetryOnFailure(3)` retries transient errors, which has a consequence for transactions (section 3.4).
5. **Identity:** `AddIdentityCore<AppUser>(...).AddRoles<AppRole>().AddEntityFrameworkStores<StudentDbContext>()` registers `UserManager<AppUser>` and `RoleManager<AppRole>` (password rules, lockout, unique e-mail).
6. **Shared registrations** from `Common`: `AddSmsJwtAuth` (JWT bearer + authorization), `AddSmsRedis` (Redis cache + Redis health check), `AddSmsControllers` (MVC controllers with string enums and a JSON validation-error format), `AddSmsWebDefaults` (exception handler + Swagger with a "Bearer" button).
7. **The app's own services** are registered: `IStudentRepository → StudentRepository`, `IStudentAppService → StudentAppService`, `IAuthService → AuthService` (all `AddScoped`), `AdminSeeder` as a hosted service, and a MySQL health check `AddDbContextCheck<StudentDbContext>("mysql")`.
8. **`builder.Build()`** turns the registrations into an app (the **dependency-injection container** is now frozen).
9. **Migrations at startup:** if `Database:MigrateOnStartup` is true (default), a DI scope is created and `Database.MigrateAsync()` applies pending EF Core migrations (`CREATE TABLE ...` only; section 8).
10. **Middleware pipeline** (order matters, section 3.3): `UseSmsWebDefaults` → `UseSmsObservability` → `UseAuthentication` → `UseAuthorization` → `MapControllers` → `MapSmsHealth`.
11. **`app.Run()`** starts Kestrel (listening on the address in `Urls`), then **starts every hosted service** (`AdminSeeder` creates the three roles and the first admin account if missing). The program is **ready** when Kestrel is listening and `/health/live` answers 200 (`/health/ready` additionally needs MySQL and Redis to be reachable).

## 3.2 Dependency injection in beginner terms
**Dependency injection (DI)** means a class does not create the objects it needs; it *asks* for them in its constructor and the framework supplies them. Example (`StudentAppService`): `public StudentAppService(IStudentRepository repo, ICacheService cache, ILogger<StudentAppService> log)`. The container knows `IStudentRepository` means `StudentRepository` because `Program.cs` registered that pair. Using an *interface* in the constructor lets tests substitute a fake.
| Lifetime | Meaning | Used for |
|---|---|---|
| **Singleton** (`AddSingleton`) | one instance for the whole process | `JwtTokenService`, `ICacheService`, `RabbitMqConnection`, `IEventPublisher`, `EmailSimulator`, `OutboxPublisher` |
| **Scoped** (`AddScoped`) | one instance per HTTP request (or per manually created scope) | DbContexts, repositories, app services, saga orchestrator, command/query handlers |
| **Transient** (`AddTransient`) | a new instance each time it is requested | `ServiceAuthHandler` (HttpClient message handler) |
**Why background jobs create scopes:** a singleton/hosted service lives forever, but a DbContext must be short-lived, so jobs call `IServiceScopeFactory.CreateScope()` for each unit of work (see `NotificationDispatcher`, `SagaRecoveryJob`, `OutboxPublisher`).

## 3.3 The middleware pipeline (service programs)
**Middleware** are components every request passes through in order, and the response passes back through in reverse. Order in each service `Program.cs`:
| # | Middleware | Defined in | Why here |
|---|---|---|---|
| 1 | `CorrelationIdMiddleware` | `BuildingBlocks/Common/Web/CorrelationIdMiddleware.cs` | first, so every later log line and error carries the id |
| 2 | `UseExceptionHandler` (→ `GlobalExceptionHandler`) | `Common/Errors/GlobalExceptionHandler.cs` | catches exceptions from everything after it |
| 3 | Swagger / Swagger UI | `UseSmsWebDefaults` | serves `/swagger` |
| 4 | Serilog request logging | `UseSmsObservability` | logs `HTTP GET /x -> 200 (n ms)` |
| 5 | Prometheus scraping endpoint | `UseSmsObservability` | serves `/metrics` |
| 6 | `UseAuthentication` | ASP.NET Core | reads `Authorization: Bearer ...` and builds the user (`ClaimsPrincipal`) |
| 7 | `UseAuthorization` | ASP.NET Core | enforces `[Authorize]` / roles |
| 8 | Endpoints: `MapControllers`, `MapSmsHealth` | — | runs the matching controller action or health check |
Authentication must come before authorization (you must know *who* before deciding *what they may do*), and the exception handler must come early to wrap them.

## 3.4 Database, migrations and `EnableRetryOnFailure`
- **DbContext** = EF Core's unit of work and gateway to the database. Each service has its own (`StudentDbContext`, `CourseDbContext`, `EnrollmentDbContext`, `NotificationDbContext`) mapped by **Fluent API** classes in `Data/Configurations/EntityConfigurations.cs`.
- **Migrations** (`Data/Migrations/*InitialCreate.cs`) are generated C# that create the tables. Applied at start by `MigrateAsync()`. They only **add** `dn_*` tables (plus `__EFMigrationsHistory`) to the existing databases.
- **Consequence of `EnableRetryOnFailure`:** EF may re-run a failed operation, so a *user-started* transaction must be wrapped in the retry strategy. The project does this in `DbContextExtensions.InTransactionAsync` (and `AuthService.RegisterAsync`), which creates the execution strategy, begins the transaction, runs your delegate and commits. Code inside the delegate may therefore run more than once and must contain only database work.
- `DesignTimeFactory.cs` in each `Data/` folder lets the `dotnet ef` tool build a DbContext **without** starting the web host (so tooling never applies migrations by accident).

## 3.5 Background (hosted) services that start with the host
| Service | Program | Class | Started by |
|---|---|---|---|
| Admin seeder (runs once) | Student | `AdminSeeder` (`IHostedService`) | `AddHostedService<AdminSeeder>()` |
| Outbox publisher (every 1 s) | Enrollment | `OutboxPublisher` | `AddSingleton` + `AddHostedService(sp => ...)` |
| Saga recovery (every 15 s) | Enrollment | `SagaRecoveryJob` | `AddHostedService` |
| RabbitMQ consumers | Notification | `EnrollmentEventsConsumer`, `CourseEventsConsumer` | `AddHostedService` |
| Notification dispatcher (every 2 s) | Notification | `NotificationDispatcher` | `AddHostedService` |

## 3.6 Kestrel, ports and "ready"
**Kestrel** is ASP.NET Core's built-in web server. The listening address comes from `Urls` in `appsettings.json` (`http://localhost:808x`, local processes) or `ASPNETCORE_URLS` (set to `http://+:8080` inside containers, which overrides the file because environment variables have higher priority). Health endpoints: `/health/live` (process is up, no dependencies), `/health/ready` and `/health` (MySQL, Redis, RabbitMQ as applicable). `scripts/start-local.sh` waits for `/health/live`.

## 3.7 What is special at startup, per program
| Program | Special |
|---|---|
| ApiGateway | No database, no Redis, no RabbitMQ. Loads YARP routes/clusters from `ReverseProxy` config; validates JWT; no migrations; `UseSwaggerUI` only (no SwaggerGen). Start it last. |
| StudentService | Identity + roles; `AdminSeeder`; Redis; **no RabbitMQ**. Migration creates 9 tables. |
| CourseService | Redis + RabbitMQ publisher; migration with a CHECK constraint on seats. |
| EnrollmentService | Typed HTTP clients with resilience (`AddRemoteClients`); RabbitMQ publisher; outbox publisher + saga recovery jobs; generated column `ActiveKey`. |
| NotificationService | RabbitMQ consumers (connect-with-retry loop); dispatcher; declares queues + dead-letter queues. |

---

# 4. Configuration in Depth

## 4.1 How configuration works
Every program has one `appsettings.json`. **No environment-specific files exist** (`appsettings.Development.json` etc. were verified absent), so there is a single set of defaults; differences between environments are supplied by **environment variables**, written with `__` for nesting (`Jwt:Secret` ⇒ `Jwt__Secret`). Precedence (highest first): command line, environment variables, `appsettings.json`, code defaults (the `?? "default"` / `GetValue("key", default)` calls).

## 4.2 Keys common to the services
| Key | Meaning | Read by | Env override |
|---|---|---|---|
| `Urls` | Kestrel listen address (808x) | ASP.NET Core host | `ASPNETCORE_URLS` (containers) |
| `AllowedHosts` | host-header filtering (`*` = any) | host-filtering middleware | `AllowedHosts` |
| `ConnectionStrings:<X>Db` | MySQL connection to this service's database (format `Server=..;Port=3306;Database=..;User=..;Password=..;`; **a development default exists**) | `Program.cs` (`GetConnectionString`) | `ConnectionStrings__StudentDb` / `CourseDb` / `EnrollmentDb` / `NotificationDb` |
| `ConnectionStrings:Redis` | Redis address (`localhost:6379`) — Student and Course only | `AddSmsRedis` | `ConnectionStrings__Redis` |
| `Jwt:Secret` | HMAC signing key, ≥ 32 characters, **identical in gateway and all services**; a development default exists | `AddSmsJwtAuth`, `JwtTokenService` | `Jwt__Secret` |
| `Jwt:Issuer`, `Jwt:Audience` | token issuer/audience that must match on validation | `JwtOptions`, `JwtTokenService.ValidationParameters` | `Jwt__Issuer`, `Jwt__Audience` |
| `Jwt:AccessTokenMinutes`, `Jwt:RefreshTokenDays` | token lifetimes (15 / 7); present only in Student's file, defaults in `JwtOptions` elsewhere | `JwtTokenService.AccessTtl/RefreshTtl` | `Jwt__AccessTokenMinutes` ... |
| `Database:MigrateOnStartup` | apply EF migrations at start | each `Program.cs` | `Database__MigrateOnStartup` |
| `OpenTelemetry:OtlpEndpoint` | OTLP gRPC trace endpoint; empty = exporter off | `ObservabilityExtensions.AddSmsObservability` | `OpenTelemetry__OtlpEndpoint` |

## 4.3 Service-specific keys
**Student** (`Services/StudentService/appsettings.json`): `Bootstrap:AdminUsername|AdminEmail|AdminPassword` — read by `AdminSeeder` to create the first Admin (a development default password exists; env `Bootstrap__AdminPassword`).

**Course** (`Services/CourseService/appsettings.json`): `RabbitMq:*` (below); `Course:LowAvailabilityThreshold` (5) — `SeatService.Threshold`, publish the low-seat event when seats left ≤ this.

**Enrollment** (`Services/EnrollmentService/appsettings.json`):
| Key | Meaning | Read by |
|---|---|---|
| `Services:Student`, `Services:Course` | base URLs of the services Enrollment calls | `Clients/ClientRegistration.cs` |
| `Resilience:TotalTimeoutSeconds` (12) | overall timeout of one remote call including retries | `ClientRegistration` |
| `Resilience:AttemptTimeoutSeconds` (4) | per-HTTP-attempt timeout | `ClientRegistration` |
| `Resilience:RetryAttempts` (3) | retries after the first try | `ClientRegistration` |
| `Resilience:BreakerMinimumThroughput` (5), `BreakerDurationSeconds` (10) | circuit breaker: min calls before it can open; time it stays open | `ClientRegistration` |
| `Resilience:RetryDelayMs`, `BreakerSamplingSeconds` | **not in the file**; code defaults 300 ms and 30 s | `ClientRegistration` |
| `Saga:RecoveryIntervalMs` (15000), `Saga:StaleAfterSeconds` (30) | how often to look for stuck sagas / how old counts as stuck | `SagaRecoveryJob` |
| `Outbox:IntervalMs` (1000), `Outbox:BatchSize` (50) | outbox poll interval / rows per poll | `OutboxPublisher` |

**Notification** (`Services/NotificationService/appsettings.json`): `Notification:AdminEmail` (recipient of low-seat alerts, `NotificationIngestService`), `DispatchIntervalMs` 2000, `BatchSize` 50 (`NotificationDispatcher`), `MaxAttempts` 5, `BaseBackoffSeconds` 5 (`NotificationProcessor`), `ConsumerMaxAttempts` 4, `ConsumerRetryDelayMs` 1000 (`Consumers.cs`).

**RabbitMQ** (Course, Enrollment, Notification): `RabbitMq:HostName|Port|UserName|Password|VirtualHost` — bound to `RabbitMqOptions`, used by `RabbitMqConnection` (`BuildingBlocks/Messaging/RabbitMq.cs`). Defaults: localhost:5672, a development login.

**API Gateway** (`ApiGateway/appsettings.json`):
| Key | Meaning |
|---|---|
| `Cors:AllowedOrigins` | comma-separated browser origins allowed (`Program.cs`) |
| `ReverseProxy:Routes:<id>` | one YARP route: `ClusterId`, `Order` (lower first), `AuthorizationPolicy` (`public` or `authenticated`), `Match:Path` (+ `Methods`), optional `Transforms` |
| `ReverseProxy:Clusters:<name>` | `Destinations:d1:Address` (the service URL), `LoadBalancingPolicy: RoundRobin`, passive `HealthCheck` (transport-failure policy, 10 s reactivation), `HttpRequest:ActivityTimeout` 30 s |
Routes defined: `auth-public` (order 0, POST `login|register|refresh|logout`, policy public), `auth-protected`, `students`, `students-root`, `courses`, `courses-root`, `enrollments`, `enrollments-root`, `notifications`, `notifications-root`, and four `docs-*` routes (public, `PathPattern` transform to `/swagger/v1/swagger.json`). Override a destination with `ReverseProxy__Clusters__student__Destinations__d1__Address`.

## 4.4 All environment variables in one table
| Variable | Used by | Purpose |
|---|---|---|
| `ASPNETCORE_URLS` | containers | listen address (`http://+:8080`) |
| `ConnectionStrings__StudentDb/CourseDb/EnrollmentDb/NotificationDb`, `ConnectionStrings__Redis` | services | databases / Redis |
| `RabbitMq__HostName/UserName/Password` | Course, Enrollment, Notification | broker |
| `Jwt__Secret` | gateway + all services | signing key |
| `Bootstrap__AdminPassword` | Student | first admin |
| `Services__Student`, `Services__Course` | Enrollment | downstream URLs |
| `ReverseProxy__Clusters__<name>__Destinations__d1__Address` | gateway | service URLs |
| `OpenTelemetry__OtlpEndpoint` | all | trace exporter (`start-local.sh` exports `http://localhost:4317` by default) |
| `ASPNETCORE_ENVIRONMENT=Production` | containers (compose) | environment name (no per-environment config files exist, so it changes nothing in practice) |
| Compose-level `MYSQL_HOST/PORT/USER/PASSWORD`, `JWT_SECRET`, `ADMIN_PASSWORD`, `RABBITMQ_USER/PASSWORD`, `GRAFANA_PASSWORD` | `docker-compose.yml` / `.env` | feed the settings above |
`Kubernetes/01-configmap.yaml` carries the non-secret ones (`ASPNETCORE_URLS`, `ConnectionStrings__Redis`, `RabbitMq__HostName`, `Services__*`, YARP destinations, empty OTLP endpoint); `Kubernetes/03-secret.yaml` is a **template** for the secret ones (DB login, `Jwt__Secret`, admin password, RabbitMQ login).

## 4.5 Which configuration is used where
| Environment | How values arrive |
|---|---|
| Local processes (`scripts/start-local.sh`) | only the `appsettings.json` defaults (+ the exported OTLP endpoint) |
| Docker Compose | `docker-compose.yml` passes `.env`-derived environment variables; `MYSQL_HOST` defaults to `host.docker.internal` because `localhost` inside a container is the container itself |
| Kubernetes | ConfigMap `sms-config` + Secret `sms-secrets` as environment variables; `mysql-host` ExternalName service for the outside MySQL |

---

# 5. The Scripts, Line by Line

Four scripts live in `scripts/`. Nothing in them changes application source code; they are the "how do I run and prove it works" layer. This section explains the three you asked about and, briefly, `failure-scenarios.py`.

## 5.1 `scripts/start-local.sh` — start the five programs on the host

**Purpose:** start the four services and the gateway as background `dotnet` processes, wait until each is alive, and print the useful URLs.
**Prerequisites:** infrastructure containers already running (`docker compose up -d rabbitmq redis jaeger ...`), host MySQL running, and the solution already built (`dotnet build StudentManagement.sln`) because the script uses `--no-build`.
**Run:** `scripts/start-local.sh` from anywhere. **Exit code:** 0 on success; non-zero if a program never became healthy (because of `set -e`, see line 21).

| Lines | Code | Explanation |
|---|---|---|
| 1 | `#!/usr/bin/env bash` | "shebang": run this file with Bash found on the PATH. |
| 2–4 | comments | usage notes: prerequisites; order note. |
| 5 | `set -euo pipefail` | Safety switches. `-e`: stop at the first command that fails. `-u`: using an undefined variable is an error. `-o pipefail`: a pipeline fails if any part fails. |
| 6 | `cd "$(dirname "$0")/.."` | `$0` is the script path; `dirname` gives `scripts/`; `/..` is the project root. After this, relative paths like `Services/StudentService` work wherever you launched the script from. |
| 7 | `export PATH="$PATH:$HOME/.dotnet"` | makes the user-installed `dotnet` visible to this script and to the children it starts. |
| 8 | `mkdir -p logs` | create `logs/` if it does not exist (`-p`: no error if it does). Each program's output goes there. |
| 9–10 | comment + `export OpenTelemetry__OtlpEndpoint="${OpenTelemetry__OtlpEndpoint-http://localhost:4317}"` | Sets the environment variable that ASP.NET Core maps to the config key `OpenTelemetry:OtlpEndpoint` (`__` = `:`). `${VAR-default}` means: if `VAR` is **unset**, use the default; if you set it to empty, the empty value is kept (that is how you switch the trace exporter off). Child processes inherit it, so every program ships traces to Jaeger on port 4317. |
| 11–15 | `start() { ... }` | A **function** with three arguments: `$1` name, `$2` project folder, `$3` port. |
| 12 | `if (echo > /dev/tcp/127.0.0.1/$3) 2>/dev/null; then ...; return; fi` | Bash can open a TCP connection by "writing" to the special path `/dev/tcp/host/port`. If that succeeds, something already listens on the port, so the function prints "already listening" and returns **without starting a duplicate** (this makes the script safe to re-run). The parentheses run it in a subshell; `2>/dev/null` hides the "connection refused" error. |
| 13 | `nohup dotnet run --no-build --no-launch-profile --project "$2" > "logs/$1.log" 2>&1 &` | Starts the program. `nohup` keeps it alive after the terminal closes. `dotnet run --no-build` runs the already-compiled output (fast, no compile); `--no-launch-profile` ignores any `launchSettings.json` so the `Urls` in `appsettings.json` decide the port. `> file 2>&1` sends normal and error output to `logs/<name>.log`. The final `&` puts it in the background. |
| 14 | `echo "$1 starting (pid $!, port $3, log logs/$1.log)"` | `$!` is the process id of the most recent background job. |
| 16–22 | `wait_up() { ... }` | Polls a program's health. |
| 17 | `for _ in $(seq 1 90); do` | up to 90 attempts (`_` is an unused loop variable). |
| 18 | `curl -fs "http://localhost:$2/health/live" >/dev/null 2>&1 && { echo "$1 UP"; return; }` | `curl -f` fails on HTTP errors, `-s` is silent. `/health/live` returns 200 as soon as the process is serving. `&&` runs the braces only on success: print "UP" and leave the function. |
| 19 | `sleep 1` | wait one second between attempts. |
| 21 | `echo "$1 did not become healthy - see logs/$1.log"; return 1` | after about 90 s give up; the non-zero return plus `set -e` aborts the script. |
| 23–26 | `start student Services/StudentService 8081` … notification 8084 | The four services are launched back to back **without waiting**, so their (slow) start-ups overlap. Order among them does not matter: there is no service registry. |
| 27 | `for p in "student 8081" ...; do wait_up $p; done` | Now wait for each. `$p` is deliberately **unquoted** so it splits into the two arguments (name, port). |
| 28 | `start gateway ApiGateway 8080; wait_up gateway 8080` | Gateway **last**: its clusters point at the services, so it is best to start it when they are already answering (YARP would otherwise just answer 503 for a short while). |
| 29 | `echo "All up. Gateway: ... Swagger ... RabbitMQ UI ... Jaeger ..."` | prints the URLs. |

**What happens next:** the script ends but the five processes keep running in the background. Each one runs the startup sequence of section 3 (migrations, hosted services, Kestrel). **If a port is already in use** the function prints "already listening" and does not start that program (it assumes the previous instance is yours). **Logs:** `logs/student.log`, `course.log`, `enrollment.log`, `notification.log`, `gateway.log`. Caveat: rebuilding while the programs run can break them — stop first.

## 5.2 `scripts/stop-local.sh` — stop by port

| Line | Code | Explanation |
|---|---|---|
| 1 | shebang | Bash. |
| 2 | comment | "never uses `pkill -f`". `pkill -f pattern` kills **any** process whose command line contains the text — easily including unrelated programs (even your own shell). Stopping by *listening port* only touches the program that really owns the port. |
| 3 | `for port in 8080 8081 8082 8083 8084; do` | gateway and the four services. |
| 4 | `pid=$(lsof -ti tcp:$port -sTCP:LISTEN 2>/dev/null ...)` followed by an OR with `true` | `lsof` lists open files/sockets; `-t` prints just the PID, `-i tcp:$port` selects that port, `-sTCP:LISTEN` only the *listening* socket. `$( ... )` captures the output. The OR-`true` at the end (written as two vertical bars followed by `true` in the script) makes sure a "nothing found" result does not stop the loop. |
| 5 | `[ -n "$pid" ] && { kill $pid && echo "stopped :$port (pid $pid)"; }` | If a PID was found (`-n` = non-empty), send it `SIGTERM` via `kill` and print a line. |
| 6 | `done` | end of the loop. |
| 7 | `exit 0` | always succeed. |
**What `SIGTERM` means for ASP.NET Core:** it is the polite "please stop" signal. The host begins **graceful shutdown**: Kestrel stops accepting new requests, in-flight requests finish, `BackgroundService.StopAsync` is called (outbox/dispatcher loops end, RabbitMQ consumers stop), then the process exits. It does **not** stop the Docker containers (RabbitMQ, Redis, ...): use `docker compose down`/`stop` for those. Note the script has no `set -e`, so a failed `kill` on one port never prevents the others from being tried.

## 5.3 `scripts/e2e.py` — end-to-end checks through the gateway

**Purpose:** a Python 3 program (standard library only: `urllib`, `json`, `concurrent.futures`) that exercises the **whole running system** the way a real client does and prints `PASS`/`FAIL` per assertion. **Prerequisites:** the whole stack from `start-local.sh` plus the infrastructure containers. **Exit code:** 0 if all checks passed, 1 otherwise. It makes **50 check executions**: 45 individual `check(...)` calls plus one `check` inside a loop that runs five times (one per health endpoint). The file also contains a 49th-looking `check` inside an `except` branch, which only runs if the metrics request throws, and the `def check` line itself, so a plain text search for `check(` finds 48 occurrences. Last line printed: `ALL CHECKS PASSED` or `N CHECK(S) FAILED: ...`.

### Helper functions (lines 1–36)
| Part | Explanation |
|---|---|
| `GW`, `ADMIN_PW`, `RABBIT`, `RUN` | gateway URL (env `GATEWAY`, default `http://localhost:8080`); admin password (env `ADMIN_PASSWORD`, a development default exists — not shown); `RABBIT` is defined but not used by any check; `RUN` = random 6 hex digits appended to usernames/e-mails/course codes so the script can be re-run without unique-constraint clashes. |
| `call(method, path, body, token, headers, base)` | builds an HTTP request (JSON content type, optional `Authorization: Bearer`), sends it, and **returns `(status, parsed_json)` even for HTTP errors** (it catches `HTTPError` and still reads the body). 60-second timeout. `base` lets it call a different host (used for health checks). |
| `check(name, cond, detail)` | prints `PASS  name` or `FAIL  name -> detail` and remembers failures in `FAILS`. |
| `poll(fn, timeout=40, every=1.0)` | repeats `fn` until it returns something truthy or the time runs out; used for **asynchronous** effects (Kafka-style delays — here RabbitMQ → notification). |

### Test phases
| Phase (lines) | Calls | Expected | Architectural feature it proves |
|---|---|---|---|
| **Auth** (38–46) | `GET /api/students` with no token; admin login; refresh; refresh again with the old token; login with a wrong password; `GET /api/auth/me`; request with garbage token | 401 from the gateway; 200; new refresh token ≠ old; old one → 401; 401; role `Admin`; 401 | gateway JWT check, Identity login, **refresh-token rotation** (each token usable once), password check |
| **Master data** (48–59) | create category; create course (2 seats); create 4 students; create student with empty name + bad e-mail | 201, 201, 4 ids, then 400 with `fieldErrors.email` | Course/Student CRUD through the gateway, model validation and the common error body |
| **Roles** (61–72) | public register (Student); anonymous register with role Admin; Admin registers Staff; student logs in; student lists students; reads own profile; reads someone else's; creates a course; browses courses; enrols someone else | 201 role Student; 403; 201; 403; 200; 403; 403; 200; 403 | role-based authorization and ownership rules in the services (defence in depth behind the gateway) |
| **Enrollment workflows** (74–95) | enrol student 1 with `Idempotency-Key`; replay same key; enrol again with a new key; read availability; unknown student; unknown course; deactivate student 3 then enrol; student 2 fills the course; student 4 when full; availability; student history; course list `status=Confirmed`; search by student + `Rejected`; cancel; availability; cancel again; re-enrol | 201 `Confirmed`; same enrolment id; 409; 1 of 2 seats; 422 "does not exist" (×2); 422 "not eligible"; 201; 422 "no seats"; 0 seats (never negative); history contains it; 2 confirmed; 1 rejected; `Cancelled`; seat released (1); 422; 201 | **saga** success and every rejection/compensation path, **idempotency**, **duplicate prevention**, atomic seats, **CQRS** queries, cancel + seat release, unique-active-key reset after cancel |
| **Async notifications** (97–110) | poll `GET /api/notifications/student/{id}` (up to 40 s) for the three students; then list all `EnrollmentConfirmed` | `EnrollmentConfirmed`/`Sent` for student 2; confirm + cancel for student 1; `EnrollmentRejected`/`Sent` for student 4; ≤ 1 notification per enrolment | **outbox → RabbitMQ → consumer → inbox → dispatcher** pipeline and duplicate-notification prevention |
| **Concurrency** (112–120) | new 4-seat course; 15 new students; 15 simultaneous `POST /api/enrollments` using a thread pool of 15 | exactly 4 × 201, 11 × 422; availability exactly 0 of 4 | the **atomic conditional UPDATE** prevents overselling under real parallelism |
| **Health + metrics** (122–129) | `GET /health/ready` on ports 8081, 8082, 8083, 8084, 8080; `GET http://localhost:8083/metrics` | 200 ×5; body contains `outbox_events_published` | readiness checks (MySQL/Redis/RabbitMQ), OpenTelemetry/Prometheus metrics incl. the custom outbox counter |
| **Summary** (131–132) | prints result, `sys.exit(1 if FAILS else 0)` | | |
**Side effects:** it creates test rows (a category, 2 courses, about 20 students, 1 student account, 1 staff account, enrolments, notifications, outbox/saga rows, refresh tokens) in the real `dn_*` tables and **never deletes them**; names carry the run id so reruns do not collide.

## 5.4 `scripts/failure-scenarios.py` (briefly)
Starts from an already running stack and **actively breaks things**: stops the RabbitMQ container, enrols, shows the events still `Pending` (with retry attempts) in `dn_outbox_messages` via the `mysql` client, restarts RabbitMQ and waits for them to become `Published` and the notification `Sent`; then stops Course Service (by port, with `kill`), enrols (the validation step fails fast and the saga compensates, so the client sees `422 Rejected`), sends six more requests to show calls keep answering quickly, restarts Course Service (`dotnet run --no-build`), and checks consistency (duplicate → 409, seat count 49 of 50). 9 checks. It needs the `mysql` command-line client and uses the local development MySQL login by default.

## 5.5 What runs, in which order, when you type the three commands
1. **`scripts/start-local.sh`** — creates `logs/`, exports the OTLP endpoint, starts the four services in parallel (each: configuration → DI → migrations → hosted services → Kestrel), polls each until `/health/live` is 200, starts the gateway, polls it, prints the URLs, returns. Five background processes now run.
2. **`python3 scripts/e2e.py`** — logs in as admin through the gateway (:8080); everything after goes gateway → service → MySQL/Redis/RabbitMQ and back; asynchronous steps are polled; finally health and metrics are read directly from the programs' ports. Prints PASS/FAIL per check.
3. **`scripts/stop-local.sh`** — for each of the five ports finds the owning process and sends `SIGTERM`; the programs shut down gracefully. Containers keep running.

---

# 6. Every Endpoint and the Flow Behind It

## 6.1 Endpoint catalogue (36 business endpoints + infrastructure)
All business paths are called through the gateway at `http://localhost:8080`. "Route" is the YARP route (cluster) carrying it. **Roles** are enforced twice: the gateway requires only a *valid token* (policy `authenticated`; public for four auth paths); the **service** enforces the role with `[Authorize(Roles=...)]` plus ownership checks. `Admin`, `Staff`, `Student` are user roles; `Service` is an internal role carried by tokens services create for each other.

| # | Method + path | Route → service | Controller.Action | Roles / policy | Request DTO | Success | Notable errors |
|---|---|---|---|---|---|---|---|
| 1 | `POST /api/auth/register` | auth-public → Student | `AuthController.Register` | public (Admin token needed for Staff/Admin) | `RegisterRequest` | 201 `UserResponse` | 400, 403, 409 |
| 2 | `POST /api/auth/login` | auth-public → Student | `AuthController.Login` | public | `LoginRequest` | 200 `TokenResponse` | 401 |
| 3 | `POST /api/auth/refresh` | auth-public → Student | `AuthController.Refresh` | public | `RefreshRequest` | 200 `TokenResponse` | 401 |
| 4 | `POST /api/auth/logout` | auth-public → Student | `AuthController.Logout` | public | `RefreshRequest` | 204 | — |
| 5 | `GET /api/auth/me` | auth-protected → Student | `AuthController.Me` | any authenticated | — | 200 `UserResponse` | 401 |
| 6 | `POST /api/students` | students-root → Student | `StudentsController.Create` | Admin, Staff | `StudentRequest` | 201 `StudentResponse` + `Location` | 400, 409 |
| 7 | `GET /api/students` | students-root → Student | `StudentsController.Search` | Admin, Staff | query: search,status,gender,page,size,sort | 200 `PagedResult<StudentResponse>` | 400 (bad sort), 403 |
| 8 | `GET /api/students/{id}` | students → Student | `StudentsController.Get` | Admin, Staff, Service; Student only own id | — | 200 | 403, 404 |
| 9 | `GET /api/students/{id}/eligibility` | students → Student | `StudentsController.Eligibility` | Admin, Staff, Service | — | 200 `EligibilityResponse` | 404 |
| 10 | `PUT /api/students/{id}` | students → Student | `StudentsController.Update` | Admin, Staff; Student own id (cannot send status) | `StudentRequest` | 200 | 400, 403, 404, 409 |
| 11 | `PATCH /api/students/{id}/status` | students → Student | `StudentsController.UpdateStatus` | Admin, Staff | `StatusUpdateRequest` | 200 | 400, 404 |
| 12 | `DELETE /api/students/{id}` | students → Student | `StudentsController.Delete` | Admin | — | 204 | 404 |
| 13 | `POST /api/courses/categories` | courses → Course | `CategoriesController.Create` | Admin, Staff | `CategoryRequest` | 201 | 400, 409 |
| 14 | `GET /api/courses/categories` | courses → Course | `CategoriesController.List` | any authenticated | — | 200 list | — |
| 15 | `PUT /api/courses/categories/{id}` | courses → Course | `CategoriesController.Update` | Admin, Staff | `CategoryRequest` | 200 | 404, 409 |
| 16 | `DELETE /api/courses/categories/{id}` | courses → Course | `CategoriesController.Delete` | Admin | — | 204 | 404, 409 (in use) |
| 17 | `POST /api/courses` | courses-root → Course | `CoursesController.Create` | Admin, Staff | `CourseRequest` | 201 `CourseResponse` | 400, 409, 422 |
| 18 | `GET /api/courses` | courses-root → Course | `CoursesController.Search` | any authenticated | query: search,categoryId,status,minFees,maxFees,availableOnly,page,size,sort | 200 paged | 400 |
| 19 | `GET /api/courses/{id}` | courses → Course | `CoursesController.Get` | any authenticated | — | 200 (cached) | 404 |
| 20 | `GET /api/courses/{id}/availability` | courses → Course | `CoursesController.Availability` | any authenticated | — | 200 (cached 1 min) | 404 |
| 21 | `PUT /api/courses/{id}` | courses → Course | `CoursesController.Update` | Admin, Staff | `CourseRequest` | 200 | 404, 409, 422 |
| 22 | `PATCH /api/courses/{id}/status` | courses → Course | `CoursesController.UpdateStatus` | Admin, Staff | `StatusRequest` | 200 | 404 |
| 23 | `DELETE /api/courses/{id}` | courses → Course | `CoursesController.Delete` | Admin | — | 204 | 404, 409 |
| 24 | `POST /api/courses/{id}/seats/reserve` | courses → Course | `CoursesController.Reserve` | Admin, Service | `SeatRequest` | 200 `SeatResponse` | 404, 409 |
| 25 | `POST /api/courses/{id}/seats/release` | courses → Course | `CoursesController.Release` | Admin, Service | `SeatRequest` | 200 `SeatResponse` | 404, 409 |
| 26 | `POST /api/enrollments` | enrollments-root → Enrollment | `EnrollmentsController.Enroll` | Admin, Staff, Student (self only) | `EnrollmentRequest` + header `Idempotency-Key` | 201 Confirmed / 202 InProgress | 422 Rejected, 409, 403 |
| 27 | `POST /api/enrollments/{id}/cancel` | enrollments → Enrollment | `EnrollmentsController.Cancel` | Admin, Staff, Student (own) | `CancelRequest` (optional) | 200 `EnrollmentResponse` | 404, 409, 422, 503 |
| 28 | `PUT /api/enrollments/{id}` | enrollments → Enrollment | `EnrollmentsController.Update` | Admin, Staff | `EnrollmentUpdateRequest` | 200 | 404 |
| 29 | `GET /api/enrollments/{id}` | enrollments → Enrollment | `EnrollmentsController.Get` | Admin, Staff, Student (own) | — | 200 | 403, 404 |
| 30 | `GET /api/enrollments` | enrollments-root → Enrollment | `EnrollmentsController.Search` | Admin, Staff | query: studentId,courseId,status,from,to,page,size,sort | 200 paged | 400 |
| 31 | `GET /api/enrollments/student/{studentId}` | enrollments → Enrollment | `EnrollmentsController.History` | Admin, Staff, Student (own) | — | 200 paged | 403 |
| 32 | `GET /api/enrollments/course/{courseId}` | enrollments → Enrollment | `EnrollmentsController.ForCourse` | Admin, Staff | query: status,page,size,sort | 200 paged | — |
| 33 | `GET /api/notifications` | notifications-root → Notification | `NotificationsController.Search` | Admin, Staff | query: studentId,status,type,page,size | 200 paged | — |
| 34 | `GET /api/notifications/{id}` | notifications → Notification | `NotificationsController.Get` | Admin, Staff | — | 200 | 404 |
| 35 | `GET /api/notifications/student/{studentId}` | notifications → Notification | `NotificationsController.ForStudent` | Admin, Staff; Student own | — | 200 paged | 403 |
| 36 | `POST /api/notifications/{id}/retry` | notifications → Notification | `NotificationsController.Retry` | Admin, Staff | — | 200 | 404, 422 |

Route note: `/api/courses/categories` and `/api/courses/{id}` both start with `/api/courses/`. ASP.NET routing prefers the **literal** segment `categories` over the `{id:long}` pattern (also constrained to numbers), so `GET /api/courses/categories` reaches `CategoriesController.List`.

### Infrastructure endpoints
| Endpoint | Where | Access | Purpose |
|---|---|---|---|
| `GET /health/live`, `/health/ready`, `/health` | every program | public | liveness / readiness (JSON `{status, checks}` from `HealthWriter`; gateway `live` is plain text) |
| `GET /metrics` | every program | public | Prometheus text (OpenTelemetry) |
| `GET /swagger` (UI), `/swagger/v1/swagger.json` | each service | public | per-service API docs (gateway `/swagger` is a UI listing all four) |
| `GET /docs/<name>/swagger.json` (name = student, course, enrollment or notification) | gateway routes `docs-*` | public | proxied service OpenAPI documents (path rewritten by a `PathPattern` transform) |
| `GET /gateway/routes` | `ApiGateway/Program.cs` | public | lists the YARP routes (route id, path, methods, cluster, policy) |
| RabbitMQ UI `:15672`, Jaeger `:16686`, Prometheus `:9090`, Grafana `:3001` | containers | dev logins | operations UIs |

## 6.2 The common prefix and suffix of every flow
**Prefix P** (client → controller action):
1. **Client** sends the request to `http://localhost:8080` with `Authorization: Bearer <jwt>` (except the four public auth calls).
2. **Gateway pipeline** (`ApiGateway/Program.cs`): `CorrelationIdMiddleware` creates/forwards `X-Correlation-Id` (also written into the **request** headers so the proxy passes it on) → `UseExceptionHandler` → `UseSmsObservability` (request logging, `/metrics`) → `UseCors` → `UseSwaggerUI` → `UseAuthentication` (validates the JWT with `JwtTokenService.ValidationParameters`) → `UseAuthorization` (route policy `authenticated`: no valid user ⇒ `JwtBearerEvents.OnChallenge` writes the JSON **401** and the request never reaches a service; policy `public` skips this).
3. **YARP** (`MapReverseProxy`) matches the route by `Order` and path, applies transforms, picks a destination of the cluster (RoundRobin), forwards the request **including the `Authorization` header** over HTTP to the service. If the destination is unreachable, the pipeline step in `Program.cs` replaces the empty 502/504 by **503** JSON "`<cluster> is currently unavailable...`".
4. **Service pipeline** (section 3.3): correlation id → exception handler → request logging → `UseAuthentication` (the service validates the same JWT again: **defence in depth**; invalid token ⇒ anonymous ⇒ 401) → `UseAuthorization`.
5. **Endpoint routing** selects the controller action from `[Route]`/`[HttpGet]` attributes.
6. **Authorization attribute** `[Authorize(Roles = ...)]` is evaluated by `UseAuthorization` from the endpoint's metadata, **before** the action runs; failure ⇒ `JwtBearerEvents.OnForbidden` writes **403** JSON (a missing/invalid user was already answered with 401 by `OnChallenge`).
7. **Model binding and validation:** the JSON body becomes the DTO record; `[Required]`, `[StringLength]`, `[EmailAddress]`, `[Range]`, `[RegularExpression]` and the custom `[OptionalPhone]` run. A failure produces **400** through `ConfigureApiBehaviorOptions.InvalidModelStateResponseFactory` (`BuildingBlocks/Common/ServiceCollectionExtensions.cs`) with `fieldErrors`, and the action is never called. (This ordering — 403 before 400 — is standard ASP.NET Core behaviour; the project's scripts only test it with valid bodies.)
8. **Controller action** runs (thin: it calls one application service or command/query handler and applies ownership checks such as `RequireSelfOrStaff`).

**Suffix S** (service → client): the application service returns a DTO (mapping happens inside the service) → the action returns it → JSON serialisation (enums as strings) → middleware unwinds (Serilog logs the line; exceptions would have been turned into the common error body by `GlobalExceptionHandler`) → the gateway streams the response back and echoes `X-Correlation-Id`.

**Standard failures (not repeated below):** no/invalid token → 401 (gateway); wrong role → 403; validation → 400 + `fieldErrors`; unknown id → 404 (`NotFoundException`); uniqueness/optimistic-lock → 409 (`ConflictException`, `DbUpdateConcurrencyException`, duplicate-key `DbUpdateException`); business rule → 422 (`BusinessRuleException`); dependency down → 503 (`ServiceUnavailableException`); anything else → 500 with a generic message (details only in the log).

Paths below: `S/` = `Services/StudentService/`, `C/` = `Services/CourseService/`, `E/` = `Services/EnrollmentService/`, `N/` = `Services/NotificationService/`, `B/` = `BuildingBlocks/`.

## 6.3 Student Service endpoints

### 6.3.1 `POST /api/auth/register`
Prefix P (route `auth-public`, no token needed) → `S/Controllers/AuthController.cs` `Register`: reads the optional caller from `HttpContext.User` (an Admin token is honoured even though the action is `[AllowAnonymous]`) → `S/Services/AuthService.cs` `RegisterAsync(request, callerIsAdmin)`:
1. Role defaults to `Student`; `Normalize` maps text to a known role (unknown ⇒ `ArgumentException` ⇒ 400). A non-Student role without an Admin caller ⇒ `ForbiddenException` ⇒ 403.
2. `UserManager.FindByNameAsync` / `FindByEmailAsync`: taken ⇒ `ConflictException` ⇒ 409.
3. Inside `db.Database.CreateExecutionStrategy().ExecuteAsync(...)` and **one transaction**: for a Student, `IStudentAppService.CreateAsync` inserts the profile (`dn_students`); then `UserManager.CreateAsync(user, password)` inserts into `dn_users` (the password is hashed by Identity, PBKDF2 with salt) and `AddToRoleAsync` into `dn_user_roles`; commit.
4. Response 201 `UserResponse{userId, username, email, role, studentId}` (Suffix S).
Tables: `dn_students`, `dn_users`, `dn_user_roles`, `dn_roles` (read).

### 6.3.2 `POST /api/auth/login`
Prefix P → `AuthController.Login` → `AuthService.LoginAsync`: find the user by name or e-mail (not found ⇒ `UnauthorizedAppException` ⇒ 401, same message as a bad password so attackers learn nothing) → `IsLockedOutAsync` (5 failed attempts ⇒ locked 5 minutes) → `CheckPasswordAsync` (wrong ⇒ `AccessFailedAsync`, 401) → `ResetAccessFailedCountAsync` → `IssueAsync`: `JwtTokenService.CreateAccessToken` (HS256, 15 min, claims `sub`, `unique_name`, `jti`, `role`, `studentId`), a random 48-byte refresh token (shown once), **only its SHA-256 hash** saved in `dn_refresh_tokens` (7 days). 200 `TokenResponse{accessToken, refreshToken, tokenType:"Bearer", expiresInSeconds, username, role, studentId}`.

### 6.3.3 `POST /api/auth/refresh`
`AuthService.RefreshAsync`: hash the presented token → find in `dn_refresh_tokens` (missing ⇒ 401) → revoked or expired ⇒ 401 → mark `Revoked = true` (**rotation**) → load the user → `IssueAsync` saves the revocation and the new token in one `SaveChanges`. Reusing the old token later ⇒ 401.

### 6.3.4 `POST /api/auth/logout`
`AuthService.LogoutAsync`: marks the token revoked if it exists; unknown tokens are ignored. 204. (Access tokens cannot be revoked; they just expire.)

### 6.3.5 `GET /api/auth/me`
Route `auth-protected` (JWT needed). `AuthController.Me` reads the `sub` claim → `AuthService.MeAsync` → `UserManager.FindByIdAsync` + roles → `UserResponse`.

### 6.3.6 `POST /api/students`
Prefix P (roles Admin, Staff) → `S/Controllers/StudentsController.cs` `Create` → `S/Services/StudentAppService.cs` `CreateAsync`: `IStudentRepository.EmailExistsAsync` (case-insensitive; true ⇒ 409) → new `Student` with `Apply` (trimmed names, lower-cased e-mail, enrolment date = today, status Active) → `AddAsync` + `SaveAsync` (`INSERT INTO dn_students`; `StudentDbContext.SaveChangesAsync` fills `CreatedAt/UpdatedAt`) → response 201 with `Location: /api/students/{id}`. Redis: nothing yet (cache is filled on first read).

### 6.3.7 `GET /api/students`
Roles Admin, Staff. `StudentsController.Search` → `PageRequest.Create(page, size, sort, "StudentId,asc", Sortable)` (`B/Common/Paging/Paging.cs`: size capped at 100, sort column from a whitelist, else `ArgumentException` ⇒ 400) → `StudentAppService.SearchAsync` → `StudentRepository.SearchAsync`: builds a `WHERE` from `search` (name/e-mail contains), `status`, `gender`; counts, then `OrderByName` + `ThenBy(StudentId)` + `Skip/Take` → `PagedResult<StudentResponse>`. No cache (lists are hard to invalidate).

### 6.3.8 `GET /api/students/{id}`
Roles Admin, Staff, Service, Student. `StudentsController.Get` calls `RequireSelfOrStaff(id)` (a Student whose `studentId` claim differs ⇒ `ForbiddenException` ⇒ 403) → `StudentAppService.GetAsync` → `ICacheService.GetOrSetAsync("student:{id}", 10 min, loader)`: **hit** ⇒ Redis JSON returned, no SQL; **miss** ⇒ `StudentRepository.FindAsync` → DTO → stored in Redis; not found ⇒ 404. Redis key: `sms:student:{id}`.

### 6.3.9 `GET /api/students/{id}/eligibility`
Roles Admin, Staff, Service (used by Enrollment Service). `StudentAppService.EligibilityAsync` → `GetAsync` (cache path above) → `EligibilityResponse{studentId, eligible = status is Active, reason}`.

### 6.3.10 `PUT /api/students/{id}`
Admin, Staff, or the student themselves. `StudentsController.Update`: `RequireSelfOrStaff`; a non-staff caller sending `status` ⇒ `ForbiddenException` ⇒ 403 → `StudentAppService.UpdateAsync`: find (404) → e-mail uniqueness against *other* students (409) → `Apply` → `SaveAsync` (`UPDATE dn_students`) → **cache updated** with the new DTO (`SetAsync`).

### 6.3.11 `PATCH /api/students/{id}/status`
Admin, Staff. `UpdateStatusAsync`: find → set status → save → cache updated. This is what makes a student ineligible for enrolment.

### 6.3.12 `DELETE /api/students/{id}`
Admin. `DeleteAsync`: find (404) → `Remove` + `SaveAsync` → `DELETE FROM dn_students`; the database foreign keys `ON DELETE CASCADE` remove the linked `dn_users` row and its `dn_refresh_tokens` → cache key **evicted**. Enrolments in EnrollmentDB are *not* touched (no cross-database relation).

## 6.4 Course Service endpoints

### 6.4.1 Categories — `C/Controllers/CategoriesController.cs` → `C/Services/CategoryAppService.cs` → `ICategoryRepository`
| Endpoint | Flow beyond Prefix P | Table |
|---|---|---|
| `POST /api/courses/categories` | `CreateAsync`: `NameExistsAsync` (409) → insert | `dn_course_categories` |
| `GET /api/courses/categories` | `ListAsync`: ordered by name, `AsNoTracking` | same |
| `PUT /api/courses/categories/{id}` | `UpdateAsync`: find (404), name clash check (409), save | same |
| `DELETE /api/courses/categories/{id}` | `DeleteAsync`: find (404), `CourseRepository.CategoryInUseAsync` (409), remove | `dn_courses` (read) |

### 6.4.2 `POST /api/courses`
`C/Controllers/CoursesController.cs` `Create` → `C/Services/CourseAppService.cs` `CreateAsync`: `CodeExistsAsync` (409) → `RequireCategory` (unknown id ⇒ `BusinessRuleException` ⇒ 422) → new `Course` with **`AvailableSeats = TotalSeats`** → `INSERT INTO dn_courses` (the DB `CHECK` guards the seat range) → re-read with the category name → 201.

### 6.4.3 `GET /api/courses`
`CoursesController.Search` → `CourseAppService.SearchAsync` → `CourseRepository.SearchAsync` (filters: search in name/code/description, category, status, fee range, `availableOnly`; whitelisted sort; paging). Not cached.

### 6.4.4 `GET /api/courses/{id}` and `/availability`
`CourseAppService.GetAsync` / `AvailabilityAsync` use `GetOrSetAsync` with keys `course:{id}` (10 min) and `course-availability:{id}` (1 min); miss ⇒ `FindReadOnlyAsync` (`AsNoTracking` + category include). Availability is true only when status Active **and** seats > 0.

### 6.4.5 `PUT /api/courses/{id}`
`UpdateAsync`: find (404) → duplicate code (409) → category check → apply fields (**never** seat counters: they have `AfterSaveBehavior.Ignore`) → `Version++` (concurrency token; a concurrent writer makes the save fail ⇒ 409) → `SaveAsync`. **If `totalSeats` changed:** `CourseRepository.ChangeCapacityAsync` runs raw SQL `UPDATE dn_courses SET AvailableSeats = AvailableSeats + (new - TotalSeats), TotalSeats = new ... WHERE ... AvailableSeats + (new - TotalSeats) >= 0` (assignments are ordered because MySQL evaluates `SET` left to right); 0 rows ⇒ `BusinessRuleException` "below the number of seats already reserved" ⇒ 422. Then both cache keys are evicted.

### 6.4.6 `PATCH /api/courses/{id}/status`, `DELETE /api/courses/{id}`
Status: find, set, `Version++`, save, evict caches. Delete (Admin): remove + save (a foreign key from `dn_seat_reservations` ⇒ `DbUpdateException` ⇒ 409 if reservations exist), evict caches.

### 6.4.7 `POST /api/courses/{id}/seats/reserve` (called by Enrollment, role Service)
`CoursesController.Reserve` → `C/Services/SeatService.cs` `ReserveAsync(courseId, enrollmentId)` inside `db.InTransactionAsync`:
1. `FindReadOnlyAsync` course (404).
2. `FindReservationAsync(enrollmentId)`: exists ⇒ **idempotent replay** (same course, `Reserved` ⇒ `SeatResponse.Replayed = true`, no seat change; `Released` ⇒ 409; other course ⇒ 409).
3. `TryReserveSeatAsync` = `ExecuteUpdateAsync` ⇒ `UPDATE dn_courses SET AvailableSeats = AvailableSeats - 1, Version = Version + 1, ... WHERE CourseId = @id AND AvailableSeats > 0 AND Status = 'Active'`. 0 rows ⇒ `ConflictException` ("No seats available" / "not active") ⇒ 409 and the transaction rolls back.
4. Insert `dn_seat_reservations` (unique `EnrollmentId`), `SaveAsync`, re-read the course, commit.
5. **After commit:** evict `course:{id}` and `course-availability:{id}`; if seats left ≤ threshold, publish `LowCourseAvailability` through `IEventPublisher` (best effort, a failure is only logged).
Response `SeatResponse{courseId, enrollmentId, reservationStatus, availableSeats, replayed}`.

### 6.4.8 `POST /api/courses/{id}/seats/release`
`SeatService.ReleaseAsync`: unknown or already released reservation ⇒ successful no-op (`Replayed = true`); else `TryReleaseSeatAsync` (`AvailableSeats + 1` only while `< TotalSeats`), reservation `Released`, commit, evict caches.

## 6.5 Enrollment Service endpoints
### 6.5.1 `POST /api/enrollments` — the saga
Prefix P → `E/Controllers/EnrollmentsController.cs` `Enroll`: `RequireSelfOrStaff(studentId)` (a Student enrolling someone else ⇒ 403) → idempotency key = header value or a new GUID (> 64 chars ⇒ 400) → `E/Commands/Commands.cs` `CreateEnrollmentCommandHandler.HandleAsync`:
1. If the key was never seen **and** an enrolment for the same student+course is `Pending`/`Confirmed` ⇒ `ConflictException` ⇒ 409.
2. `E/Saga/EnrollmentSagaOrchestrator.cs` `StartAsync`: existing saga with this key ⇒ return it (replay); else insert `dn_saga_instances` (unique key; a lost race returns the winner's row) → `RunAsync`.
3. `RunAsync` loops `StepAsync` by state: **ValidateStudent** (`E/Clients/Clients.cs` `StudentClient.EligibilityAsync` then `GetAsync`) → **ValidateCourse** (`CourseClient.GetAsync`, `AvailabilityAsync`) → **CreatePendingEnrollment** (one transaction: insert `Pending` enrolment — unique generated `ActiveKey` — and `EnrollmentEventRecorder.Record(EnrollmentRequested)` ⇒ a `dn_outbox_messages` row; saga state saved) → **ReserveSeat** (`CourseClient.ReserveSeatAsync` ⇒ endpoint 24) → **Confirm** (one transaction: status `Confirmed` + outbox `EnrollmentConfirmed` + saga `Completed`). Any failure ⇒ `Fail` ⇒ **Compensate** (release the seat remotely — idempotent — then one transaction: enrolment `Rejected` + outbox `EnrollmentRejected` + saga `Rejected`). If Course Service cannot be reached during compensation ⇒ `SagaPausedException`; the saga stays persisted for `SagaRecoveryJob`.
4. Each remote call goes through the resilience pipeline (section 8.7) with the service JWT and correlation id added by `ServiceAuthHandler`.
5. Result mapping: `Completed` ⇒ 201 `Confirmed`; `Rejected` ⇒ **422** with the reason in `message`; anything else ⇒ **202** `InProgress`.
Tables/messages: `dn_saga_instances`, `dn_enrollments`, `dn_outbox_messages` written; HTTP reads/writes in Student/Course (Redis keys `student:{id}`, `course:{id}`, `course-availability:{id}`, seats table); later the outbox publisher sends `enrollment.requested` and `enrollment.confirmed` (or `rejected`) to RabbitMQ.

### 6.5.2 `POST /api/enrollments/{id}/cancel`
`EnrollmentsController.Cancel`: loads the enrolment through `EnrollmentQueryHandlers` (404) → `RequireSelfOrStaff` → `CancelEnrollmentCommandHandler.HandleAsync`: status `Pending` ⇒ 409 ("still being processed"); not `Confirmed` ⇒ 422; **first** `CourseClient.ReleaseSeatAsync` (remote; 404/409 ignored; Course down ⇒ `ServiceUnavailableException` ⇒ 503 and **nothing changed**, the caller can retry); **then** one local transaction: `Enrollment.TransitionTo(Cancelled)`, remarks, outbox `EnrollmentCancelled`. 200 with status `Cancelled`. The generated `ActiveKey` becomes NULL so the student may enrol again.

### 6.5.3 `PUT /api/enrollments/{id}`
Admin, Staff. `UpdateEnrollmentCommandHandler.HandleAsync`: find (404), set **remarks only** (status belongs to the saga/cancel), save.

### 6.5.4 Queries (`GET /{id}`, `GET /`, `/student/{studentId}`, `/course/{courseId}`)
All four use `E/Queries/Queries.cs` `EnrollmentQueryHandlers.HandleAsync(...)` overloads with query records (`GetEnrollmentQuery`, `SearchEnrollmentsQuery`, `StudentEnrollmentHistoryQuery`, `CourseEnrollmentsQuery`): `AsNoTracking`, filters (student, course, status, `from`/`to` dates — `to` inclusive), whitelisted sort (default `EnrollmentId,desc`), paging. They never call other services and never change data. `Get`/`History` apply `RequireSelfOrStaff` (a Student sees only their own).

## 6.6 Notification Service endpoints
Notifications are **never created by an API call**; they appear when RabbitMQ events are consumed (section 9.4). `N/Controllers/NotificationsController.cs` → `N/Services/NotificationQueryService.cs`:
| Endpoint | Flow beyond Prefix P |
|---|---|
| `GET /api/notifications` | `SearchAsync(studentId, status, type, page, size)` → EF query, newest first, size ≤ 100 |
| `GET /api/notifications/{id}` | `GetAsync` (404) |
| `GET /api/notifications/student/{studentId}` | ownership check (`ForbiddenException` for another student) → `SearchAsync` filtered by student |
| `POST /api/notifications/{id}/retry` | `RetryAsync`: only `Failed` (else `BusinessRuleException` ⇒ 422) → `Pending`, `RetryCount = 0`, `NextAttemptAt = null`; the dispatcher picks it up within ~2 s |

## 6.7 Gateway-only behaviour
- **503 handling:** when YARP reports a forwarding error (`IForwarderErrorFeature`) before the response started, `ApiGateway/Program.cs` writes `{"status":503,"error":"Service Unavailable","message":"<cluster> is currently unavailable. Please retry shortly."}`. YARP's *passive health check* marks a destination unhealthy after transport failures and re-activates it after 10 s.
- `GET /gateway/routes` returns the route table from `IProxyConfigProvider`.

---

# 7. File-by-File Explanation (non-test files)

Each table gives the complete relative path, what the file is for, its important members and who uses it. A complete alphabetical list of every file is in section 11.4.

## 7.1 Solution and root files
| File | Responsibility | Used by |
|---|---|---|
| `StudentManagement.sln` | lists the 11 projects | `dotnet build/test` |
| `Directory.Build.props` | `net8.0`, `Nullable`, `ImplicitUsings`, `LangVersion 12.0` for all projects | MSBuild, automatically |
| `docker-compose.yml` | infrastructure containers (`rabbitmq`, `redis`, `jaeger`, `prometheus`, `grafana`) and, under profile `apps`, the five app containers with health checks, `depends_on: service_healthy`, volumes and the `sms-net` network | `docker compose` |
| `.env.example` | template of the compose variables (copy to `.env`, which is git-ignored and was not read) | `docker compose` |
| `.dockerignore`, `.gitignore` | keep `bin/ obj/ logs/ .env` out of images/commits | Docker, git |
| `README.md` | overview, endpoints, checklist | humans |

## 7.2 BuildingBlocks/Common (shared infrastructure)
Base path `BuildingBlocks/Common/`
| File | Responsibility and key members | Used by |
|---|---|---|
| `Common.csproj` | library; `FrameworkReference Microsoft.AspNetCore.App`; JwtBearer, Redis cache, Swashbuckle, Serilog, EF Core, HealthChecks packages | every program |
| `Security/JwtOptions.cs` | `JwtOptions` bound from section `Jwt`: `Secret`, `Issuer`, `Audience`, `AccessTokenMinutes` (15), `RefreshTokenDays` (7) | `AuthExtensions`, `JwtTokenService` |
| `Security/JwtTokenService.cs` | `CreateAccessToken`, `CreateServiceToken` (role `Service`, 5 min), `ValidationParameters` (static, shared by gateway and services), `AccessTtl`, `RefreshTtl`; constructor throws if the secret has < 32 bytes | `AuthService`, `ServiceAuthHandler`, `AddSmsJwtAuth` |
| `Security/AuthExtensions.cs` | `AddSmsJwtAuth` (bearer config, `MapInboundClaims = false`, JSON 401/403 events), `StudentId()` and `IsStaffOrAdmin()` helpers on `ClaimsPrincipal` | all `Program.cs`, controllers |
| `Security/Roles.cs` | role-name constants and combined strings (`AdminOrStaff`, `AdminStaffService`, `AdminOrService`, `AllUsers`) used in `[Authorize(Roles = ...)]` | controllers |
| `Errors/Exceptions.cs` | `NotFoundException` (404), `ConflictException` (409), `BusinessRuleException` (422), `UnauthorizedAppException` (401), `ForbiddenException` (403), `ServiceUnavailableException` (503) | services, handler |
| `Errors/ApiError.cs` | `ApiError` record (`Timestamp, Status, Error, Message, Path, FieldErrors?, CorrelationId?`) and `ApiErrorWriter.Write` | handler, JWT events, gateway |
| `Errors/GlobalExceptionHandler.cs` | `IExceptionHandler.TryHandleAsync`: maps exception types to status codes, logs (500 as Error with stack, others Warning) | `UseExceptionHandler` |
| `Web/CorrelationIdMiddleware.cs` | reads/creates `X-Correlation-Id`, writes it to request + response headers, Serilog `LogContext`, trace tag; `Current(ctx)` helper | all programs |
| `Paging/Paging.cs` | `PagedResult<T>`, `PageRequest.Create` (size cap, sort whitelist), `OrderByName` (builds an expression tree so EF translates the dynamic sort to SQL) | repositories, handlers |
| `Caching/CacheService.cs` | `ICacheService` / `RedisCacheService`: `GetAsync`, `SetAsync`, `RemoveAsync`, `GetOrSetAsync` (cache-aside; errors are logged and swallowed; enums as strings) | Student, Course services |
| `DbContextExtensions.cs` | `InTransactionAsync` (transaction inside the EF execution strategy) | Course, Enrollment, Notification |
| `ServiceCollectionExtensions.cs` | `AddSmsWebDefaults` (exception handler, Swagger with Bearer), `AddSmsRedis` (+ `RedisHealthCheck`), `UseSmsWebDefaults`, `MapSmsHealth` (`/health/live`, `/health/ready`, `/health`), `HealthWriter`, `AddSmsControllers` (string enums + 400 error shape) | all service `Program.cs` |

## 7.3 BuildingBlocks/EventContracts, Messaging, Observability
| File | Responsibility | Used by |
|---|---|---|
| `BuildingBlocks/EventContracts/EventContracts.csproj` | dependency-free library | Messaging, services |
| `BuildingBlocks/EventContracts/Events.cs` | records `EnrollmentEvent`, `LowCourseAvailabilityEvent`; `EventTypes` (type names + `RoutingKey(type)`); `Topology` (exchange `sms.events`, DLX `sms.events.dlx`, queue names, bindings, `DeadLetterQueue(queue)`) | Enrollment, Course, Notification |
| `BuildingBlocks/Messaging/Messaging.csproj` | `RabbitMQ.Client` 6.8.1 + EventContracts | Course, Enrollment, Notification |
| `BuildingBlocks/Messaging/RabbitMq.cs` | `RabbitMqOptions`; `RabbitMqConnection` (one auto-recovering connection); `MessagingTelemetry`; `RabbitMqTopology.Declare` (idempotent exchanges/queues/DLQs); `IEventPublisher` + `RabbitMqEventPublisher.Publish` (persistent, confirms, `traceparent` header); abstract `RabbitMqConsumer` (manual ack, retry with back-off, nack to dead-letter, reconnect loop); `RabbitMqHealthCheck`; `AddSmsRabbitMq` | services |
| `BuildingBlocks/Observability/Observability.csproj` | Serilog + OpenTelemetry packages | every program |
| `BuildingBlocks/Observability/ObservabilityExtensions.cs` | `AddSmsObservability` (Serilog console template `[{Service},{TraceId},{CorrelationId}]`; tracing with ASP.NET Core + HttpClient + extra sources; OTLP exporter when configured; metrics with Prometheus exporter) and `UseSmsObservability` (request logging, `/metrics`) | every `Program.cs` |

## 7.4 ApiGateway
Base path `ApiGateway/`
| File | Responsibility |
|---|---|
| `ApiGateway.csproj` | `Yarp.ReverseProxy` 2.2.0 + Common + Observability |
| `Program.cs` | JWT auth + policies `authenticated`/`public`; CORS; YARP `LoadFromConfig`; Swagger UI listing the four services; health endpoints; `GET /gateway/routes`; proxy pipeline step converting forwarder errors into 503 JSON; passive health checks |
| `appsettings.json` | `Urls`, `Jwt`, `Cors`, `OpenTelemetry`, `ReverseProxy` routes and clusters (section 4.3) |

## 7.5 Services/StudentService
Base path `Services/StudentService/`
| File | Responsibility and key members | Used by |
|---|---|---|
| `StudentService.csproj` | EF Core design, Pomelo, Identity EF, HealthChecks EF; refs Common/Observability | build |
| `Program.cs` | composition root (section 3.1) | runtime |
| `appsettings.json` | config (sections 4.2–4.3) | runtime |
| `Entities/Student.cs` | `Student` (StudentId, names, Email, PhoneNumber, DateOfBirth, Gender, Address, EnrollmentDate, Status, timestamps); enums `Gender`, `StudentStatus` | repository, service |
| `Entities/Identity.cs` | `AppUser : IdentityUser<long>` (+`StudentId`, `CreatedAt`), `AppRole`, `RefreshToken` | `AuthService`, DbContext |
| `Data/StudentDbContext.cs` | `IdentityDbContext<AppUser, AppRole, long>`; renames Identity tables to `dn_users`, `dn_roles`, `dn_user_roles`, `dn_user_claims`, `dn_user_logins`, `dn_role_claims`, `dn_user_tokens`; `SaveChangesAsync` fills timestamps | repositories, services |
| `Data/Configurations/EntityConfigurations.cs` | Fluent API: `dn_students` (unique e-mail, indexes), `AppUserConfiguration` (FK to student, cascade), `RefreshTokenConfiguration` (unique `TokenHash`, cascade) | `ApplyConfigurationsFromAssembly` |
| `Data/DesignTimeFactory.cs` | DbContext factory for `dotnet ef` | EF tooling |
| `Data/Migrations/*` | generated `InitialCreate` (+ Designer, model snapshot) | `MigrateAsync` |
| `Dtos/StudentDtos.cs`, `Dtos/AuthDtos.cs` | request/response records with validation attributes (`StudentRequest`, `StudentResponse`, `StatusUpdateRequest`, `EligibilityResponse`, `RegisterRequest`, `LoginRequest`, `RefreshRequest`, `TokenResponse`, `UserResponse`) | controllers, services |
| `Validation/PhoneNumberAttribute.cs` | `[OptionalPhone]` custom validation (7–15 digits) | DTOs |
| `Repositories/StudentRepository.cs` | `IStudentRepository`/`StudentRepository`: `FindAsync`, `EmailExistsAsync`, `AddAsync`, `Remove`, `SaveAsync`, `SearchAsync` | `StudentAppService` |
| `Services/StudentAppService.cs` | `IStudentAppService`/`StudentAppService`: create/get (cached)/search/update/status/delete/eligibility; cache keys `student:{id}`; `ToResponse` mapper | controller, `AuthService` |
| `Services/AuthService.cs` | register/login/refresh/logout/me, `IssueAsync`, `Hash` (SHA-256) | `AuthController` |
| `Services/AdminSeeder.cs` | creates roles and the first Admin at startup | host |
| `Controllers/StudentsController.cs`, `Controllers/AuthController.cs` | HTTP endpoints 1–12 of the catalogue | clients via gateway |

## 7.6 Services/CourseService
Base path `Services/CourseService/`
| File | Responsibility and key members | Used by |
|---|---|---|
| `CourseService.csproj`, `Program.cs`, `appsettings.json` | as above; adds RabbitMQ publisher and Redis | runtime |
| `Entities/Entities.cs` | `CourseCategory`, `Course` (TotalSeats, AvailableSeats, `Version` concurrency token, Category navigation), `SeatReservation`, enums `CourseStatus`, `ReservationStatus` | everything |
| `Data/CourseDbContext.cs`, `Data/Configurations/EntityConfigurations.cs`, `Data/DesignTimeFactory.cs`, `Data/Migrations/*` | mapping incl. CHECK `chk_dn_courses_seats`, seat columns `AfterSaveBehavior.Ignore`, unique code and `EnrollmentId` | EF |
| `Dtos/Dtos.cs` | `CategoryRequest/Response`, `CourseRequest/Response`, `CourseAvailabilityResponse`, `StatusRequest`, `SeatRequest`, `SeatResponse` | controllers, services |
| `Repositories/CourseRepository.cs` | `ICourseRepository` (search; **`TryReserveSeatAsync`, `TryReleaseSeatAsync`** via `ExecuteUpdateAsync`; **`ChangeCapacityAsync`** raw SQL; reservations lookup) and `ICategoryRepository` | services |
| `Services/CourseAppService.cs` | course CRUD, cached reads, cache eviction | `CoursesController` |
| `Services/CategoryAppService.cs` | category CRUD with duplicate/in-use rules | `CategoriesController` |
| `Services/SeatService.cs` | `ReserveAsync`, `ReleaseAsync`, low-availability publishing | `CoursesController` |
| `Controllers/CoursesController.cs`, `Controllers/CategoriesController.cs` | endpoints 13–25 | clients, Enrollment |

## 7.7 Services/EnrollmentService
Base path `Services/EnrollmentService/`
| File | Responsibility and key members | Used by |
|---|---|---|
| `EnrollmentService.csproj`, `Program.cs`, `appsettings.json` | adds `Microsoft.Extensions.Http.Resilience`; registers clients, handlers, background jobs | runtime |
| `Entities/Entities.cs` | `Enrollment` (+`TransitionTo`, state machine via `EnrollmentStatusExtensions.AllowedNext`), `EnrollmentStatus`, `SagaInstance`, `SagaState`, `OutboxMessage`, `OutboxStatus` | everything |
| `Data/EnrollmentDbContext.cs`, `Data/Configurations/EntityConfigurations.cs`, `Data/DesignTimeFactory.cs`, `Data/Migrations/*` | mapping incl. generated column `ActiveKey` + unique index, unique idempotency keys, outbox index | EF |
| `Dtos/Dtos.cs` | `EnrollmentRequest`, `CancelRequest`, `EnrollmentUpdateRequest`, `EnrollmentResponse.From`, `EnrollmentOutcome` | controller, handlers |
| `Clients/Clients.cs` | consumer-side DTOs (`StudentInfo`, `CourseInfo`, ...), `Remote*Exception`, `RemoteClientBase.SendAsync` (status → exception), `StudentClient`, `CourseClient`, `ServiceAuthHandler`, `SagaCorrelation` | saga, cancel handler |
| `Clients/ClientRegistration.cs` | `AddRemoteClients`: typed HttpClients + service JWT handler + resilience pipeline | `Program.cs` |
| `Commands/Commands.cs` | `CreateEnrollmentCommand/Handler`, `CancelEnrollmentCommand/Handler`, `UpdateEnrollmentCommand/Handler` | controller |
| `Queries/Queries.cs` | query records + `EnrollmentQueryHandlers` (+ `Sortable` whitelist) | controller |
| `Saga/EnrollmentSagaOrchestrator.cs` | `StartAsync`, `RunAsync`, `StepAsync`, step methods, `Fail`, `Compensate`; `SagaPausedException`; `SagaRecoveryJob` | create handler, host |
| `EventHandlers/EnrollmentEventRecorder.cs` | `Record(eventType, enrollment, reason, correlationId)` adds an outbox row (throws if no transaction) | saga, cancel handler |
| `Outbox/OutboxPublisher.cs` | background publisher; `PublishBatchAsync`; metrics meter `enrollment-service` | host |
| `Controllers/EnrollmentsController.cs` | endpoints 26–32 | clients |

## 7.8 Services/NotificationService
Base path `Services/NotificationService/`
| File | Responsibility and key members | Used by |
|---|---|---|
| `NotificationService.csproj`, `Program.cs`, `appsettings.json` | RabbitMQ consumers + dispatcher registered as hosted services | runtime |
| `Entities/Entities.cs` | `Notification`, `InboxMessage`, enums `NotificationType`, `NotificationStatus` | everything |
| `Data/NotificationDbContext.cs`, `Data/Configurations/EntityConfigurations.cs`, `Data/DesignTimeFactory.cs`, `Data/Migrations/*` | mapping; unique (EnrollmentId, NotificationType) and (MessageId, ConsumerGroup) | EF |
| `Dtos/NotificationResponse.cs` | response record | query service |
| `Consumers/Consumers.cs` | `EnrollmentEventsConsumer`, `CourseEventsConsumer` (extend `RabbitMqConsumer`) | host |
| `Services/NotificationIngestService.cs` | `HandleEnrollmentEventAsync`, `HandleLowAvailabilityAsync`, private `Idempotent` (inbox pattern), `Message` text builder | consumers |
| `Services/NotificationQueryService.cs` | `SearchAsync`, `GetAsync`, `RetryAsync` | controller |
| `Processing/Processing.cs` | `EmailSimulator`, `NotificationProcessor.ProcessAsync` (retry/back-off), `NotificationDispatcher` (background loop) | host |
| `Controllers/NotificationsController.cs` | endpoints 33–36 | clients |

## 7.9 Generated EF Core migration files (group explanation)
Each service has `Data/Migrations/<timestamp>_InitialCreate.cs`, `<timestamp>_InitialCreate.Designer.cs` and `<Context>ModelSnapshot.cs`. They are **generated by `dotnet ef migrations add`**: `Up()` contains `CREATE TABLE`/`CREATE INDEX` calls (never DROP of existing tables), `Down()` the reverse, the Designer file stores the model at that point in time, and the snapshot is the current model used to compute the next migration. Timestamps: Student `20261110130842`, Course `20261110131336`, Notification `20261110131534`, Enrollment `20261110133040`.

## 7.10 Docker, Kubernetes, Monitoring, scripts
| File | Responsibility |
|---|---|
| `Docker/Dockerfile` | multi-stage build (`sdk:8.0` publishes `$PROJECT`, `aspnet:8.0` runs it as non-root user `app`); build args `PROJECT`, `ASSEMBLY`; sets `ASPNETCORE_URLS=http://+:8080`; `HEALTHCHECK` |
| `Docker/healthcheck.sh` | bash `/dev/tcp` request to `/health/live` (the runtime image has no curl) |
| `Kubernetes/00-namespace.yaml` … `40-api-gateway.yaml`, `kustomization.yaml` | namespace `sms-dn`; ConfigMap `sms-config`; ExternalName service `mysql-host`; secret **template**; Redis (Deployment + PVC); RabbitMQ (StatefulSet + PVC); five Deployments + Services with liveness `/health/live`, readiness `/health/ready`, resource requests/limits; the gateway Service is `LoadBalancer` with 2 replicas |
| `Monitoring/Prometheus/prometheus.yml` | scrape `/metrics` of the five programs (container DNS names and `host.docker.internal`) |
| `Monitoring/Prometheus/prometheus-host.yml` | variant with `localhost` targets for a host-network Prometheus |
| `Monitoring/Grafana/provisioning/datasources/prometheus.yml`, `.../dashboards/dashboards.yml`, `Monitoring/Grafana/dashboards/sms-overview.json` | auto-registered Prometheus datasource, dashboard provider, and the overview dashboard (requests/s, p95, 5xx, outbox, CPU, heap) |
| `scripts/start-local.sh`, `stop-local.sh`, `e2e.py`, `failure-scenarios.py` | section 5 |

---

# 8. Layers, Patterns and Architecture

## 8.1 The layers
| Layer | What it is here | Example |
|---|---|---|
| Controller | receives HTTP, checks role/ownership, calls exactly one service/handler | `StudentsController.Create` |
| Application service | business rules + cache + transaction boundaries | `StudentAppService`, `CourseAppService`, `SeatService` |
| Command/query handler | Enrollment's equivalent of services (CQRS) | `CreateEnrollmentCommandHandler` |
| Repository | database queries | `StudentRepository`, `CourseRepository` |
| Entity | class mapped to a table | `Student`, `Course`, `Enrollment` |
| DTO | request/response shape (C# `record`s) | `StudentRequest`, `EnrollmentOutcome` |
| Mapping | hand-written (`ToResponse`, `Apply`, `EnrollmentResponse.From`) — no AutoMapper | `StudentAppService.ToResponse` |
| Validation | data-annotation attributes + custom `[OptionalPhone]` + business rules in services + DB constraints | `StudentRequest`, `Enrollment.TransitionTo` |
| Exception handling | custom exceptions + one `GlobalExceptionHandler` | section 10 |
| Integration/client | typed HttpClients, RabbitMQ publisher/consumer | `StudentClient`, `RabbitMqEventPublisher` |
**Interface vs implementation:** repositories and app services have interfaces (`IStudentRepository`/`StudentRepository`) so tests can replace them; a few classes are registered directly (`CategoryAppService`, `EnrollmentQueryHandlers`, the command handlers) because there is only one implementation.

## 8.2 EF Core features actually used
Fluent API configuration; migrations; `AsNoTracking` reads; `ExecuteUpdateAsync` (atomic seat updates); **raw SQL** (`ExecuteSqlInterpolatedAsync` for capacity change; `FromSqlInterpolated` with `FOR UPDATE SKIP LOCKED` for the outbox); **concurrency tokens** (`Version` on `Course`, `Enrollment`, `SagaInstance`, `Notification`); a **stored generated column** (`Enrollment.ActiveKey`); `HasCheckConstraint`; value conversions of enums to strings; `HasComputedColumnSql`; `AfterSaveBehavior.Ignore` for seat counters; transactions via `InTransactionAsync`. **Lazy loading is not used** (no proxies); the only navigation is `Course.Category`, loaded with `Include`.

## 8.3 Identity + JWT + roles
Student Service stores users with ASP.NET Core Identity (PBKDF2 password hashes, lockout 5 attempts / 5 min, unique e-mail). Access tokens are HS256 JWTs created by `JwtTokenService`; refresh tokens are random strings stored only as SHA-256 hashes and rotated on use. Roles: `Admin`, `Staff`, `Student` (+ internal `Service`). The **same secret** validates tokens in the gateway and all services. **Not implemented:** access-token revocation, MFA, external identity provider, HTTPS in the local setup.

## 8.4 YARP gateway
Reverse proxy from configuration: routes (path match + order + policy), clusters (destination, RoundRobin, passive health), transforms for `docs-*`. Centralised JWT validation; CORS; correlation id; 503 JSON fallback. **Not implemented:** service discovery (URLs are configuration), rate limiting, response caching, multiple destinations per cluster in the shipped configuration (so load balancing is not actually exercised).

## 8.5 RabbitMQ
Exchange `sms.events` (topic, durable); queues `notification.enrollment-events` (`enrollment.*`) and `notification.course-events` (`course.*`), each with a dead-letter queue `<queue>.dlq` reached through `sms.events.dlx`. Publisher: persistent messages, publisher confirms (wait up to 5 s). Consumer: manual acknowledgement, prefetch 10, up to 4 in-process attempts with exponential back-off (1 s, 2 s, 4 s), then `BasicNack(requeue:false)` ⇒ DLQ. Topology is declared by publishers **and** consumers, so no message is published into a queue that does not exist yet.

## 8.6 Saga, outbox, inbox, idempotency
- **Saga** (`EnrollmentSagaOrchestrator`): states `Started → StudentValidated → CourseValidated → PendingCreated → SeatReserved → Completed`, failure ⇒ `Compensating → Rejected`; state saved after every step; remote calls outside DB transactions; `SagaRecoveryJob` resumes stuck sagas. It is an **orchestration** saga (one coordinator); **choreography** is not used.
- **Outbox** (`EnrollmentEventRecorder` + `OutboxPublisher`): event row in the same transaction as the business change; polled every second with `SELECT ... FOR UPDATE SKIP LOCKED`; published rows marked `Published`; failures retried with back-off (`min(60, 2^attempts)` s) keeping per-enrolment order; at-least-once delivery.
- **Inbox** (`NotificationIngestService.Idempotent`): `dn_inbox_messages` unique (`MessageId`, `ConsumerGroup`) + notification written in the same transaction.
- **Idempotency keys:** `Idempotency-Key` header ↔ unique `dn_saga_instances.IdempotencyKey`; seat operations idempotent per `EnrollmentId`; unique (`EnrollmentId`, `NotificationType`) for notifications; generated `ActiveKey` for duplicate active enrolments.

## 8.7 Resilience for HTTP calls (Enrollment → Student/Course)
Configured in `E/Clients/ClientRegistration.cs` with `AddResilienceHandler`, outermost to innermost: **total timeout** (12 s) → **retry** (3 retries, 300 ms base, exponential with jitter; only 5xx, 408, 429 and network errors; 404/409/other 4xx are *business answers*, never retried) → **circuit breaker** (sampling 30 s, minimum 5 calls, 50 % failure ratio, open 10 s) → **per-attempt timeout** (4 s). `RemoteClientBase.SendAsync` converts `BrokenCircuitException`, `TimeoutRejectedException`, `HttpRequestException` into `ServiceUnavailableException` and status codes into `RemoteNotFound/Conflict/Rejected` exceptions.

## 8.8 CQRS, cache, background jobs, observability
- **CQRS (light):** commands and queries are separate record types with separate handlers in Enrollment; same database; **not implemented:** a separate read model or event sourcing.
- **Redis cache-aside:** keys `sms:student:{id}` (10 min), `sms:course:{id}` (10 min), `sms:course-availability:{id}` (1 min); updated on student change, evicted on delete / course changes; Redis outage ⇒ logged and the database answers.
- **Hosted services:** section 3.5. All loops use `PeriodicTimer`, a fresh DI scope per unit of work, and catch exceptions so one failure never stops the loop.
- **Serilog + correlation id:** log template `[{Service},{TraceId},{CorrelationId}]`. **OpenTelemetry:** traces over OTLP to Jaeger (ASP.NET Core, HttpClient, and a `Messaging` source that carries `traceparent` through RabbitMQ), metrics at `/metrics` for Prometheus (ASP.NET Core, HttpClient, runtime, the `enrollment-service` meter: `outbox_events_published`, `outbox_events_failed`, `outbox_events_pending`). **Health:** liveness vs readiness (MySQL via EF `CanConnect`, RabbitMQ channel, Redis `PING`).
- **Docker/Kubernetes:** one parameterised Dockerfile; compose profile `apps`; Kubernetes manifests (not applied).
- **Background concepts not implemented:** event sourcing, separate read database, service discovery, API versioning, rate limiting, distributed locks.

---

# 9. Code Tracing Examples

## 9.1 Create a student through the gateway
Input:
```http
POST http://localhost:8080/api/students
Authorization: Bearer <Admin access token>
Content-Type: application/json

{"firstName":"Asha","lastName":"Rao","email":"Asha.Rao@Example.com","phoneNumber":"+91 9876543210","gender":"Female"}
```
| Step | File → member | What happens |
|---|---|---|
| 1 | gateway `ApiGateway/Program.cs` | `CorrelationIdMiddleware` creates an id; `UseAuthentication` validates the JWT; route `students-root` (policy `authenticated`) matches |
| 2 | YARP | forwards to `http://localhost:8081/api/students` with the same headers |
| 3 | `S/Program.cs` pipeline | correlation id, exception handler, request logging, JWT validated again, `[Authorize(Roles="Admin,Staff")]` passes |
| 4 | model binding | JSON → `StudentRequest`; annotations pass (`[OptionalPhone]` accepts the number) |
| 5 | `S/Controllers/StudentsController.cs` `Create` | calls `service.CreateAsync(request, ct)` |
| 6 | `S/Services/StudentAppService.cs` `CreateAsync` | `repo.EmailExistsAsync("Asha.Rao@Example.com")` → `SELECT ... WHERE lower(Email) = ...` → false |
| 7 | same, `Apply` | trims names, **lower-cases the e-mail**, status Active, enrolment date today |
| 8 | `S/Repositories/StudentRepository.cs` `AddAsync` + `SaveAsync` | `INSERT INTO dn_students (...)`; MySQL assigns `StudentId`; `StudentDbContext.SaveChangesAsync` sets timestamps |
| 9 | `ToResponse` | entity → `StudentResponse` |
| 10 | controller | `Created("/api/students/1", s)` → 201 + `Location` |
| 11 | middleware unwinds | Serilog logs `HTTP POST /api/students -> 201`; the gateway returns the body and `X-Correlation-Id` |
Output (201):
```json
{"studentId":1,"firstName":"Asha","lastName":"Rao","email":"asha.rao@example.com","phoneNumber":"+91 9876543210",
 "dateOfBirth":null,"gender":"Female","address":null,"enrollmentDate":"2026-11-10","status":"Active",
 "createdAt":"2026-11-10T13:10:15.1477578Z","updatedAt":"2026-11-10T13:10:15.1477578Z"}
```

## 9.2 Log in and call a protected endpoint
1. `POST /api/auth/login {"username":"admin","password":"<secret>"}` — gateway route `auth-public` (policy `public`, no token needed) → Student `AuthController.Login` → `AuthService.LoginAsync` (lookup, lockout check, `CheckPasswordAsync`, `IssueAsync`).
2. Response 200: `{"accessToken":"<jwt>","refreshToken":"<random>","tokenType":"Bearer","expiresInSeconds":900,"username":"admin","role":"Admin","studentId":null}`.
3. Client calls `GET /api/students/1` with `Authorization: Bearer <accessToken>`. The gateway's `JwtBearer` handler validates signature, issuer, audience and expiry with `JwtTokenService.ValidationParameters`; the service validates again, builds the `ClaimsPrincipal` (roles from the `role` claim) and `StudentsController.Get` calls `RequireSelfOrStaff` (Admin ⇒ allowed) → `StudentAppService.GetAsync` → Redis `sms:student:1` (hit or miss) → 200.
4. After 15 minutes the token expires ⇒ `401`; `POST /api/auth/refresh` with the refresh token yields a **new pair** and revokes the old refresh token.

## 9.3 Enrol a student (saga, remote calls, outbox)
Input `POST /api/enrollments` + header `Idempotency-Key: demo-1`, body `{"studentId":1,"courseId":1}`, Admin token.
| Step | File → member | What happens |
|---|---|---|
| 1 | gateway | route `enrollments-root` → Enrollment (:8083) |
| 2 | `E/Controllers/EnrollmentsController.cs` `Enroll` | `RequireSelfOrStaff` passes; key `demo-1`; calls `CreateEnrollmentCommandHandler.HandleAsync` |
| 3 | `E/Commands/Commands.cs` | key unseen + no active duplicate; calls `saga.StartAsync` |
| 4 | `E/Saga/EnrollmentSagaOrchestrator.cs` `StartAsync` | inserts `dn_saga_instances` (state `Started`) |
| 5 | `ValidateStudent` | `StudentClient.EligibilityAsync(1)` → `GET http://localhost:8081/api/students/1/eligibility` with a `Service` JWT and the correlation id (resilience: timeouts/retry/breaker); then `GetAsync(1)` → name + e-mail stored in the saga; state `StudentValidated` |
| 6 | `ValidateCourse` | `CourseClient.GetAsync(1)` and `AvailabilityAsync(1)`; state `CourseValidated` |
| 7 | `CreatePendingEnrollment` | **one transaction** (`InTransactionAsync`): insert `Pending` enrolment (generated `ActiveKey` `1-1`) + `EnrollmentEventRecorder.Record("EnrollmentRequested")` ⇒ `dn_outbox_messages` row; saga `PendingCreated` |
| 8 | `ReserveSeat` | `CourseClient.ReserveSeatAsync(1, enrollmentId)` ⇒ Course `SeatService.ReserveAsync` runs the atomic `UPDATE ... AvailableSeats - 1 WHERE AvailableSeats > 0 ...`, inserts the reservation row, evicts caches; saga `SeatReserved` |
| 9 | `Confirm` | **one transaction**: enrolment `Confirmed` + outbox row `EnrollmentConfirmed` + saga `Completed` |
| 10 | handler | builds `EnrollmentOutcome("Confirmed", "Enrollment confirmed", dto)`; controller maps to **201** |
Output:
```json
{"result":"Confirmed","message":"Enrollment confirmed","enrollment":{"enrollmentId":1,"studentId":1,"courseId":1,"studentName":"Asha Rao","courseName":"Java","enrollmentDate":"2026-11-10T13:32:02.420397","enrollmentStatus":"Confirmed","remarks":null,"createdAt":"2026-11-10T13:32:02.420397","updatedAt":"2026-11-10T13:32:04.685292"}}
```
If the course is full at step 8: Course answers 409 ⇒ `RemoteConflictException` ⇒ `Fail("Seat reservation failed: no seats available")` ⇒ `Compensate` (release is a no-op, enrolment `Rejected`, outbox `EnrollmentRejected`) ⇒ **422** `{"result":"Rejected","message":"Seat reservation failed: no seats available",...}`.

## 9.4 From outbox row to RabbitMQ message to notification "sent" (asynchronous path)
1. `E/Outbox/OutboxPublisher.cs` runs every second: `PublishBatchAsync` opens a transaction and reads due rows with `... FOR UPDATE SKIP LOCKED`.
2. For each row `RabbitMqEventPublisher.Publish(routingKey, eventId, type, json, correlationId)`: persistent message, `messageId = EventId`, `traceparent` header; `WaitForConfirmsOrDie(5 s)`. On broker confirm the row becomes `Published`; on failure `Attempts++`, `NextAttemptAt` back-off, `LastError`.
3. RabbitMQ routes `enrollment.confirmed` through exchange `sms.events` to queue `notification.enrollment-events`.
4. `N/Consumers/Consumers.cs` `EnrollmentEventsConsumer` (base class `RabbitMqConsumer.OnMessage`) receives it, creates a DI scope and calls `NotificationIngestService.HandleEnrollmentEventAsync`.
5. `Idempotent(...)`: one transaction — look up `dn_inbox_messages` by (`EventId`, `notification-service`); if present ⇒ ignore; else insert the inbox row, then (for Confirmed) insert a `Pending` `dn_notifications` row with text "Hi Asha Rao, your enrollment #1 in Java is confirmed." (`EnrollmentRequested` creates only the inbox row). Success ⇒ `BasicAck`.
6. `N/Processing/Processing.cs` `NotificationDispatcher` (every 2 s) selects due `Pending` rows and calls `NotificationProcessor.ProcessAsync` per id: `EmailSimulator.Send` logs `EMAIL SENT to=...` ⇒ status `Sent`, `ProcessedAt` set. A failure ⇒ `RetryCount++`, back-off `5 s × 2^(n-1)`, `Failed` after 5 attempts or immediately for a missing recipient.
7. `GET /api/notifications/student/1` now shows `EnrollmentConfirmed` / `Sent`.
If processing throws, the base consumer retries (4 attempts), then nacks without requeue and the message lands in `notification.enrollment-events.dlq`.

## 9.5 Failed requests with exact error bodies
**Validation error** — `POST /api/students` with `{"firstName":"","lastName":"x","email":"nope","phoneNumber":"12"}`: binding fails before the action runs ⇒ **400**:
```json
{"timestamp":"2026-11-10T13:10:15.2149217+00:00","status":400,"error":"Bad Request","message":"Validation failed","path":"/api/students",
 "fieldErrors":{"email":["The Email field is not a valid e-mail address."],"firstName":["The FirstName field is required."],
 "phoneNumber":["must be a valid phone number (7-15 digits, optional leading +)"]}}
```
**Business conflict** — creating a student whose e-mail exists: `StudentAppService.CreateAsync` throws `ConflictException` ⇒ `GlobalExceptionHandler` ⇒ **409**:
```json
{"timestamp":"2026-11-10T13:10:15.1971634+00:00","status":409,"error":"Conflict","message":"A student with email 'asha.rao@example.com' already exists","path":"/api/students"}
```
**No token** — `GET /api/students` ⇒ the gateway answers **401** `{"status":401,"error":"Unauthorized","message":"Authentication required or token invalid/expired",...}`; the Student Service is never contacted.

---

# 10. Cross-Cutting Behaviour

## 10.1 Exception → HTTP mapping
`BuildingBlocks/Common/Errors/GlobalExceptionHandler.cs`:
| Exception | HTTP | Raised for |
|---|---|---|
| `NotFoundException` | 404 | unknown id |
| `ConflictException`, `DbUpdateConcurrencyException`, `DbUpdateException` (duplicate/constraint) | 409 | duplicate e-mail/code, no seats, concurrent edit |
| `BusinessRuleException` | 422 | invalid state/reference, capacity below reserved seats |
| `UnauthorizedAppException` | 401 | bad credentials / refresh token |
| `ForbiddenException` | 403 | ownership violations |
| `ServiceUnavailableException` | 503 | dependency down, circuit open, timeout |
| `BadHttpRequestException`, `JsonException`, `ArgumentException` | 400 | malformed request, unknown sort column |
| anything else | 500 | generic message; stack trace only in the log |
Model-validation errors (400 with `fieldErrors`) and JWT 401/403 are produced earlier by MVC/JWT events in the **same** `ApiError` shape: `{"timestamp","status","error","message","path","fieldErrors?","correlationId?"}`.

## 10.2 Logging and following one request
Every log line looks like `19:02:00.354 INF [enrollment-service,<traceId>,<correlationId>] Namespace.Class: message`. The correlation id is generated by the gateway (or taken from the client's `X-Correlation-Id`), forwarded to services, to Student/Course through `ServiceAuthHandler`, stored in `dn_saga_instances` / `dn_outbox_messages` and in the RabbitMQ `correlationId`. To follow a request: take `X-Correlation-Id` from the response and `grep` it in `logs/*.log`. The trace id lets you open the same request in Jaeger across all five programs, including the RabbitMQ consumer span.

## 10.3 When a dependency is down
| Down | Effect |
|---|---|
| **MySQL** | `/health/ready` unhealthy (503); requests fail with 500/503; EF retries transient errors 3 times |
| **Redis** | cache calls log a warning and the database answers (`RedisCacheService` swallows errors); `/health/ready` of Student/Course reports redis unhealthy |
| **RabbitMQ** | Enrollment keeps working: events accumulate as `Pending` in the outbox and are published after the broker returns; Course's low-seat alert is simply lost (logged); Notification's consumers retry connecting every 5 s |
| **Student/Course Service** | Enrollment's resilience pipeline retries, then trips the breaker; a validation-step outage ⇒ saga compensates ⇒ **422 Rejected** with reason; a compensation outage ⇒ saga paused (202) and resumed by `SagaRecoveryJob`; through the gateway the route answers **503** JSON |
| **Gateway** | no client can reach anything, services keep running |

---

# 11. Learning Path, Glossary and Index

## 11.1 Recommended reading order
| # | Read | Why now |
|---|---|---|
| 1 | `scripts/start-local.sh`, `scripts/stop-local.sh` | shows what the five programs are, their ports and start order in 30 lines |
| 2 | `README.md`, `StudentManagement.sln`, `Directory.Build.props` | vocabulary and project list |
| 3 | `Services/StudentService/StudentService.csproj`, then `Program.cs` | dependencies reveal capabilities; `Program.cs` is where everything is wired |
| 4 | `Services/StudentService/appsettings.json` | what is configurable and how |
| 5 | `Controllers/StudentsController.cs` | the public face: URLs, roles, DTOs |
| 6 | `Services/StudentAppService.cs`, `Repositories/StudentRepository.cs` | business rules, cache-aside, queries |
| 7 | `Entities/Student.cs`, `Dtos/StudentDtos.cs`, `Data/StudentDbContext.cs`, `Data/Configurations/EntityConfigurations.cs` | entities vs DTOs and how they map to tables |
| 8 | `Data/Migrations/*InitialCreate.cs` | the real SQL schema |
| 9 | `BuildingBlocks/Common` (`JwtTokenService`, `AuthExtensions`, `GlobalExceptionHandler`, `CorrelationIdMiddleware`), then `AuthService`, `AuthController` | security and error handling shared by all |
| 10 | Course: `SeatService`, `CourseRepository` (atomic UPDATE), migration CHECK | the central data-integrity idea |
| 11 | `ApiGateway/appsettings.json`, `ApiGateway/Program.cs` | how requests arrive |
| 12 | `BuildingBlocks/EventContracts`, `BuildingBlocks/Messaging/RabbitMq.cs` | message shapes and broker plumbing |
| 13 | Enrollment: `EnrollmentsController` → `Commands.cs` → `EnrollmentSagaOrchestrator` → `Clients/*` | the multi-service flow |
| 14 | `EnrollmentEventRecorder`, `OutboxPublisher`, `SagaRecoveryJob` | reliability patterns |
| 15 | Notification: `Consumers.cs`, `NotificationIngestService`, `Processing.cs` | the asynchronous side |
| 16 | `scripts/e2e.py` (run it), then `Documentation/` 09–17 | see everything run; deeper dives |

## 11.2 Glossary
| Term | Meaning |
|---|---|
| **ASP.NET Core** | Microsoft's web framework (Kestrel server, middleware, MVC controllers). |
| **Middleware** | a component every HTTP request passes through, in a fixed order. |
| **Dependency injection** | the framework supplies a class's dependencies via its constructor. |
| **Scoped / Singleton / Transient** | DI lifetimes: per request / once per process / every time. |
| **DbContext** | EF Core's unit of work and entry to the database. |
| **Entity** | a class mapped to a table. |
| **DTO** | data shape sent over HTTP; here C# `record`s. |
| **Migration** | generated code that creates/changes tables. |
| **Pomelo** | the MySQL provider for EF Core. |
| **Execution strategy** | EF's retry policy; user transactions must run inside it. |
| **Optimistic concurrency token** | a version column checked on update to detect conflicting edits. |
| **Generated column** | a column MySQL computes itself (`ActiveKey`). |
| **JWT** | signed token carrying identity and roles. |
| **Identity (ASP.NET Core Identity)** | user/role/password-hash library. |
| **YARP** | Microsoft's reverse-proxy library used for the gateway. |
| **Route / Cluster** | YARP: URL match rule / group of destination servers. |
| **HttpClientFactory / typed client** | managed `HttpClient` creation; a class wrapping calls to one service. |
| **Resilience pipeline** | ordered retry, circuit breaker and timeouts around a call. |
| **Circuit breaker** | stops calling a failing service for a while and fails fast. |
| **RabbitMQ / exchange / queue / routing key** | message broker; where messages are published; where they wait; the label used to route them. |
| **Dead-letter queue (DLQ)** | where messages go after repeated failure. |
| **Publisher confirm** | broker acknowledgement that it stored a published message. |
| **Saga** | a multi-service transaction as local steps plus undo actions (compensation). |
| **Outbox / Inbox** | table of events written with the business change / table of processed message ids. |
| **Idempotent** | repeating the operation has the same effect as doing it once. |
| **CQRS** | separating commands (writes) from queries (reads). |
| **Cache-aside** | read from cache, else load and store. |
| **BackgroundService** | long-running hosted job started with the app. |
| **Serilog / OpenTelemetry** | structured logging / traces and metrics standard. |
| **Prometheus / Grafana / Jaeger** | metrics store / dashboards / trace viewer. |
| **Correlation id** | one id tying together all logs of one request. |
| **Health check (live/ready)** | endpoints telling "process is up" vs "dependencies are usable". |

## 11.3 How to follow a request in the logs (summary)
Take `X-Correlation-Id` from a response, then `grep <id> logs/*.log` (gateway, services); open the trace in Jaeger by trace id.

## 11.4 Index of all non-test source files
The list below is generated from the file system (every file outside `bin/`, `obj/`, `logs/` and `Tests/`).
| # | Complete relative path | Kind |
|---|---|---|
| 1 | `.dockerignore` | Docker |
| 2 | `.env.example` | Other |
| 3 | `.gitignore` | Other |
| 4 | `ApiGateway/ApiGateway.csproj` | Build |
| 5 | `ApiGateway/Program.cs` | Program entry point |
| 6 | `ApiGateway/appsettings.json` | Configuration |
| 7 | `BuildingBlocks/Common/Caching/CacheService.cs` | Cache (shared) |
| 8 | `BuildingBlocks/Common/Common.csproj` | Build |
| 9 | `BuildingBlocks/Common/DbContextExtensions.cs` | C# source |
| 10 | `BuildingBlocks/Common/Errors/ApiError.cs` | Error handling (shared) |
| 11 | `BuildingBlocks/Common/Errors/Exceptions.cs` | Error handling (shared) |
| 12 | `BuildingBlocks/Common/Errors/GlobalExceptionHandler.cs` | Error handling (shared) |
| 13 | `BuildingBlocks/Common/Paging/Paging.cs` | Paging (shared) |
| 14 | `BuildingBlocks/Common/Security/AuthExtensions.cs` | Security (shared) |
| 15 | `BuildingBlocks/Common/Security/JwtOptions.cs` | Security (shared) |
| 16 | `BuildingBlocks/Common/Security/JwtTokenService.cs` | Security (shared) |
| 17 | `BuildingBlocks/Common/Security/Roles.cs` | Security (shared) |
| 18 | `BuildingBlocks/Common/ServiceCollectionExtensions.cs` | C# source |
| 19 | `BuildingBlocks/Common/Web/CorrelationIdMiddleware.cs` | Web middleware (shared) |
| 20 | `BuildingBlocks/EventContracts/EventContracts.csproj` | Build |
| 21 | `BuildingBlocks/EventContracts/Events.cs` | C# source |
| 22 | `BuildingBlocks/Messaging/Messaging.csproj` | Build |
| 23 | `BuildingBlocks/Messaging/RabbitMq.cs` | C# source |
| 24 | `BuildingBlocks/Observability/Observability.csproj` | Build |
| 25 | `BuildingBlocks/Observability/ObservabilityExtensions.cs` | C# source |
| 26 | `Directory.Build.props` | Build |
| 27 | `Docker/Dockerfile` | Docker |
| 28 | `Docker/healthcheck.sh` | Docker |
| 29 | `Documentation/00-Project-Overview.md` | Documentation |
| 30 | `Documentation/01-Solution-Setup.md` | Documentation |
| 31 | `Documentation/02-MySQL-Database-Configuration.md` | Documentation |
| 32 | `Documentation/03-Student-Service.md` | Documentation |
| 33 | `Documentation/04-Course-Service.md` | Documentation |
| 34 | `Documentation/05-Enrollment-Service.md` | Documentation |
| 35 | `Documentation/06-Notification-Service.md` | Documentation |
| 36 | `Documentation/07-API-Gateway-YARP.md` | Documentation |
| 37 | `Documentation/08-Service-to-Service-Communication.md` | Documentation |
| 38 | `Documentation/09-RabbitMQ-Event-Driven-Architecture.md` | Documentation |
| 39 | `Documentation/10-Saga-Pattern.md` | Documentation |
| 40 | `Documentation/11-Outbox-Pattern.md` | Documentation |
| 41 | `Documentation/12-Idempotency.md` | Documentation |
| 42 | `Documentation/13-CQRS-Implementation.md` | Documentation |
| 43 | `Documentation/14-Redis-Caching.md` | Documentation |
| 44 | `Documentation/15-Authentication-and-Authorization.md` | Documentation |
| 45 | `Documentation/16-Resilience-Patterns.md` | Documentation |
| 46 | `Documentation/17-Concurrency-Control.md` | Documentation |
| 47 | `Documentation/18-Background-Processing.md` | Documentation |
| 48 | `Documentation/19-Logging-and-Monitoring.md` | Documentation |
| 49 | `Documentation/20-OpenTelemetry-and-Distributed-Tracing.md` | Documentation |
| 50 | `Documentation/21-Health-Checks.md` | Documentation |
| 51 | `Documentation/22-Docker-and-Docker-Compose.md` | Documentation |
| 52 | `Documentation/23-Kubernetes.md` | Documentation |
| 53 | `Documentation/24-Unit-and-Integration-Testing.md` | Documentation |
| 54 | `Documentation/25-API-Documentation.md` | Documentation |
| 55 | `Documentation/26-Configuration-and-Environment-Variables.md` | Documentation |
| 56 | `Documentation/27-Implementation-Change-Log.md` | Documentation |
| 57 | `Kubernetes/00-namespace.yaml` | Kubernetes manifest |
| 58 | `Kubernetes/01-configmap.yaml` | Kubernetes manifest |
| 59 | `Kubernetes/02-mysql-external.yaml` | Kubernetes manifest |
| 60 | `Kubernetes/03-secret.yaml` | Kubernetes manifest |
| 61 | `Kubernetes/10-redis.yaml` | Kubernetes manifest |
| 62 | `Kubernetes/11-rabbitmq.yaml` | Kubernetes manifest |
| 63 | `Kubernetes/30-student-service.yaml` | Kubernetes manifest |
| 64 | `Kubernetes/31-course-service.yaml` | Kubernetes manifest |
| 65 | `Kubernetes/32-enrollment-service.yaml` | Kubernetes manifest |
| 66 | `Kubernetes/33-notification-service.yaml` | Kubernetes manifest |
| 67 | `Kubernetes/40-api-gateway.yaml` | Kubernetes manifest |
| 68 | `Kubernetes/kustomization.yaml` | Kubernetes manifest |
| 69 | `Monitoring/Grafana/dashboards/sms-overview.json` | Monitoring |
| 70 | `Monitoring/Grafana/provisioning/dashboards/dashboards.yml` | Monitoring |
| 71 | `Monitoring/Grafana/provisioning/datasources/prometheus.yml` | Monitoring |
| 72 | `Monitoring/Prometheus/prometheus-host.yml` | Monitoring |
| 73 | `Monitoring/Prometheus/prometheus.yml` | Monitoring |
| 74 | `README.md` | Other |
| 75 | `Services/CourseService/Controllers/CategoriesController.cs` | Controller |
| 76 | `Services/CourseService/Controllers/CoursesController.cs` | Controller |
| 77 | `Services/CourseService/CourseService.csproj` | Build |
| 78 | `Services/CourseService/Data/Configurations/EntityConfigurations.cs` | EF configuration |
| 79 | `Services/CourseService/Data/CourseDbContext.cs` | C# source |
| 80 | `Services/CourseService/Data/DesignTimeFactory.cs` | C# source |
| 81 | `Services/CourseService/Data/Migrations/20261110131336_InitialCreate.Designer.cs` | EF migration (generated) |
| 82 | `Services/CourseService/Data/Migrations/20261110131336_InitialCreate.cs` | EF migration (generated) |
| 83 | `Services/CourseService/Data/Migrations/CourseDbContextModelSnapshot.cs` | EF migration (generated) |
| 84 | `Services/CourseService/Dtos/Dtos.cs` | DTO |
| 85 | `Services/CourseService/Entities/Entities.cs` | Entity |
| 86 | `Services/CourseService/Program.cs` | Program entry point |
| 87 | `Services/CourseService/Repositories/CourseRepository.cs` | Repository |
| 88 | `Services/CourseService/Services/CategoryAppService.cs` | Application service |
| 89 | `Services/CourseService/Services/CourseAppService.cs` | Application service |
| 90 | `Services/CourseService/Services/SeatService.cs` | Application service |
| 91 | `Services/CourseService/appsettings.json` | Configuration |
| 92 | `Services/EnrollmentService/Clients/ClientRegistration.cs` | HTTP client |
| 93 | `Services/EnrollmentService/Clients/Clients.cs` | HTTP client |
| 94 | `Services/EnrollmentService/Commands/Commands.cs` | CQRS command |
| 95 | `Services/EnrollmentService/Controllers/EnrollmentsController.cs` | Controller |
| 96 | `Services/EnrollmentService/Data/Configurations/EntityConfigurations.cs` | EF configuration |
| 97 | `Services/EnrollmentService/Data/DesignTimeFactory.cs` | C# source |
| 98 | `Services/EnrollmentService/Data/EnrollmentDbContext.cs` | C# source |
| 99 | `Services/EnrollmentService/Data/Migrations/20261110133040_InitialCreate.Designer.cs` | EF migration (generated) |
| 100 | `Services/EnrollmentService/Data/Migrations/20261110133040_InitialCreate.cs` | EF migration (generated) |
| 101 | `Services/EnrollmentService/Data/Migrations/EnrollmentDbContextModelSnapshot.cs` | EF migration (generated) |
| 102 | `Services/EnrollmentService/Dtos/Dtos.cs` | DTO |
| 103 | `Services/EnrollmentService/EnrollmentService.csproj` | Build |
| 104 | `Services/EnrollmentService/Entities/Entities.cs` | Entity |
| 105 | `Services/EnrollmentService/EventHandlers/EnrollmentEventRecorder.cs` | Event recorder |
| 106 | `Services/EnrollmentService/Outbox/OutboxPublisher.cs` | Outbox |
| 107 | `Services/EnrollmentService/Program.cs` | Program entry point |
| 108 | `Services/EnrollmentService/Queries/Queries.cs` | CQRS query |
| 109 | `Services/EnrollmentService/Saga/EnrollmentSagaOrchestrator.cs` | Saga |
| 110 | `Services/EnrollmentService/appsettings.json` | Configuration |
| 111 | `Services/NotificationService/Consumers/Consumers.cs` | RabbitMQ consumer |
| 112 | `Services/NotificationService/Controllers/NotificationsController.cs` | Controller |
| 113 | `Services/NotificationService/Data/Configurations/EntityConfigurations.cs` | EF configuration |
| 114 | `Services/NotificationService/Data/DesignTimeFactory.cs` | C# source |
| 115 | `Services/NotificationService/Data/Migrations/20261110131534_InitialCreate.Designer.cs` | EF migration (generated) |
| 116 | `Services/NotificationService/Data/Migrations/20261110131534_InitialCreate.cs` | EF migration (generated) |
| 117 | `Services/NotificationService/Data/Migrations/NotificationDbContextModelSnapshot.cs` | EF migration (generated) |
| 118 | `Services/NotificationService/Data/NotificationDbContext.cs` | C# source |
| 119 | `Services/NotificationService/Dtos/NotificationResponse.cs` | DTO |
| 120 | `Services/NotificationService/Entities/Entities.cs` | Entity |
| 121 | `Services/NotificationService/NotificationService.csproj` | Build |
| 122 | `Services/NotificationService/Processing/Processing.cs` | Notification processing |
| 123 | `Services/NotificationService/Program.cs` | Program entry point |
| 124 | `Services/NotificationService/Services/NotificationIngestService.cs` | Application service |
| 125 | `Services/NotificationService/Services/NotificationQueryService.cs` | Application service |
| 126 | `Services/NotificationService/appsettings.json` | Configuration |
| 127 | `Services/StudentService/Controllers/AuthController.cs` | Controller |
| 128 | `Services/StudentService/Controllers/StudentsController.cs` | Controller |
| 129 | `Services/StudentService/Data/Configurations/EntityConfigurations.cs` | EF configuration |
| 130 | `Services/StudentService/Data/DesignTimeFactory.cs` | C# source |
| 131 | `Services/StudentService/Data/Migrations/20261110130842_InitialCreate.Designer.cs` | EF migration (generated) |
| 132 | `Services/StudentService/Data/Migrations/20261110130842_InitialCreate.cs` | EF migration (generated) |
| 133 | `Services/StudentService/Data/Migrations/StudentDbContextModelSnapshot.cs` | EF migration (generated) |
| 134 | `Services/StudentService/Data/StudentDbContext.cs` | C# source |
| 135 | `Services/StudentService/Dtos/AuthDtos.cs` | DTO |
| 136 | `Services/StudentService/Dtos/StudentDtos.cs` | DTO |
| 137 | `Services/StudentService/Entities/Identity.cs` | Entity |
| 138 | `Services/StudentService/Entities/Student.cs` | Entity |
| 139 | `Services/StudentService/Program.cs` | Program entry point |
| 140 | `Services/StudentService/Repositories/StudentRepository.cs` | Repository |
| 141 | `Services/StudentService/Services/AdminSeeder.cs` | Application service |
| 142 | `Services/StudentService/Services/AuthService.cs` | Application service |
| 143 | `Services/StudentService/Services/StudentAppService.cs` | Application service |
| 144 | `Services/StudentService/StudentService.csproj` | Build |
| 145 | `Services/StudentService/Validation/PhoneNumberAttribute.cs` | Validation |
| 146 | `Services/StudentService/appsettings.json` | Configuration |
| 147 | `StudentManagement.sln` | Build |
| 148 | `docker-compose.yml` | Docker |
| 149 | `scripts/e2e.py` | Script |
| 150 | `scripts/failure-scenarios.py` | Script |
| 151 | `scripts/start-local.sh` | Script |
| 152 | `scripts/stop-local.sh` | Script |

Total indexed files: **152**.


---

# 12. Verification and Honesty

## 12.1 How this guide was verified
| Requirement | How it was checked | Result |
|---|---|---|
| Every file path named exists | a script extracted every back-ticked path/file name and resolved it against the file system (abbreviations `S/ C/ E/ N/ B/` expanded) | **257 paths resolved**; the 21 unresolved tokens are not file references: shorthand such as `CourseRequest/Response`, environment-variable groups, `Skip/Take`, a placeholder `Data/Migrations/<timestamp>_InitialCreate.cs`, the generic `.csproj`, and **deliberately named files that do not exist** (`appsettings.Development.json`, `appsettings.{Environment}.json`, `launchSettings.json`, `path/File.cs`) |
| Every `Class.Member` named exists | script: class file found, member name present in the class source | **66 checked, 0 missing** |
| Endpoints match the code | script parsed every `[Http*]` + `[Route]` in `Controllers/*.cs` and compared with the catalogue (method, path, action) | **36 in source, 36 in catalogue, 0 differences**; `[Authorize(Roles=...)]` values read from the controllers (class-level `[Authorize]` where no action role is given) and compared by hand with the catalogue's role column; YARP routes compared with `ApiGateway/appsettings.json` |
| Scripts fully explained, check count right | every line of `start-local.sh` (29) and `stop-local.sh` (7) is covered; `e2e.py` phases cover lines 38–132; counted check executions | e2e makes **50** check executions (see 12.3 for a discrepancy with the project's own documents) |
| No secrets printed | searched both files for the development defaults (database login, admin password, JWT secret, sample passwords, broker login) | **0 hits** |
| Source tree unchanged | this guide only adds two files to `~/Documents/DotNet_Projects/`; no project file was edited, built, started or stopped; `.env` was not opened | confirmed: no file inside the project (outside `logs/`, `bin/`, `obj/`) has a modification time later than the start of this task |

## 12.2 What could not be verified
- **Kubernetes manifests** and the **Docker Compose application stack** were never run end to end (containers cannot reach the host MySQL, which listens on loopback only); the manifests were only syntax-checked.
- **Runtime behaviour was not re-run for this guide** (documentation-only task): statements about behaviour come from reading the source and from earlier live runs recorded in `Documentation/27-Implementation-Change-Log.md`.
- **Library defaults** not set in this project (EF/Pomelo connection pool size, RabbitMQ heartbeat, YARP internals) are described only as defaults, not measured.
- The ordering "authorization (403) before model binding (400)" is standard ASP.NET Core behaviour; the project's tests only call authorization-protected endpoints with valid bodies.
- Several Prometheus/Grafana/Jaeger facts (dashboards load, traces span five programs) come from the earlier verification record, not from this session.

## 12.3 Gaps and oddities a beginner might not expect
1. **Check count mismatch:** `scripts/e2e.py` executes **50** checks; `README.md` and `Documentation/24-Unit-and-Integration-Testing.md` say **49**. The script's own output ends with `ALL CHECKS PASSED` and does not print a count. (Not corrected here because this task must not modify project files.)
2. `scripts/e2e.py` defines `RABBIT` (RabbitMQ API URL) but no check uses it.
3. `Resilience:RetryDelayMs` and `Resilience:BreakerSamplingSeconds` are read by `ClientRegistration` but are **not in** `Services/EnrollmentService/appsettings.json` (code defaults 300 ms and 30 s apply).
4. `ASPNETCORE_ENVIRONMENT=Production` is set in `docker-compose.yml`, but no environment-specific `appsettings.{Environment}.json` exists, so the environment name changes nothing.
5. Several service sub-folders (`Middleware/`, `Configurations/`, and a few others) are **empty placeholders**; empty folders do not survive a git commit.
6. **Enrollment behaviour that may surprise you:** if Student/Course Service is down during *validation*, the saga compensates immediately and the client receives **422 Rejected**; only a failure during *compensation* pauses the saga (202 `InProgress`, resumed by `SagaRecoveryJob`). Recovery attempts are unbounded and published outbox rows are never purged.
7. Course Service publishes `LowCourseAvailability` **directly** after commit (not through an outbox), so a broker outage at that moment loses the alert.
8. The gateway's `/health/live` returns plain text, whereas services return the JSON `{status, checks}` for `/health/ready` and `/health`.
9. Each YARP cluster has a single destination, so round-robin load balancing is configured but never actually exercised.
10. `scripts/start-local.sh` uses `--no-build`: it runs whatever was built last, and rebuilding while the programs run can break them.
11. The OpenTelemetry OTLP exporter package 1.9.0 carries a moderate advisory (NU1902).
12. Development default credentials exist in each `appsettings.json` (database login, JWT secret, admin password) — replace them for any shared deployment.
