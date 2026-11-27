# Student Management System (.NET 8 Microservices) — Beginner's Guide & Design Patterns Explained

This document explains **everything** about this project: what it is, how it was built, how to run it, how a real request actually travels through the system, and — with real code pulled straight from this codebase — exactly **which design pattern lives in which file and why**, with a realistic example for each. It assumes no prior microservices experience.

If you only read two sections, read **§8 (Repository + Unit of Work)** and **§11 (Full Request Trace — Enrolling a Student)** — that's where every pattern in this project earns its keep at once.

---

## Table of Contents

1. [What This Project Is](#1-what-this-project-is)
2. [Architecture at a Glance](#2-architecture-at-a-glance)
3. [Vocabulary Primer](#3-vocabulary-primer)
4. [How to Start Everything](#4-how-to-start-everything)
5. [Folder Structure, Explained](#5-folder-structure-explained)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [Pattern Deep Dive — Dependency Injection](#7-pattern-deep-dive--dependency-injection)
8. [Pattern Deep Dive — Repository + Unit of Work](#8-pattern-deep-dive--repository--unit-of-work)
9. [Pattern Deep Dive — Singleton (and where it must *not* be used)](#9-pattern-deep-dive--singleton-and-where-it-must-not-be-used)
10. [Pattern Deep Dive — Clean Architecture (folder-per-layer)](#10-pattern-deep-dive--clean-architecture-folder-per-layer)
11. [Pattern Deep Dive — Event-Driven Architecture / Choreography via Kafka](#11-pattern-deep-dive--event-driven-architecture--choreography-via-kafka)
12. [Full Request Trace — Registering a Student](#12-full-request-trace--registering-a-student)
13. [Full Request Trace — Enrolling a Student](#13-full-request-trace--enrolling-a-student)
14. [Cross-Cutting Middleware Pipeline](#14-cross-cutting-middleware-pipeline)
15. [Testing Strategy](#15-testing-strategy)
16. [Real Bugs We Found (and Fixed) While Testing This Live](#16-real-bugs-we-found-and-fixed-while-testing-this-live)
17. [One-Page Cheat Sheet](#17-one-page-cheat-sheet)

---

## 1. What This Project Is

A **Student Management System** built as **four independent .NET 8 microservices** instead of one monolith:

| Service | Owns | Responsibility |
|---|---|---|
| `student-service` | `StudentDotnetDB` | Student CRUD, **and** identity: register/login/refresh/revoke, issues JWTs |
| `course-service` | `CourseDotnetDB` | Course CRUD |
| `enrollment-service` | `EnrollmentDotnetDB` | Enroll/cancel/history/status — never touches the other two databases |
| `notification-service` | `NotificationDotnetDB` | Mocked email/SMS/push delivery + durable history |

Every service is a full ASP.NET Core Web API with its own Swagger UI, its own MySQL database, its own EF Core migrations, its own xUnit test project, and its own Dockerfile — but they all lean on **three shared class libraries** (`BuildingBlocks/`) so that patterns like "how do I publish a Kafka event" or "how do I turn a `NotFoundException` into an HTTP 404" are written **once** and used identically everywhere.

Everything else in the project (JWT auth, role-based authorization, CORS, Serilog structured logging, health checks, API versioning, FluentValidation, AutoMapper, Docker, xUnit tests) exists to make the four required patterns — **Dependency Injection**, **Repository**, **Unit of Work**, and **Singleton** — sit inside something that behaves like a real system, not a toy.

---

## 2. Architecture at a Glance

```
                        ┌───────────────────────┐
                        │      Client / UI       │
                        └───────────┬────────────┘
          ┌────────────────────────┼─────────────────────────┬─────────────────────────┐
          ▼                        ▼                          ▼                         ▼
 ┌──────────────────┐    ┌──────────────────┐      ┌────────────────────┐    ┌───────────────────────┐
 │  student-service  │    │  course-service   │      │ enrollment-service │    │ notification-service  │
 │   port 8121        │    │   port 8122       │      │    port 8123        │    │     port 8124          │
 │  StudentDotnetDB   │    │   CourseDotnetDB  │      │  EnrollmentDotnetDB │    │  NotificationDotnetDB │
 │  (issues JWTs)     │    │                    │      │  (local snapshots)  │    │  (mock email/SMS/push)│
 └─────────┬──────────┘    └─────────┬─────────┘      └──────────┬──────────┘    └───────────┬────────────┘
           │  produces               │  produces                 │ produces &                │  consumes
           │  student.*              │  course.*                 │ consumes                   │  everything
           ▼                         ▼                            ▼                            ▼
                        ┌─────────────────────────────────────────────────────────┐
                        │                     Kafka  (+ Zookeeper)                  │
                        └─────────────────────────────────────────────────────────┘
```

- **Database per Service** — each service's `DbContext` only ever knows about its own database. `enrollment-service` never runs a SQL query against `StudentDotnetDB` or `CourseDotnetDB`, even though it needs student/course data to validate an enrollment (see §11).
- **No synchronous service-to-service HTTP calls, anywhere.** Every cross-service interaction is a Kafka event. This is a deliberate, harder design choice than "just call the other service's REST API" — it's what actually earns the "Event Driven Architecture" requirement instead of just producing events nobody reacts to.
- **`student-service` is the identity provider for the whole system.** It's the only service with a login/register endpoint and a `Users`/`Roles`/`RefreshTokens` schema. The other three services have zero login logic — they just validate a JWT signed with a secret every service is configured with identically (see §6).

---

## 3. Vocabulary Primer

| Term | Plain-English meaning |
|---|---|
| **Microservice** | One independently-deployable program (own process, own database) doing one job, talking to others over the network instead of in-process method calls. |
| **Kafka / topic / producer / consumer / consumer group** | Kafka is a message broker. A **topic** (e.g. `enrollment.created`) is a named channel. A **producer** publishes messages to it. A **consumer** reads them. A **consumer group** is a label — each service uses its own group id (`enrollment-service-group`, etc.) so every service that cares about a topic gets its own independent copy of every message. |
| **Dead Letter Queue (DLQ)** | If a consumer fails to process a message even after retrying, the message is republished to `<topic>.dlq` instead of being silently dropped or stuck blocking the partition forever. |
| **Repository pattern** | An interface (`IStudentRepository`) that hides "how do I fetch/save a Student" behind method names, so the rest of the app never writes raw EF Core/LINQ queries directly. |
| **Unit of Work pattern** | One object (`IStudentUnitOfWork`) that groups several repositories and commits all of their changes together in a single database transaction — so "create a user, assign a role, create a linked student" either all succeeds or all rolls back. |
| **Singleton (DI lifetime)** | A service registered so the *same instance* is reused for the entire life of the application, instead of a new one per request (Scoped) or every time it's asked for (Transient). |
| **Dependency Injection (DI)** | Instead of a class doing `new SomeService()` itself, the constructor just asks for `ISomeService`, and a central container (configured once in `Program.cs`) decides which concrete class to hand it and how long that instance should live. |
| **Choreography (vs. orchestration)** | Every service reacts to events and publishes its own events in response — nobody is "in charge." (Orchestration would mean one central coordinator explicitly telling every service what to do next.) This project uses choreography. |
| **JWT (JSON Web Token)** | A signed, tamper-proof token a server hands a client after login, proving "this really is who they say they are" on every later request without the server remembering a session. |
| **Correlation ID** | A random id generated once per incoming HTTP request and threaded through every log line touched while handling it, so you can `grep` one id across a service's logs and see that request's entire journey. |

---

## 4. How to Start Everything

```bash
cd DOTNET-student-mgmt-clean-arch-repo-uow-kafka
docker compose build
docker compose up -d
docker compose ps   # wait until every row says "healthy"
```

That single command starts, in dependency order: **MySQL → Zookeeper → Kafka → all four microservices** (each one runs its own EF Core migration automatically on startup — nobody needs to run `dotnet ef database update` by hand in Docker). See the root `README.md` for the full command reference (local dev without Docker, running tests, troubleshooting).

Swagger UI for each service (with a JWT "Authorize" button built in) is at `http://localhost:<port>/swagger`:

| Service | Port |
|---|---|
| student-service | 8121 |
| course-service | 8122 |
| enrollment-service | 8123 |
| notification-service | 8124 |

A seeded admin account (`admin@studentmgmt.local` / `Admin@12345`) exists from first boot so you can immediately test admin-only endpoints.

---

## 5. Folder Structure, Explained

Every one of the four services follows the **exact same internal shape**, so once you understand one, you understand all four:

```
Services/StudentService/
├── StudentService.csproj
├── Program.cs                      # composition root — every DI registration lives here
├── appsettings.json                # connection string, Jwt secret, Kafka settings, CORS origins
├── Controllers/                    # thin — validate nothing themselves, just call an app service
├── Entities/                       # EF Core entities (Student, ApplicationUser, Role, ...)
├── Persistence/
│   ├── StudentDbContext.cs
│   ├── Configurations/             # one Fluent API IEntityTypeConfiguration<T> per entity
│   ├── Migrations/                 # real, applied EF Core migrations
│   └── Seed/DbSeeder.cs            # seeds Admin/Faculty/Student roles + one Admin user
├── Repositories/Interfaces/  +  Repositories/       # Repository pattern (§8)
├── UnitOfWork/                     # Unit of Work pattern (§8)
├── Services/Interfaces/  +  Services/               # application/business logic
├── Kafka/Producers/  (+ Consumers/ in enrollment & notification)
├── DTOs/Requests/  +  DTOs/Responses/               # never expose entities directly over HTTP
├── Validators/                     # FluentValidation rules
└── Mappings/                       # AutoMapper profiles (Entity -> Response DTO)
```

This "one project, folders-as-layers" shape **is** Clean Architecture for a microservice of this size — see §10 for why that's a deliberate choice rather than a shortcut.

---

## 6. Authentication & Authorization

`student-service` is the only service with an `AuthController`. `POST /api/v1/auth/register` and `POST /api/v1/auth/login` both end by calling `IJwtTokenService.GenerateToken(userId, email, fullName, roles)` — defined once in the shared library at `BuildingBlocks/StudentMgmt.BuildingBlocks.Common/Security/JwtTokenService.cs` — which stamps the user's roles into the token as `ClaimTypes.Role` claims and signs it with HMAC-SHA256 using a secret from configuration.

That secret (`Jwt:Secret` in `appsettings.json`) is **byte-for-byte identical across all four services**. That one fact is what lets `course-service`, `enrollment-service` and `notification-service` validate a token they never issued: each one calls the exact same `AddJwtAuthentication(configuration)` extension method (`BuildingBlocks/StudentMgmt.BuildingBlocks.Common/Extensions/JwtAuthenticationServiceExtensions.cs`), which registers the ASP.NET Core `JwtBearer` handler pointed at that shared secret/issuer/audience — no service ever calls another service over HTTP to ask "is this token valid?"

Authorization is policy-based, not raw role-string-checking in every controller. Four policies are registered once, centrally:

```csharp
// BuildingBlocks/StudentMgmt.BuildingBlocks.Common/Extensions/JwtAuthenticationServiceExtensions.cs
services.AddAuthorizationBuilder()
    .AddPolicy(PolicyConstants.AdminOnly, policy => policy.RequireRole(RoleConstants.Admin))
    .AddPolicy(PolicyConstants.CanManageCourses, policy => policy.RequireRole(RoleConstants.Admin, RoleConstants.Faculty))
    .AddPolicy(PolicyConstants.CanManageStudents, policy => policy.RequireRole(RoleConstants.Admin, RoleConstants.Faculty))
    .AddPolicy(PolicyConstants.CanEnroll, policy => policy.RequireRole(RoleConstants.Admin, RoleConstants.Faculty, RoleConstants.Student));
```

...and every controller action just references the policy by name, e.g. `[Authorize(Policy = PolicyConstants.CanManageCourses)]` on `CoursesController.CreateAsync`. If the *rules* for who can manage courses ever change, there is exactly one line to edit, in one file, and every service that already has the shared library referenced picks it up.

---

## 7. Pattern Deep Dive — Dependency Injection

**What it is:** a class declares what it needs in its constructor (an interface), and never decides for itself which concrete class satisfies that interface or how long that instance should live. A central container — configured once per service, in `Program.cs` — makes that decision.

**Where it's used:** everywhere, but the clearest place to see the whole picture is `Services/StudentService/Program.cs`:

```csharp
// Services/StudentService/Program.cs
builder.Services.AddControllers();
builder.Services.AddAppApiVersioning();
builder.Services.AddAppSwagger("Student Service API");
builder.Services.AddAppCors(builder.Configuration);
builder.Services.AddJwtAuthentication(builder.Configuration);   // Singleton IJwtTokenService, IPasswordHasher
builder.Services.AddKafkaMessaging(builder.Configuration);      // Singleton IEventProducer, IDeadLetterPublisher
builder.Services.AddSharedCommonServices();                     // Singleton ICacheService
builder.Services.AddAutoMapper(typeof(Program));
builder.Services.AddValidatorsFromAssemblyContaining<Program>();

builder.Services.AddDbContext<StudentDbContext>(options =>
    options.UseMySql(connectionString, new MySqlServerVersion(new Version(8, 0, 36))));  // Scoped, by convention

builder.Services.AddScoped<IStudentRepository, StudentRepository>();
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IRoleRepository, RoleRepository>();
builder.Services.AddScoped<IRefreshTokenRepository, RefreshTokenRepository>();
builder.Services.AddScoped<IStudentUnitOfWork, StudentUnitOfWork>();
builder.Services.AddScoped<IStudentAppService, StudentAppService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<StudentEventPublisher>();
```

**Realistic example — following one dependency chain:** `AuthController` asks for `IAuthService` in its constructor. The container hands it an `AuthService` instance. `AuthService`'s own constructor asks for `IStudentUnitOfWork`, `IPasswordHasher`, `IJwtTokenService`, `StudentEventPublisher`, two FluentValidation validators, and an `ILogger<AuthService>` — and never once calls `new` on any of them. Nothing in `AuthService` knows or cares that `IPasswordHasher` happens to be backed by BCrypt, or that `IJwtTokenService` is a Singleton while `IStudentUnitOfWork` is Scoped — that's exactly the point: **the consumer of a dependency should never need to know its lifetime or concrete type**, only its contract.

This is also what makes the whole test suite possible without a database or a running Kafka broker: `tests/StudentService.Tests/AuthServiceTests.cs` constructs an `AuthService` by hand and passes in **Moq-mocked** implementations of every one of those interfaces instead of real ones — DI is what makes a class swappable in the first place.

---

## 8. Pattern Deep Dive — Repository + Unit of Work

These two patterns are covered together because in this codebase they're deliberately built as a matching pair: **every** Unit of Work is just a bag of repositories plus transaction control over the one `DbContext` they all share.

### 8.1 The generic building blocks (written once)

```csharp
// BuildingBlocks/StudentMgmt.BuildingBlocks.Common/Repositories/IRepository.cs
public interface IRepository<TEntity> where TEntity : BaseEntity
{
    Task<TEntity?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<TEntity>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<TEntity>> FindAsync(Expression<Func<TEntity, bool>> predicate, CancellationToken cancellationToken = default);
    Task<(IReadOnlyList<TEntity> Items, int TotalCount)> GetPagedAsync(int pageNumber, int pageSize, ...);
    Task<bool> ExistsAsync(Expression<Func<TEntity, bool>> predicate, CancellationToken cancellationToken = default);
    Task AddAsync(TEntity entity, CancellationToken cancellationToken = default);
    void Update(TEntity entity);
    void Remove(TEntity entity);   // soft delete — sets IsDeleted, never actually deletes the row
}
```

`RepositoryBase<TEntity>` (same folder) implements every one of those methods once, against a plain `DbContext`/`DbSet<TEntity>`. Every concrete repository in every service — `StudentRepository`, `CourseRepository`, `EnrollmentRepository`, `NotificationHistoryRepository` — inherits from it and adds **only** the queries that are genuinely specific to that entity:

```csharp
// Services/StudentService/Repositories/StudentRepository.cs
public class StudentRepository : RepositoryBase<Student>, IStudentRepository
{
    public StudentRepository(StudentDbContext context) : base(context) { }

    public async Task<Student?> GetByEmailAsync(string email, CancellationToken cancellationToken = default) =>
        await DbSet.FirstOrDefaultAsync(s => s.Email == email && !s.IsDeleted, cancellationToken);

    public async Task<bool> EmailExistsAsync(string email, CancellationToken cancellationToken = default) =>
        await DbSet.AnyAsync(s => s.Email == email && !s.IsDeleted, cancellationToken);

    public override void Update(Student entity)
    {
        entity.RowVersion = Guid.NewGuid().ToByteArray();   // manual concurrency token bump — MySQL has no native rowversion type
        base.Update(entity);
    }
}
```

Thirteen lines, and `StudentRepository` already supports full CRUD, pagination, filtering, existence checks, *and* the two email-specific lookups `AuthService` needs — without a single hand-written `SELECT` anywhere else in the codebase.

The Unit of Work follows the identical shape. The generic `UnitOfWorkBase` (same shared library) implements `CommitAsync`/`BeginTransactionAsync`/`CommitTransactionAsync`/`RollbackTransactionAsync`/`Dispose` once, against a `DbContext`. Each service's concrete Unit of Work just wires up its repositories against that same context instance:

```csharp
// Services/StudentService/UnitOfWork/StudentUnitOfWork.cs
public class StudentUnitOfWork : UnitOfWorkBase, IStudentUnitOfWork
{
    public StudentUnitOfWork(StudentDbContext context) : base(context)
    {
        Students = new StudentRepository(context);
        Users = new UserRepository(context);
        Roles = new RoleRepository(context);
        RefreshTokens = new RefreshTokenRepository(context);
    }

    public IStudentRepository Students { get; }
    public IUserRepository Users { get; }
    public IRoleRepository Roles { get; }
    public IRefreshTokenRepository RefreshTokens { get; }
}
```

### 8.2 Realistic example — why Unit of Work actually matters here

`AuthService.RegisterAsync` (`Services/StudentService/Services/AuthService.cs`) needs to do **three separate writes** — create an `ApplicationUser`, create a `UserRole` join row, and (if the role is "Student") create a linked `Student` row — and it needs **all three to succeed together or not at all**. If step 3 failed after steps 1–2 had already been saved, you'd have a user account with no student record and a role assignment nobody asked for. This is exactly the scenario Support Transactions / Commit / Rollback exists to prevent:

```csharp
await _unitOfWork.BeginTransactionAsync(cancellationToken);
try
{
    await _unitOfWork.Users.AddAsync(user, cancellationToken);
    await _unitOfWork.Users.AssignRoleAsync(user.Id, role.Id, cancellationToken);

    if (string.Equals(roleName, RoleConstants.Student, StringComparison.OrdinalIgnoreCase))
    {
        createdStudent = new Student { /* ... */ UserId = user.Id };
        await _unitOfWork.Students.AddAsync(createdStudent, cancellationToken);
    }

    await _unitOfWork.CommitTransactionAsync(cancellationToken);   // all three inserts, one real SQL transaction
}
catch
{
    await _unitOfWork.RollbackTransactionAsync(cancellationToken); // any failure -> none of the three persist
    throw;
}
```

Only **after** that transaction has actually committed does the code publish a `StudentCreatedEvent` to Kafka — publishing it before the commit would risk telling the rest of the system "this student exists" for a student that a moment later got rolled back.

---

## 9. Pattern Deep Dive — Singleton (and where it must *not* be used)

A Singleton is registered once and the *same instance* is reused for the lifetime of the whole process. This project uses it in exactly three deliberate places, and explicitly avoids it everywhere it would be wrong:

| Singleton | File | Why Singleton is *correct* here |
|---|---|---|
| `IEventProducer` (Kafka producer) | `BuildingBlocks/.../Messaging/KafkaEventProducer.cs` | Wraps a real Confluent `IProducer<>` connection to the broker — expensive to open, thread-safe, meant to be shared across every request for the life of the process. |
| `IJwtTokenService` / `IPasswordHasher` | `BuildingBlocks/.../Security/JwtTokenService.cs`, `IPasswordHasher.cs` | Completely stateless (no per-request data), so one shared instance is both correct *and* the efficient choice — no reason to construct a new one per request. |
| `ICacheService` | `BuildingBlocks/.../Caching/ICacheService.cs` | The entire point of an in-memory cache is shared, process-wide state. A Scoped or Transient "cache" would just be a dictionary that resets every request and caches nothing. |

And the explicit **"never misuse Singleton"** boundary this project respects: `RepositoryBase<TEntity>` and every `DbContext` are registered **Scoped**, never Singleton. A `DbContext` is *not* thread-safe and represents one unit-of-work's worth of tracked changes — sharing one instance across every concurrent HTTP request would cause data corruption and cross-request state leaks almost immediately. The `builder.Services.AddDbContext<StudentDbContext>(...)` call in every `Program.cs` registers it Scoped by default (ASP.NET Core's own convention) precisely for this reason, and every repository/unit-of-work built on top of it is Scoped too so they always live exactly one HTTP request's lifetime.

---

## 10. Pattern Deep Dive — Clean Architecture (folder-per-layer)

Classic Clean Architecture draws hard project-boundary lines between Domain, Application, Infrastructure and Presentation — usually as **separate .csproj files** so the compiler enforces "Domain can't reference Infrastructure." For a microservice this size (one bounded context, one team, one deployable), four services × four extra .csproj files each would have meant 16+ additional project files whose only job was enforcing a boundary that a code reviewer can just as easily enforce by convention.

This project makes the deliberate, documented trade-off of **folders-as-layers inside one .csproj per service** (see the tree in §5): `Entities/` is the Domain layer, `Services/` + `DTOs/` + `Validators/` + `Mappings/` are the Application layer, `Persistence/` + `Repositories/` + `Kafka/` are Infrastructure, and `Controllers/` is Presentation — while the genuinely cross-cutting, reused-by-everyone code (generic Repository/UnitOfWork base classes, JWT, middlewares, Kafka plumbing) lives one level up, in `BuildingBlocks/`, as real separate class libraries every service references. You still get the *conceptual* separation and the *actual, compiled, reused-across-4-services* infrastructure code — just without a project-reference graph that would have made this codebase roughly four times as many files for the same behavior.

---

## 11. Pattern Deep Dive — Event-Driven Architecture / Choreography via Kafka

This is the part of the project that only makes sense once more than one service is talking to more than one other service, and it's the strictest real-world test of "Database per Service."

**The problem:** `enrollment-service` needs to know a student's name/email and a course's title/capacity to validate an enrollment and to build a nice `EnrollmentCreatedEvent`. But it is **never allowed to query `StudentDotnetDB` or `CourseDotnetDB`.** So how does it know anything about students or courses at all?

**The answer: it keeps its own local, read-only copies — "snapshots" — kept in sync purely by listening to Kafka.**

```csharp
// Services/EnrollmentService/Kafka/Consumers/StudentEventsConsumer.cs (shape)
protected override string[] Topics => new[]
{
    KafkaTopics.StudentCreated, KafkaTopics.StudentUpdated, KafkaTopics.StudentDeleted
};

protected override async Task HandleMessageAsync(string topic, string? eventType, string rawMessage,
    IServiceProvider scopedServiceProvider, CancellationToken cancellationToken)
{
    var sync = scopedServiceProvider.GetRequiredService<ISnapshotSyncService>();
    switch (eventType)
    {
        case nameof(StudentCreatedEvent):
        case nameof(StudentUpdatedEvent):
            var evt = JsonSerializer.Deserialize<StudentCreatedEvent>(rawMessage)!;
            await sync.UpsertStudentSnapshotAsync(evt.StudentId, $"{evt.FirstName} {evt.LastName}", evt.Email, cancellationToken);
            break;
        case nameof(StudentDeletedEvent):
            await sync.RemoveStudentSnapshotAsync(/* ... */);
            break;
    }
}
```

```csharp
// Services/EnrollmentService/Services/SnapshotSyncService.cs — the actual sync logic
public async Task UpsertStudentSnapshotAsync(Guid studentId, string fullName, string email, CancellationToken cancellationToken = default)
{
    await _unitOfWork.StudentSnapshots.UpsertAsync(studentId, fullName, email, cancellationToken);
    await _unitOfWork.CommitAsync(cancellationToken);
}
```

The trick that makes this genuinely simple instead of needing a separate id-mapping table: `StudentSnapshot.Id` is **deliberately set equal to the real `StudentId` from the event**, not auto-generated. `BaseEntity.Id` is a plain settable `Guid`, so `enrollment-service`'s own `GetByIdAsync(studentId)` against its own tiny local table transparently "resolves" a student that actually lives in a completely different database.

`CourseSnapshot.EnrolledCount` is the one field that is **never** overwritten by an incoming `CourseUpdatedEvent` — it's owned and mutated only locally, by `EnrollmentAppService`, every time someone enrolls or cancels. That's a subtle but important rule: a snapshot mirrors *some* fields of a remote aggregate, not the whole thing, and the fields it owns locally vs. the fields it merely mirrors have to be kept straight or the capacity check would be wrong.

With that in place, `EnrollmentAppService.EnrollAsync` (`Services/EnrollmentService/Services/EnrollmentAppService.cs`) is pure local logic — no HTTP calls to any other service, anywhere:

```csharp
var studentSnapshot = await _unitOfWork.StudentSnapshots.GetByIdAsync(request.StudentId, cancellationToken)
    ?? throw new NotFoundException("Student", request.StudentId);   // snapshot not arrived yet = correctly models replication lag

var courseSnapshot = await _unitOfWork.CourseSnapshots.GetByIdAsync(request.CourseId, cancellationToken)
    ?? throw new NotFoundException("Course", request.CourseId);

if (courseSnapshot.EnrolledCount >= courseSnapshot.Capacity)
    throw new BusinessRuleException("Course is at full capacity.");

if (await _unitOfWork.Enrollments.HasActiveEnrollmentAsync(request.StudentId, request.CourseId, cancellationToken))
    throw new BusinessRuleException("Student is already enrolled in this course.");

// ... create Enrollment, courseSnapshot.EnrolledCount += 1, commit, then publish EnrollmentCreatedEvent
```

A `NotFoundException` here doesn't necessarily mean "that student doesn't exist" — it can also correctly mean "that student was created 200ms ago and the Kafka event hasn't been consumed yet." That's an honest, visible consequence of choreography that a synchronous HTTP call to `student-service` would have hidden — and it's exactly why §16 documents the one real timing quirk we hit while testing this live.

---

## 12. Full Request Trace — Registering a Student

`POST /api/v1/auth/register` on `student-service`, body `{"firstName":"Amy","lastName":"Nguyen","email":"amy@example.com","password":"Passw0rd!","dateOfBirth":"2004-03-15"}`:

1. **`CorrelationIdMiddleware`** runs first, mints a correlation id, pushes it onto the Serilog `LogContext`.
2. **`AuthController.Register`** (no `[Authorize]` — anyone can register) calls `IAuthService.RegisterAsync(request)`.
3. **`AuthService.RegisterAsync`** validates via `RegisterRequestValidator` (FluentValidation) — throws `ValidationAppException` on failure, which the shared `ExceptionHandlingMiddleware` turns into a 400 with per-field errors.
4. Checks `_unitOfWork.Users.EmailExistsAsync` — throws `BusinessRuleException` (→ 409) if taken.
5. Hashes the password with `IPasswordHasher.Hash` (BCrypt, work factor 12).
6. **Opens a transaction**, creates `ApplicationUser` + `UserRole` + `Student` (see §8.2), commits.
7. **Fires `StudentCreatedEvent` on a detached `Task.Run`** (see §16 — Kafka's own retry pipeline can block for a long time if the broker is briefly unreachable; this keeps that latency off the HTTP response since the MySQL write, not the Kafka publish, is the actual source of truth).
8. Calls `IJwtTokenService.GenerateToken` (Singleton, §9) to mint an access + refresh token pair, persists the refresh token.
9. Returns `AuthResponse` — including `StudentId` (the *linked Student's own id*, distinct from `UserId`, since `enrollment-service` needs the former, not the latter — see §16).

Meanwhile, **asynchronously and completely decoupled from that HTTP response**: `notification-service`'s `UpstreamEventsConsumer` picks up the `StudentCreatedEvent` off the `student.created` topic, calls `INotificationAppService.DeliverAsync(NotificationChannel.Email, ...)`, which dispatches to the mocked `SmtpMockEmailSender`, logs `[MOCK EMAIL] To: amy@example.com | Subject: Welcome to Student Management System`, saves a `NotificationHistory` row, and publishes `NotificationSentEvent`. None of this blocks or is even visible to the original `/auth/register` caller — that's the whole point of asynchronous, event-driven communication.

---

## 13. Full Request Trace — Enrolling a Student

Given a `studentId` and `courseId` already created (and their Kafka events already consumed into local snapshots — §11), `POST /api/v1/enrollments` on `enrollment-service`:

1. `CorrelationIdMiddleware` → `RequestResponseLoggingMiddleware` log the inbound request.
2. `[Authorize(Policy = PolicyConstants.CanEnroll)]` on `EnrollmentsController` validates the JWT — signed by `student-service`, validated here with zero HTTP calls back to it (§6).
3. `EnrollmentAppService.EnrollAsync` runs the local-only checks from §11: snapshot exists, capacity not exceeded, no duplicate active enrollment.
4. Creates the `Enrollment` row, increments `CourseSnapshot.EnrolledCount`, commits **both** in the same `CommitAsync()` call (both are tracked by the same `EnrollmentDbContext`, so this is still one SQL transaction even without an explicit `BeginTransactionAsync`).
5. Publishes `EnrollmentCreatedEvent` (`EnrollmentId`, `StudentId`, `CourseId`, `StudentEmail`, `StudentFullName`, `CourseTitle`, `EnrolledOnUtc`) to Kafka.
6. Returns `200 OK` with an `EnrollmentResponse` built from the local `Enrollment` + the two snapshots (not from a fresh call anywhere).

Downstream: `notification-service` consumes `EnrollmentCreatedEvent`, sends (mocked) "Enrollment Confirmed" to `evt.StudentEmail`, records it, publishes `NotificationSentEvent`. If the student later cancels (`POST /api/v1/enrollments/{id}/cancel`), the mirror image happens: `EnrollmentCancelledEvent` → "Enrollment Cancelled" email → `NotificationSentEvent`. We verified this entire six-hop chain — HTTP → MySQL → Kafka → Kafka consumer → MySQL → Kafka again — live against the real Docker Compose stack; see §16.

---

## 14. Cross-Cutting Middleware Pipeline

Every service's `Program.cs` calls exactly one line — `app.UseSharedMiddlewares()` — which (from `BuildingBlocks/.../Extensions/CommonServiceExtensions.cs`) registers three middlewares in a specific, deliberate order:

1. **`CorrelationIdMiddleware`** — reads (or mints) `X-Correlation-Id`, pushes it onto the Serilog `LogContext` so every subsequent log line in this request is tagged with it, and echoes it back on the response header.
2. **`RequestResponseLoggingMiddleware`** — logs the inbound request and the outgoing response (status + elapsed ms) as structured Serilog events.
3. **`ExceptionHandlingMiddleware`** — catches anything that escapes the controller, maps known exception types (`NotFoundException` → 404, `ValidationAppException` → 400, `BusinessRuleException` → 409, `AuthenticationFailedException` → 401, `ForbiddenException` → 403, `MessagingException` → 502, anything else → 500) to a consistent `ApiResponse<T>` JSON body, and logs it with the correlation id attached.

Because this lives in the shared library, **no controller in any of the four services ever writes a `try/catch` block** — every application service is free to just `throw new NotFoundException(...)` and trust that it becomes the right HTTP response, consistently, everywhere.

---

## 15. Testing Strategy

```bash
dotnet test StudentManagement.sln
```

102 tests total across the four services (28 + 43 + 21 + 10), using **xUnit** + **Moq** (mocking every repository/unit-of-work/external dependency so business logic tests run in milliseconds with no database) + **FluentAssertions** + **EF Core InMemory** (for the handful of tests that specifically verify a real LINQ query against `RepositoryBase<TEntity>`, e.g. that `GetPagedAsync` actually paginates/sorts/filters correctly). Every service's tests cover: application-service business rules (including the exact exception thrown for each failure path), repository queries, controller response shapes, and FluentValidation rules.

---

## 16. Real Bugs We Found (and Fixed) While Testing This Live

Unit tests with mocks are necessary but not sufficient — they can't catch a bug in how ASP.NET Core's own routing behaves at runtime. After the whole stack passed 102/102 unit tests and built with zero compiler errors, we still ran the entire system live in Docker and drove it with real `curl` requests end-to-end, and found two real issues worth understanding:

1. **`CreatedAtAction` + URL-segment API versioning.** `CoursesController.CreateAsync` originally returned `CreatedAtAction(nameof(GetByIdAsync), new { id = course.Id }, response)`. This throws `InvalidOperationException: No route matches the supplied values` at runtime, because the route template is `api/v{version:apiVersion}/courses/{id}` and `CreatedAtAction` needs *every* route parameter — including `version` — to generate the `Location` header URL, and it wasn't supplied. The fix: return `Created($"/api/v1/courses/{course.Id}", response)` instead, which sets the `Location` header from a literal string and never needs the router to generate a link at all. This is a good example of why "it compiles and the unit tests pass" isn't the same as "it works" — the unit tests called the controller method directly and only ever asserted on the `ActionResult` object's shape, never on whether ASP.NET Core's routing engine could actually satisfy it.
2. **`AuthResponse` didn't expose the created `Student.Id`.** After registering, a caller only got back `UserId` (the login/`ApplicationUser` id) — but `enrollment-service` needs the *Student* entity's own id, which is a different value. We added a `StudentId` field to `AuthResponse`, populated it in `RegisterAsync` (from the student just created) and in `LoginAsync`/`RefreshTokenAsync` (via a lookup by `UserId`), and updated the two affected unit tests' Moq setups to match. This is the kind of gap that's easy to miss when a service is designed and tested in isolation — it only shows up once you actually try to use two services together the way a real client would.

Both fixes are reflected in the current code and covered by the (now passing) test suite; we mention them here because understanding *why* they were bugs teaches the versioning/routing and DTO-design lessons better than getting it right on the first try would have.

We also observed one **expected, non-bug** timing behavior: the very first message ever published to a brand-new Kafka topic in a fresh environment can take a few seconds to reach a consumer that subscribed before the topic existed (Kafka auto-creates topics lazily on first publish; an already-subscribed consumer needs one metadata refresh cycle to notice it). Every message after that first one on that topic is delivered immediately. If you enroll a student milliseconds after registering them in a brand-new environment and get a 404 "Student not found," this is why — retry a few seconds later.

---

## 17. One-Page Cheat Sheet

| I want to... | Do this |
|---|---|
| Start everything | `docker compose up -d` |
| See if it's healthy | `docker compose ps` |
| Try the API | Swagger UI at `:8121/8122/8123/8124/swagger`, or `curl` (see root README §4) |
| Log in as admin | `admin@studentmgmt.local` / `Admin@12345` |
| Add a new entity/table | Add the entity class, a `Persistence/Configurations/XConfiguration.cs`, then `dotnet ef migrations add <Name>` |
| Add a new Kafka event | Add the event class to `BuildingBlocks/.../Contracts/Events/`, a topic constant to `KafkaTopics.cs`, publish via `IEventProducer`, consume via a `KafkaConsumerBase` subclass |
| Add a new authorization rule | Edit the policies in `JwtAuthenticationServiceExtensions.AddJwtAuthentication` (one place, all four services pick it up) |
| Run the tests | `dotnet test StudentManagement.sln` |
| Trace one request across logs | `grep <correlation-id>` in `docker logs studentmgmt-<service>` |
