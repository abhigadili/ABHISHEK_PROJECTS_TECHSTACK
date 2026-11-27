# Docker Deployment (A→Z), Startup Flow, File Reference & Endpoint Lifecycle

This document is the operational companion to `202607042322-dotnet-student-mgmt-beginners-guide-and-patterns.md` (which explains the *design patterns*). This one answers four different, very practical questions:

- **Part A** — If you had to set up Docker deployment for this project from a bare checkout, what exact steps do you take, in order, and why? (Including the real issues we hit and fixed along the way.)
- **Part B** — When you run it, what actually happens first, second, third...? What's the entry point, and what runs right after it?
- **Part C** — For every file in this codebase, what is it actually for?
- **Part D** — For every single HTTP endpoint, what is the exact request → response journey?

---

## Table of Contents

1. [Part A — Docker Deployment From Scratch](#part-a--docker-deployment-from-scratch)
2. [Part B — Application Startup Flow (Entry Point → Ready)](#part-b--application-startup-flow-entry-point--ready)
3. [Part C — File-by-File Reference](#part-c--file-by-file-reference)
4. [Part D — Endpoint Lifecycle Reference](#part-d--endpoint-lifecycle-reference)

---

# Part A — Docker Deployment From Scratch

This is the exact sequence to go from "I have this .NET source code" to "the whole system is running in Docker, verified end-to-end." It's written as a series of **gates**: each gate lists what must *already* be true before you attempt that step, the action itself, how to prove it actually worked, and — the part a normal tutorial skips — what actually goes wrong if you jump ahead without satisfying the prerequisite. Real problems we hit while doing this are called out inline (marked **⚠ Real issue hit**).

> **How to read a gate:** *Prerequisite* = must be true before you start. *Action* = what you actually run/write. *Verify* = the concrete command/output that proves it worked. *If skipped* = the actual failure you'll see if you ignore the prerequisite — so you can recognize it later and know exactly which gate to go back to.

## Gate 0 — Host machine is ready

| | |
|---|---|
| **Prerequisite** | Nothing — this is the starting gate. |
| **Action** | Install Docker Engine + Docker Compose v2 (`docker compose version` must succeed — the legacy standalone `docker-compose` v1 binary is a different, older tool and some syntax in this project's `docker-compose.yml`, like `depends_on: condition:`, requires Compose v2's schema). Confirm the Docker daemon itself is running (`docker ps` must not error). |
| **Verify** | `docker --version && docker compose version && docker ps` all succeed. |
| **If skipped** | `docker compose up` fails immediately with `docker: command not found`, `unknown shorthand flag`, or (with the older v1 tool) a YAML schema error on the `condition:` keys under `depends_on`. |

## Gate 1 — No port conflicts on the host

| | |
|---|---|
| **Prerequisite** | Gate 0. |
| **Action** | Before assigning a single port number in `docker-compose.yml`, run `docker ps` and check what's already bound. This is **mandatory**, not optional, on a shared/long-lived dev machine — this exact machine already had an unrelated Kafka+Zookeeper stack running on the default ports 9092/2181 for a different project. |
| **Verify** | `docker ps --format "table {{.Names}}\t{{.Ports}}"` — cross-check every port you're about to use (3306, 9092, 2181, and whatever host ports you plan for the 4 APIs) against this list. |
| **If skipped** | `docker compose up` fails on the *first* conflicting container with `Error starting userland proxy: listen tcp4 0.0.0.0:9092: bind: address already in use` — and depending on `depends_on` ordering, every container that depends on the failed one never starts either, so one silent port clash can look like "the whole stack is broken." |

Decisions made at this gate for this project:

| Decision | Value chosen | Why |
|---|---|---|
| How many containers | 7: `mysql`, `zookeeper`, `kafka`, and 4 microservices | One database engine (holding 4 separate databases), one broker, one container per service |
| Host ports for the 4 APIs | 8121 / 8122 / 8123 / 8124 | Avoid colliding with an unrelated Java version of this same demo already using 8111-8114 on this machine |
| Host port for MySQL | 3311 → container 3306 | Avoid colliding with any default local MySQL (3306) already in use |
| Host port for Kafka | 9095 → container 9092 (internal 29092 used container-to-container) | Avoid colliding with an unrelated Kafka broker already running on the default 9092 on this machine |

## Gate 2 — The .NET source must already build outside Docker

| | |
|---|---|
| **Prerequisite** | Gate 0. The 3 `BuildingBlocks/` projects and all 4 services must exist as real, compiling C# — `Directory.Build.props` present at the repo root, every `.csproj` correctly referencing its dependencies. |
| **Action** | `dotnet build StudentManagement.sln` from the repo root, with **zero errors**. |
| **Verify** | Console output ends with `Build succeeded. 0 Error(s)`. |
| **If skipped** | This is the single most important gate in the whole list and the one most tempting to skip ("Docker will catch it"). It won't catch it faster — it'll catch the *exact same* compiler error, just 10-30x slower, because every `docker compose build` re-runs `dotnet restore`/`dotnet build`/`dotnet publish` inside a fresh container instead of using your already-warm local NuGet cache and incremental build state. Always get `dotnet build` green locally first; Docker should only ever be re-proving something you already know works. |

## Gate 3 — Know exactly which files each Dockerfile needs, before writing it

| | |
|---|---|
| **Prerequisite** | Gate 2 (if the source doesn't build, there's nothing correct to containerize). You must know: (a) this service's own `.csproj` path, (b) the exact relative paths of the 3 `BuildingBlocks` `.csproj` files it references, because a Dockerfile's `COPY` instructions are resolved **relative to the build context**, not relative to the Dockerfile's own location. |
| **Action** | Write the 4-stage Dockerfile (base → build → publish → final) for the service — see the full annotated example below. |
| **Verify** | Nothing to verify yet in isolation — a Dockerfile can't be "tested" standalone until Gate 5. |
| **If skipped** | The classic failure: writing `COPY ["../../BuildingBlocks/.../X.csproj", "..."]` assuming the Dockerfile's own folder is the reference point. Docker will refuse this outright — `COPY` cannot reference paths outside the build context — with `forbidden path outside the build context`. |

Each of the 4 services has an identical 4-stage Dockerfile (only the project name differs), e.g. `Services/StudentService/Dockerfile`:

```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base      # stage 1: the slim runtime-only image the final container ships
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build          # stage 2: the full SDK image, only used to compile
WORKDIR /src
COPY ["Directory.Build.props", "./"]
COPY ["BuildingBlocks/.../*.csproj", "BuildingBlocks/.../"]   # copy .csproj files BEFORE source, for layer caching
COPY ["Services/StudentService/StudentService.csproj", "Services/StudentService/"]
RUN dotnet restore "Services/StudentService/StudentService.csproj"
COPY BuildingBlocks/ BuildingBlocks/
COPY Services/StudentService/ Services/StudentService/
WORKDIR /src/Services/StudentService
RUN dotnet build "StudentService.csproj" -c Release -o /app/build

FROM build AS publish                                    # stage 3: produce the final, trimmed publish output
RUN dotnet publish "StudentService.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final                                        # stage 4: the actual image that ships — just runtime + published DLLs
WORKDIR /app
COPY --from=publish /app/publish .
ENV ASPNETCORE_URLS=http://+:8080
ENTRYPOINT ["dotnet", "StudentService.dll"]
```

Why **multi-stage**: the final image only contains the `aspnet:8.0` runtime (~220MB) plus published DLLs — never the full SDK (~800MB) used to build it. Why **`.csproj` copied and restored before the rest of the source**: Docker caches each `RUN`/`COPY` layer; as long as the `.csproj` files haven't changed, `dotnet restore` (the slowest step, downloading NuGet packages) is skipped on every rebuild after a pure source-code change.

**⚠ Real issue hit:** the container `HEALTHCHECK` we planned to add needs `curl`, but `mcr.microsoft.com/dotnet/aspnet:8.0` does **not** include `curl` by default (verified with `docker run --rm mcr.microsoft.com/dotnet/aspnet:8.0 sh -c "which curl"` → not found). Fixed by adding the `apt-get install curl` line to the **base** stage (line 3-5 above) — that stage is what the *final* image is built from, so this is the minimal-footprint place to add it, not the build stage. **The lesson generalizes**: never assume a minimal runtime image has anything beyond the .NET runtime itself — verify with a throwaway `docker run` before wiring a `HEALTHCHECK`/`ENTRYPOINT` script around a tool that might not exist.

## Gate 4 — The MySQL init script must exist *before the mysql container's data volume is created*

| | |
|---|---|
| **Prerequisite** | Gate 1 (know the 4 database names you need). |
| **Action** | Write `sql/init-databases.sql` (the 4 `CREATE DATABASE IF NOT EXISTS ...` statements). |
| **Verify** | Valid SQL syntax — no way to verify further until the container actually runs it (Gate 6). |
| **If skipped, or done too late** | This is a genuinely easy-to-miss timing trap: the official `mysql` image only executes files in `/docker-entrypoint-initdb.d/` **the very first time** it starts with an *empty* data directory. If you bring `mysql` up once *without* this file mounted (even accidentally), its named volume now has an initialized-but-empty-of-your-databases data directory — and mounting the script in afterward and restarting the container **will not** retroactively run it. The fix at that point is `docker compose down -v` (deletes the volume, including any other data you'd put in) and starting fresh. Get this file in place *before* the very first `docker compose up`. |

```sql
CREATE DATABASE IF NOT EXISTS StudentDotnetDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS CourseDotnetDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS EnrollmentDotnetDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS NotificationDotnetDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Mounting this file (Gate 5) means the 4 empty databases exist before any service's `db.Database.Migrate()` ever runs — each service then creates only *its own* tables inside *its own* database, enforcing Database-per-Service at the infrastructure level, not just by convention.

## Gate 5 — Write `docker-compose.yml`, in strict internal dependency order

YAML has no forward-reference problem the way, say, a C `#include` chain would, but **conceptually** each block below depends on the one before it existing, and we wrote it in exactly this order:

| | |
|---|---|
| **Prerequisite** | Gates 1-4 all complete: ports decided, all 4 Dockerfiles written, init script written. |
| **Action** | Compose the file section by section, in this order (each depends conceptually on the previous): |

1. **`networks:`** — one custom bridge network (`studentmgmt-network`) so all 7 containers can resolve each other by service name (`mysql`, `kafka`, etc.) without any manual IP/DNS configuration. *(Must exist before any `services:` entry references it.)*
2. **`volumes:`** — four named volumes (`mysql-data`, `zookeeper-data`, `zookeeper-log`, `kafka-data`) so data survives `docker compose down` (though not `docker compose down -v`). *(Must exist before any `services:` entry mounts them.)*
3. **`x-jwt-env: &jwt-env`** — a YAML anchor holding the `Jwt:*`/`Cors:*` environment variables that must be **byte-for-byte identical** across all 4 services (§6 of the beginner's guide explains why). *(Must be defined before the first `<<: *jwt-env` reference — YAML anchors are resolved top-to-bottom.)* Defining it once avoids the classic copy-paste bug of one service's secret silently drifting from the others.
4. **`mysql` service** — image `mysql:8.0`, `MYSQL_ROOT_PASSWORD` env var, port `3311:3306`, two volume mounts (the named volume for data + the init script from Gate 4 as read-only), and a `healthcheck` running `mysqladmin ping` every 10s. *(Written before `kafka` because `kafka` doesn't depend on it, but conventionally infra-first.)*
5. **`zookeeper` service** — `confluentinc/cp-zookeeper:7.6.0`, minimal env (`ZOOKEEPER_CLIENT_PORT`, `ZOOKEEPER_TICK_TIME`), healthcheck via `echo > /dev/tcp/localhost/2181` (a Bash-native TCP probe, since this image doesn't ship `nc`). *(Must be defined before `kafka`, which will reference it in `depends_on`.)*
6. **`kafka` service** — `confluentinc/cp-kafka:7.6.0`, `depends_on: zookeeper: condition: service_healthy` *(hard prerequisite — Kafka registers its broker metadata in Zookeeper on startup and will fail to become ready without it)*, and the trickiest config in the whole file — a **dual listener** setup:
   ```yaml
   KAFKA_LISTENERS: "PLAINTEXT://0.0.0.0:29092,PLAINTEXT_HOST://0.0.0.0:9092"
   KAFKA_ADVERTISED_LISTENERS: "PLAINTEXT://kafka:29092,PLAINTEXT_HOST://localhost:9095"
   KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: "PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT"
   KAFKA_INTER_BROKER_LISTENER_NAME: "PLAINTEXT"
   ```
   Container-to-container traffic (the 4 microservices talking to Kafka) uses `kafka:29092`; anything running on the host machine outside Docker (e.g. `dotnet run` during local development, or a Kafka UI tool) uses `localhost:9095`. Getting this wrong is the single most common mistake in any Kafka-in-Docker setup — a consumer configured with the wrong listener either can't connect at all, or connects but then gets handed unreachable broker addresses during the initial handshake (Kafka's client protocol always redirects a client to the *advertised* address for a given listener, so a container using the wrong listener name gets told to reconnect to an address it can't reach).
7. **Four microservice sections** (`studentservice`, `courseservice`, `enrollmentservice`, `notificationservice`) — *(must be defined last, since they `depends_on` everything above)*: `build: {context: ., dockerfile: Services/X/Dockerfile}` *(the `context: .` is what makes the Gate 3 `COPY` paths resolve from the repo root)*, `<<: *jwt-env` merged with service-specific `ConnectionStrings__DefaultConnection` / `Kafka__BootstrapServers` / `Kafka__ConsumerGroupId` / `Kafka__ClientId` (the `__` double-underscore is ASP.NET Core's built-in convention for mapping an environment variable to a nested `appsettings.json` key), `depends_on: {mysql: service_healthy, kafka: service_healthy}`, host port mapping, and a `healthcheck` hitting `curl -f http://localhost:8080/health`.

| | |
|---|---|
| **Verify** | `docker compose config` (validates YAML syntax + anchor resolution + variable interpolation without starting anything) exits 0 and prints the fully-resolved config. |
| **If skipped/wrong** | A malformed anchor reference (`*jwt-env` before `&jwt-env` is defined, or a typo in either) fails `docker compose config` immediately with `alias "jwt-env" not found` or similar — always run `docker compose config` before `docker compose up` on a freshly edited compose file. |

## Gate 6 — Build the images

| | |
|---|---|
| **Prerequisite** | Gates 2, 3, 5. Docker daemon running (Gate 0). Internet access for the *first* build (to pull `mcr.microsoft.com/dotnet/sdk:8.0`, `mcr.microsoft.com/dotnet/aspnet:8.0`, `mysql:8.0`, `confluentinc/cp-zookeeper:7.6.0`, `confluentinc/cp-kafka:7.6.0` base images — subsequent builds reuse the local image cache). |
| **Action** | `docker compose build` — run from the **repo root** (the same directory as `docker-compose.yml`), never from inside a `Services/X/` folder, because `context: .` in Gate 5 means "the directory `docker compose` was invoked from." |
| **Verify** | Console output shows all 4 images tagged, ending in something like `courseservice  Built` / `studentservice  Built` for each. `docker images | grep dotnet-student-mgmt` shows 4 new images. |
| **If skipped or run from the wrong directory** | Running from inside `Services/StudentService/` makes `context: .` mean *that* folder, so `COPY BuildingBlocks/ BuildingBlocks/` fails with `"/BuildingBlocks": not found` because that folder isn't inside the (wrong) build context at all. |

## Gate 7 — Start the stack and let health-check gating do its job

| | |
|---|---|
| **Prerequisite** | Gate 6 (images built) or let `docker compose up -d --build` do Gate 6 implicitly. |
| **Action** | `docker compose up -d` |
| **Verify** | `docker compose ps` — poll until every row reports `healthy` (not just `Up`). |
| **What's actually a hard vs. soft dependency here** | **MySQL healthy is a hard prerequisite for a service becoming healthy at all** — every service calls `db.Database.Migrate()` synchronously during startup (Part B, step ⑧), *before* `app.Run()`; if MySQL isn't reachable at that instant, `Migrate()` throws, the whole process crashes, and (because of `restart: unless-stopped`) Docker keeps restarting it in a crash loop until MySQL becomes reachable — which is exactly why `depends_on: mysql: condition: service_healthy` exists. **Kafka healthy is a *soft* prerequisite** — the Kafka .NET client connects lazily/asynchronously in the background, so a service actually finishes starting and serves HTTP traffic even if Kafka is briefly unreachable; publishes just queue up behind the Polly retry pipeline and Kafka consumers (`BackgroundService`s) log connection errors and keep retrying until the broker appears. We still `depends_on: kafka: service_healthy` anyway, purely so a fresh `docker compose up` doesn't spend its first 30 seconds emitting a wall of "broker unreachable" warnings for a broker we know is still starting. |
| **If skipped (i.e., you don't wait for "healthy" before testing)** | You'll intermittently get connection-refused or 502-style errors purely because Kestrel inside the container hasn't bound its port yet — not a real bug, just impatience. Always wait for `healthy`. |

## Gate 8 — Prove it with real requests, not just green healthchecks

| | |
|---|---|
| **Prerequisite** | Gate 7 — every container reports `healthy`. |
| **Action** | Drive the real stack with `curl`/Swagger: log in as the seeded admin, register a student, create a course, enroll, cancel, confirm notification history — across all 4 containers and Kafka, for real. |
| **Verify** | Each call returns the expected `2xx` + `ApiResponse<T>` shape; `docker compose logs <service>` shows the corresponding Kafka publish/consume lines. |
| **Why this gate exists even though 102 unit tests already pass** | `docker compose ps` reporting "healthy" only proves each container's own healthcheck passed — it does **not** prove the services can actually talk to each other, or that ASP.NET Core's routing engine agrees with what your controller code assumes. This is exactly the gate that caught two real bugs unit tests could not: |

**⚠ Real issues this gate actually caught:**
1. `CoursesController.CreateAsync` used `CreatedAtAction(nameof(GetByIdAsync), new { id }, response)`, which crashed at runtime with `InvalidOperationException: No route matches the supplied values` — because the route is API-versioned (`api/v{version:apiVersion}/courses/{id}`) and `CreatedAtAction` needs every route parameter, including `version`, to generate the response's `Location` header. **Fixed** by switching to `Created($"/api/v1/courses/{course.Id}", response)`, which sets `Location` from a literal string and never asks the router to generate anything.
2. `AuthResponse` only returned `UserId` (the login/`ApplicationUser` id), but `enrollment-service` needs the separate `Student.Id` — a real caller trying to register-then-enroll had no way to get the id it needed. **Fixed** by adding a `StudentId` field, populated from the student record created during registration (or looked up by `UserId` on login/refresh).

Both fixes required going back through the earlier gates in miniature: edit the C# → **Gate 2** (`dotnet build`/`dotnet test` locally, green) → **Gate 6** (`docker compose build <service>`) → **Gate 7** (`docker compose up -d <service>`, which recreates just that one container — the others keep running undisturbed) → **Gate 8** again (re-verify with `curl`).

## Gate 9 — Operational prerequisite chains you'll hit once the stack is actually running

These aren't deployment steps, but they're "mandatory before X" facts about *using* the running system that are easy to trip over:

| Before you can... | You must first have... | Why |
|---|---|---|
| Call any `[Authorize]`-protected endpoint on **any** of the 4 services | A valid JWT from **`student-service`'s** `/auth/login` or `/auth/register` | Only `student-service` issues tokens; the other 3 only validate them. |
| Successfully enroll a student in a course | Waited a few seconds after creating that student **and** that course | `enrollment-service` validates against its own local `StudentSnapshot`/`CourseSnapshot`, populated asynchronously by consuming `student.created`/`course.created` from Kafka — see §11 of the beginner's guide. Enrolling immediately after creating a *brand-new* student/course can 404 with "not found" simply because the event hasn't been consumed yet (worse on a fresh environment — see the Kafka topic-auto-creation note in the beginner's guide §16). |
| Run `dotnet ef migrations add <Name>` for a service | (a) the `dotnet-ef` global tool installed, matching the `Microsoft.EntityFrameworkCore.Design` package version in that service's `.csproj`; (b) a MySQL instance actually reachable at the connection string in that service's `appsettings.json` (either the docker-compose `mysql` on `localhost:3311`, or a throwaway local container) | EF Core's design-time tooling needs to both compile a design-time instance of your `DbContext` *and*, depending on the operation, actually connect to compare against the live schema. |
| Rebuild just one service after a code fix | A **green `dotnet build`/`dotnet test` run outside Docker first** (Gate 2, repeated) | Confirming the fix locally in seconds, instead of waiting through a full Docker image rebuild only to discover the same compiler error. |

## Step 10 — Day-to-day commands reference

```bash
docker compose logs -f studentservice        # tail one service's logs
docker compose restart courseservice          # restart one container without rebuilding
docker compose build enrollmentservice        # rebuild one image after a code change
docker compose up -d enrollmentservice        # recreate just that one container with the new image
docker compose stop                            # stop everything, keep containers + data
docker compose down                            # stop and remove containers, keep named volumes (data)
docker compose down -v                         # stop, remove containers AND delete all data (fresh start)
```

---

# Part B — Application Startup Flow (Entry Point → Ready)

## B.1 — The outer entry point: `docker compose up -d`

This is the true "start everything" entry point for the whole system. Compose reads the `depends_on` conditions in `docker-compose.yml` and starts containers in this order:

```
1. mysql            starts → runs sql/init-databases.sql (first boot only) → healthcheck polls mysqladmin ping → HEALTHY
2. zookeeper         starts in parallel with mysql (no dependency between them) → healthcheck → HEALTHY
3. kafka             waits for zookeeper HEALTHY → starts, registers itself with zookeeper → healthcheck → HEALTHY
4. studentservice, courseservice, notificationservice
                     all three wait for mysql AND kafka HEALTHY → start in parallel
5. enrollmentservice waits for mysql, kafka HEALTHY, and student/course to have merely started
                     (a soft ordering hint for readability — it doesn't call them over HTTP, so it
                     doesn't strictly need them "healthy", just doesn't need to race their container creation)
```

## B.2 — The real entry point inside every container: `Program.cs`

Every one of the 4 services has the exact same `Program.cs` skeleton (top-level statements — no `Main` method, no `Startup.cs`; this is the modern minimal-hosting-model style). Using `Services/StudentService/Program.cs` as the fully-annotated example (the other 3 are identical except for the lines marked *[Student only]* / *[Enrollment+Notification only]*):

```csharp
var builder = WebApplication.CreateBuilder(args);
```
**① First line, first thing that runs.** Reads `appsettings.json`, then `appsettings.{ASPNETCORE_ENVIRONMENT}.json`, then environment variables — in that precedence order, each one able to override keys from the one before it. This is *how* `docker-compose.yml`'s `ConnectionStrings__DefaultConnection` environment variable silently replaces the `localhost:3311` value baked into `appsettings.json` with `mysql:3306`, with zero `if (running in Docker)` branches anywhere in the C# code.

```csharp
builder.Host.UseAppSerilog("StudentService");
```
**② Logging configured before anything else,** deliberately — so that even a crash during the *next* steps (e.g. a bad connection string) gets written to the console and `logs/` folder instead of vanishing.

```csharp
builder.Services.AddControllers();
builder.Services.AddAppApiVersioning();
builder.Services.AddAppSwagger("Student Service API");
builder.Services.AddAppCors(builder.Configuration);
builder.Services.AddJwtAuthentication(builder.Configuration);   // registers Singleton IJwtTokenService, IPasswordHasher
builder.Services.AddKafkaMessaging(builder.Configuration);       // registers Singleton IEventProducer, IDeadLetterPublisher
builder.Services.AddSharedCommonServices();                      // registers Singleton ICacheService
builder.Services.AddAutoMapper(typeof(Program));
builder.Services.AddValidatorsFromAssemblyContaining<Program>(); // scans this assembly for every AbstractValidator<T>
```
**③ Cross-cutting DI registration** — everything from `BuildingBlocks/`, registered identically in every service by calling the same shared extension methods.

```csharp
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")!;
builder.Services.AddDbContext<StudentDbContext>(options =>
    options.UseMySql(connectionString, new MySqlServerVersion(new Version(8, 0, 36))));
builder.Services.AddAppHealthChecks(connectionString, builder.Configuration["Kafka:BootstrapServers"]!);
```
**④ This service's own database** — `AddDbContext` registers `StudentDbContext` as **Scoped** by default (one instance per HTTP request; see §9 of the beginner's guide for why this must never be Singleton). Health checks are wired to the *real* connection string and Kafka address so `GET /health` genuinely proves both dependencies are reachable, not just that the process is alive.

```csharp
builder.Services.AddScoped<IStudentRepository, StudentRepository>();
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IRoleRepository, RoleRepository>();
builder.Services.AddScoped<IRefreshTokenRepository, RefreshTokenRepository>();
builder.Services.AddScoped<IStudentUnitOfWork, StudentUnitOfWork>();
builder.Services.AddScoped<IStudentAppService, StudentAppService>();
builder.Services.AddScoped<IAuthService, AuthService>();          // [Student only]
builder.Services.AddScoped<StudentEventPublisher>();
```
**⑤ This service's own business logic** — everything specific to *this* service, all Scoped (safe to hold a reference to the request-scoped `DbContext`).

*[Enrollment + Notification only]* one extra line each:
```csharp
builder.Services.AddHostedService<StudentEventsConsumer>();   // EnrollmentService
builder.Services.AddHostedService<CourseEventsConsumer>();    // EnrollmentService
builder.Services.AddHostedService<UpstreamEventsConsumer>();  // NotificationService
```
`AddHostedService<T>` registers a `BackgroundService` that ASP.NET Core starts automatically alongside the web server — this is what turns the Kafka consumer loop on.

```csharp
var app = builder.Build();
```
**⑥ The DI container is actually constructed here.** Every registration from steps ③–⑤ is validated and wired together at this exact line — a missing or circular dependency throws here (or on first resolution), not later.

```csharp
app.UseSharedMiddlewares();     // CorrelationId -> RequestResponseLogging -> ExceptionHandling, in that order
app.UseCors(CorsServiceExtensions.PolicyName);
app.UseSwagger();
app.UseSwaggerUI();
app.UseAuthentication();         // "who are you" — validates the JWT if one was sent
app.UseAuthorization();          // "are you allowed" — checks [Authorize]/policy requirements
app.MapControllers();            // wires up every [ApiController] found in this assembly
app.MapHealthChecks("/health");
```
**⑦ The middleware pipeline is assembled, in this exact order** (§14 of the beginner's guide explains why order matters here — e.g. `ExceptionHandlingMiddleware` must wrap everything downstream of it to catch failures anywhere in the pipeline, including inside `UseAuthorization`).

```csharp
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<StudentDbContext>();
    db.Database.Migrate();                                  // applies any pending EF Core migration, for real, right now
    await DbSeeder.SeedAsync(scope.ServiceProvider);         // [Student only] seeds Admin/Faculty/Student roles + 1 admin user
}
```
**⑧ Schema is guaranteed up to date before the app starts accepting traffic.** This is *why* nobody runs `dotnet ef database update` by hand in Docker — every container does it to itself, idempotently, on every startup (`Migrate()` is a no-op if there's nothing pending). `DbSeeder.SeedAsync` checks for existing rows before inserting, so restarting the container never creates duplicate roles or a second admin user.

```csharp
app.Run();
```
**⑨ The last line — this is the actual "now serving traffic" moment.** Kestrel starts listening on `http://+:8080` (mapped by `docker-compose.yml` to the host port), and every `IHostedService` registered in step ⑤ (the Kafka consumers) starts its background loop around this same point. Once Kestrel has bound the port, the container's `HEALTHCHECK` (`curl http://localhost:8080/health`) starts succeeding and `docker compose ps` flips that row to "healthy."

## B.3 — Running one service outside Docker (local dev entry point)

```bash
docker compose up -d mysql zookeeper kafka   # infrastructure only
cd Services/StudentService
dotnet run                                    # same Program.cs, same 9 steps above — just reads localhost:3311/localhost:9095 from appsettings.json directly instead of docker-compose's environment-variable overrides
```

---

# Part C — File-by-File Reference

## C.1 — Root-level files

| File | Purpose |
|---|---|
| `StudentManagement.sln` | Visual Studio / `dotnet` solution file listing all 11 projects (3 BuildingBlocks + 4 services + 4 test projects) so `dotnet build`/`dotnet test` can operate on everything at once. |
| `Directory.Build.props` | One shared MSBuild properties file (auto-imported by every `.csproj` under this folder) setting `TargetFramework=net8.0`, `Nullable=enable`, `ImplicitUsings=enable` once instead of repeating it in 11 project files. |
| `docker-compose.yml` | Defines and wires together all 7 containers (see Part A, Step 4). |
| `sql/init-databases.sql` | Creates the 4 empty databases on MySQL's first boot (see Part A, Step 3). |
| `.gitignore` | Excludes `bin/`, `obj/`, `logs/`, test results, and local Docker volume data from version control. |
| `README.md` | Practical quick-start reference — prerequisites, run commands, Swagger URLs, troubleshooting. |

## C.2 — `BuildingBlocks/StudentMgmt.BuildingBlocks.Contracts/` — shared "vocabulary"

| File | Purpose |
|---|---|
| `Events/IntegrationEvent.cs` | Abstract base every Kafka event inherits — carries `EventId`, `OccurredOnUtc`, `CorrelationId` automatically. |
| `Events/StudentEvents.cs` | `StudentCreatedEvent`, `StudentUpdatedEvent`, `StudentDeletedEvent` — published by `student-service`. |
| `Events/CourseEvents.cs` | `CourseCreatedEvent`, `CourseUpdatedEvent`, `CourseDeletedEvent` — published by `course-service`. |
| `Events/EnrollmentEvents.cs` | `EnrollmentCreatedEvent`, `EnrollmentCancelledEvent` — published by `enrollment-service`. |
| `Events/NotificationEvents.cs` | `NotificationChannel` enum, `NotificationRequestedEvent` (in), `NotificationSentEvent` (out) — used by `notification-service`. |
| `KafkaTopics.cs` | The single source of truth for every topic name string (`student.created`, etc.) plus `DeadLetterFor(topic)` for `.dlq` topic names. |
| `Common/ApiResponse.cs` | The `{ success, message, data, errors, correlationId }` envelope every controller action returns. |
| `Common/PagedResult.cs` | The `{ items, pageNumber, pageSize, totalCount, ... }` envelope every "list" endpoint returns. |
| `Common/PagedRequest.cs` | The `{ pageNumber, pageSize, sortBy, sortDescending, searchTerm }` query-string binding every "list" endpoint accepts. |

## C.3 — `BuildingBlocks/StudentMgmt.BuildingBlocks.Messaging/` — Kafka plumbing

| File | Purpose |
|---|---|
| `KafkaSettings.cs` | Options-pattern POCO bound from each service's own `"Kafka"` config section. |
| `IEventProducer.cs` / `KafkaEventProducer.cs` | The Singleton (§9 of beginner's guide) that publishes events, wrapped in a Polly retry pipeline with exponential backoff. |
| `IDeadLetterPublisher.cs` / `DeadLetterPublisher.cs` | Singleton that republishes a message to `<topic>.dlq` after every consumer-side retry is exhausted. |
| `KafkaConsumerBase.cs` | Abstract `BackgroundService` every consumer inherits — owns the whole consume loop, per-message retry, manual offset commit, and dead-lettering, so a concrete consumer only implements `Topics` and `HandleMessageAsync`. |
| `ServiceCollectionExtensions.cs` | `AddKafkaMessaging(configuration)` — the one line each `Program.cs` calls to wire up all of the above. |

## C.4 — `BuildingBlocks/StudentMgmt.BuildingBlocks.Common/` — everything else shared

| Folder/File | Purpose |
|---|---|
| `Entities/BaseEntity.cs` | Every entity in every service inherits this: `Id`, audit fields (`CreatedDate`/`CreatedBy`/`UpdatedDate`/...), soft-delete fields (`IsDeleted`/`DeletedDate`/...), `RowVersion` concurrency token. |
| `Repositories/IRepository.cs` / `RepositoryBase.cs` | The generic Repository pattern contract + EF Core implementation (§8 of beginner's guide). |
| `Repositories/IUnitOfWork.cs` / `UnitOfWorkBase.cs` | The generic Unit of Work contract + transaction-handling implementation (§8). |
| `Exceptions/AppExceptions.cs` | `NotFoundException`, `BusinessRuleException`, `ValidationAppException`, `AuthenticationFailedException`, `ForbiddenException`, `DatabaseOperationException`, `MessagingException` — every custom exception type, each mapped to a specific HTTP status by `ExceptionHandlingMiddleware`. |
| `Middlewares/CorrelationIdMiddleware.cs` | Mints/propagates the `X-Correlation-Id` used to trace one request across every log line. |
| `Middlewares/RequestResponseLoggingMiddleware.cs` | Logs every inbound request and outgoing response as structured Serilog events. |
| `Middlewares/ExceptionHandlingMiddleware.cs` | Global exception handler — turns any thrown exception into the right HTTP status + `ApiResponse<T>` body. |
| `Security/JwtSettings.cs` | Options-pattern POCO bound from each service's own `"Jwt"` config section (must be identical across all 4 — §6). |
| `Security/IJwtTokenService.cs` / `JwtTokenService.cs` | Singleton that mints and validates JWTs. |
| `Security/IPasswordHasher.cs` | Singleton BCrypt wrapper. |
| `Constants/RoleConstants.cs` | `Admin`/`Faculty`/`Student` role name constants, and `PolicyConstants` (`AdminOnly`, `CanManageCourses`, `CanManageStudents`, `CanEnroll`). |
| `Caching/ICacheService.cs` | Singleton in-memory cache (thread-safe `ConcurrentDictionary`-backed). |
| `Extensions/CorsServiceExtensions.cs` | `AddAppCors(configuration)` — allows configured origins + localhost dev ports (Angular/React/Next.js) by default. |
| `Extensions/SwaggerServiceExtensions.cs` | `AddAppSwagger(title)` — adds Swagger with a JWT "Authorize" button pre-wired. |
| `Extensions/JwtAuthenticationServiceExtensions.cs` | `AddJwtAuthentication(configuration)` — registers the JwtBearer handler + the 4 authorization policies, identically in every service. |
| `Extensions/SerilogHostExtensions.cs` | `UseAppSerilog(serviceName)` — console + rolling-file Serilog sinks with structured, correlation-id-tagged output. |
| `Extensions/HealthCheckServiceExtensions.cs` | `AddAppHealthChecks(connectionString, kafkaBootstrapServers)` — wires MySQL + Kafka + "is the app alive" checks to `/health`. |
| `Extensions/ApiVersioningServiceExtensions.cs` | `AddAppApiVersioning()` — URL-segment versioning (`/api/v1/...`), ready for a future `/api/v2/...`. |
| `Extensions/CommonServiceExtensions.cs` | `AddSharedCommonServices()` (registers the cache Singleton) and `UseSharedMiddlewares()` (registers the 3 middlewares above, in order). |

## C.5 — Inside every microservice (common shape — using `StudentService` as the fully-annotated example)

| Folder/File | Purpose |
|---|---|
| `StudentService.csproj` | Project file — SDK `Microsoft.NET.Sdk.Web`, references the 3 BuildingBlocks projects + Pomelo MySQL, AutoMapper, FluentValidation packages. |
| `Program.cs` | The composition root — see Part B.2 for the full line-by-line walkthrough. |
| `appsettings.json` / `appsettings.Development.json` | Connection string, JWT secret, Kafka settings, CORS origins — all overridable by environment variables in Docker. |
| `Dockerfile` | This service's own 4-stage container build (Part A, Step 2). |
| `Controllers/AuthController.cs` | `/api/v1/auth/*` — register, login, refresh, revoke, whoami. **[Student only — the identity owner]** |
| `Controllers/StudentsController.cs` | `/api/v1/students/*` — Student CRUD + profile. |
| `Entities/Student.cs` | The Student domain entity (name, email, DOB, enrollment number, linked `UserId`). |
| `Entities/ApplicationUser.cs`, `Role.cs`, `UserRole.cs`, `RefreshToken.cs` | The identity/auth schema — login credentials, roles, the many-to-many role assignment, and refresh tokens. **[Student only]** |
| `Persistence/StudentDbContext.cs` | EF Core `DbContext` — one `DbSet<T>` per entity above, applies every `IEntityTypeConfiguration<T>` in the assembly. |
| `Persistence/Configurations/*.cs` | One Fluent API configuration class per entity — indexes, max lengths, uniqueness constraints, concurrency token setup. |
| `Persistence/Migrations/*.cs` | The real, generated-and-applied EF Core migration(s) that create this service's tables. |
| `Persistence/Seed/DbSeeder.cs` | Seeds the 3 roles + one Admin user (`admin@studentmgmt.local` / `Admin@12345`), idempotently. **[Student only]** |
| `Repositories/Interfaces/*.cs` + `Repositories/*.cs` | One repository interface + implementation per entity (Repository pattern, §8). |
| `UnitOfWork/IStudentUnitOfWork.cs` / `StudentUnitOfWork.cs` | Groups all of this service's repositories behind one transactional boundary (Unit of Work, §8). |
| `Services/Interfaces/IStudentAppService.cs` / `StudentAppService.cs` | Application/business logic for Student CRUD — validation, repository calls, event publishing. |
| `Services/Interfaces/IAuthService.cs` / `AuthService.cs` | Register/login/refresh/revoke business logic, including the transactional register flow (§8.2). **[Student only]** |
| `Services/EnrollmentNumberGenerator.cs` | Small static helper producing `STU-{year}-{6 digits}` enrollment numbers. **[Student only]** |
| `Kafka/Producers/StudentEventPublisher.cs` | Thin wrapper around `IEventProducer` exposing `PublishStudentCreatedAsync`/`Updated`/`Deleted`. |
| `DTOs/Requests/*.cs` | Request shapes (`CreateStudentRequest`, `RegisterRequest`, `LoginRequest`, ...) — never bind directly to an entity. |
| `DTOs/Responses/*.cs` | Response shapes (`StudentResponse`, `AuthResponse`) — never expose an entity directly over HTTP. |
| `Validators/*.cs` | One FluentValidation `AbstractValidator<T>` per request DTO. |
| `Mappings/StudentProfile.cs` | AutoMapper `Profile` — `Student` entity → `StudentResponse` DTO. |

**What's different in the other 3 services** (everything else follows the exact same shape):

- **`CourseService`** — no `Kafka/Consumers/` folder (produces `course.*` events, consumes nothing); no identity entities.
- **`EnrollmentService`** — has both `Kafka/Producers/EnrollmentEventPublisher.cs` **and** `Kafka/Consumers/{StudentEventsConsumer,CourseEventsConsumer}.cs`; its `Entities/` folder has `Enrollment.cs` plus the two local read-model entities `StudentSnapshot.cs`/`CourseSnapshot.cs`; `Services/SnapshotSyncService.cs` is the class the two consumers call into (§11 of the beginner's guide).
- **`NotificationService`** — `Kafka/Consumers/UpstreamEventsConsumer.cs` subscribes to 4 topics from 3 different upstream services at once; `Services/Senders/` holds the three mocked channel senders (`SmtpMockEmailSender`, `MockSmsSender`, `MockPushSender`); no `UnitOfWork`-level business transaction logic beyond a single-entity save (no multi-step register-style flow).

---

# Part D — Endpoint Lifecycle Reference

## D.1 — Every endpoint, at a glance

| Service | Method & Route | Auth Policy | What it does |
|---|---|---|---|
| student-service | `POST /api/v1/auth/register` | none | Create login + (usually) linked Student, issue JWT |
| student-service | `POST /api/v1/auth/login` | none | Verify credentials, issue JWT |
| student-service | `POST /api/v1/auth/refresh-token` | none (token itself is the credential) | Exchange a valid refresh token for a new access+refresh pair |
| student-service | `POST /api/v1/auth/revoke-token` | `[Authorize]` (any logged-in user) | Revoke a refresh token |
| student-service | `GET /api/v1/auth/whoami` | `[Authorize]` | Echo back the caller's own JWT claims |
| student-service | `POST /api/v1/students` | `CanManageStudents` (Admin/Faculty) | Create a Student record directly (no login created) |
| student-service | `PUT /api/v1/students/{id}` | `CanManageStudents` | Update a Student |
| student-service | `DELETE /api/v1/students/{id}` | `CanManageStudents` | Soft-delete a Student |
| student-service | `GET /api/v1/students/{id}` | any authenticated | Get one Student |
| student-service | `GET /api/v1/students` | any authenticated | Paged/sorted/searched list of Students |
| student-service | `GET /api/v1/students/{id}/profile` | any authenticated | Get one Student's profile view |
| course-service | `POST /api/v1/courses` | `CanManageCourses` (Admin/Faculty) | Create a Course |
| course-service | `PUT /api/v1/courses/{id}` | `CanManageCourses` | Update a Course |
| course-service | `DELETE /api/v1/courses/{id}` | `CanManageCourses` | Soft-delete a Course |
| course-service | `GET /api/v1/courses/{id}` | any authenticated | Get one Course |
| course-service | `GET /api/v1/courses` | any authenticated | Paged/sorted/searched list of Courses |
| enrollment-service | `POST /api/v1/enrollments` | `CanEnroll` (Admin/Faculty/Student) | Enroll a student in a course |
| enrollment-service | `POST /api/v1/enrollments/{id}/cancel` | `CanEnroll` | Cancel an enrollment |
| enrollment-service | `GET /api/v1/enrollments/students/{studentId}/history` | `CanEnroll` | A student's full enrollment history |
| enrollment-service | `GET /api/v1/enrollments/{id}/status` | `CanEnroll` | One enrollment's current status |
| enrollment-service | `GET /api/v1/enrollments` | `CanEnroll` | Paged list of all enrollments |
| notification-service | `GET /api/v1/notifications/{id}` | any authenticated | Get one notification history record |
| notification-service | `GET /api/v1/notifications` | any authenticated | Paged list of notification history |
| notification-service | `POST /api/v1/notifications/test-send` | `AdminOnly` | Manually trigger a (mocked) notification, bypassing Kafka |

Every single one of these shares the same first two and last one hops:

> **Every request, first:** `BuildingBlocks/.../Middlewares/CorrelationIdMiddleware.cs` mints/reads the correlation id → `BuildingBlocks/.../Middlewares/RequestResponseLoggingMiddleware.cs` logs "request started" → ASP.NET Core's built-in JWT handler (configured once at startup by `BuildingBlocks/.../Extensions/JwtAuthenticationServiceExtensions.cs`, not re-read per request) validates the token signature/expiry → its built-in authorization middleware checks the `[Authorize(Policy = ...)]` on the matched action (401 if no/invalid token, 403 if valid token but wrong role) → the controller action itself runs.
> **Every request, last:** the controller returns an `ApiResponse<T>` (or throws, which `BuildingBlocks/.../Middlewares/ExceptionHandlingMiddleware.cs` converts to the right status code + `ApiResponse<T>` error body, consulting `BuildingBlocks/.../Exceptions/AppExceptions.cs` to know which HTTP status each exception type maps to) → `RequestResponseLoggingMiddleware.cs` logs "request completed" with status + elapsed time.

Below, **4 endpoints per service** (3 HTTP + 1 background flow for `notification-service`, which only exposes 3 HTTP endpoints) are traced with **every file** the request's code actually executes, in the order it executes them. Files already covered in the "every request" preamble above aren't repeated in each table.

## D.2 — `student-service`

### 1. `POST /api/v1/auth/register` — the richest endpoint in the whole system

**Auth:** none (anonymous) · **Flow:** validate → check email → transaction (user + role + student) → fire-and-forget Kafka publish → mint JWT → persist refresh token → respond

| # | File | Role in this specific request |
|---|---|---|
| 1 | `Controllers/AuthController.cs` | `Register` action receives the HTTP call, model-binds the body, calls `IAuthService.RegisterAsync`. |
| 2 | `DTOs/Requests/RegisterRequest.cs` | The class the request body is deserialized into (`FirstName`, `LastName`, `Email`, `Password`, `PhoneNumber?`, `DateOfBirth?`, `Role?`). |
| 3 | `Services/Interfaces/IAuthService.cs` | The interface the controller depends on — DI resolves it to the concrete `AuthService` below. |
| 4 | `Services/AuthService.cs` (`RegisterAsync`) | Orchestrates every remaining step in this table. |
| 5 | `Validators/RegisterRequestValidator.cs` | FluentValidation rules run first (email format, password ≥8 chars with a digit, etc.). |
| 6 | `BuildingBlocks/.../Exceptions/AppExceptions.cs` (`ValidationAppException`) | Thrown here (→ 400) if step 5 fails; execution stops. |
| 7 | `UnitOfWork/IStudentUnitOfWork.cs` / `UnitOfWork/StudentUnitOfWork.cs` | The transactional boundary for everything that follows. |
| 8 | `Repositories/Interfaces/IUserRepository.cs` / `Repositories/UserRepository.cs` | `EmailExistsAsync` check (→ `BusinessRuleException`, 409, if taken); later, `AddAsync(user)` and `AssignRoleAsync(userId, roleId)`. |
| 9 | `Entities/ApplicationUser.cs` | The entity instantiated with the (hashed) password and email. |
| 10 | `BuildingBlocks/.../Security/IPasswordHasher.cs` (`BCryptPasswordHasher`) | `Hash(request.Password)` called before the entity above is built. |
| 11 | `Repositories/Interfaces/IRoleRepository.cs` / `Repositories/RoleRepository.cs` | `GetByNameAsync(roleName)` — defaults to `"Student"` if `request.Role` is blank; `BusinessRuleException` if the role name doesn't exist. |
| 12 | `Entities/Role.cs` | The looked-up role row. |
| 13 | `Entities/UserRole.cs` | The join-table row created linking the new user to that role. |
| 14 | `Entities/Student.cs` | Created **only if** the role is `"Student"` — `FirstName`/`LastName`/`Email`/`PhoneNumber`/`DateOfBirth`/`EnrollmentNumber`/`UserId`. |
| 15 | `Services/EnrollmentNumberGenerator.cs` | Generates the `STU-2026-######` value assigned to the `Student` above. |
| 16 | `Repositories/Interfaces/IStudentRepository.cs` / `Repositories/StudentRepository.cs` | `AddAsync(student)`. |
| 17 | `BuildingBlocks/.../Repositories/UnitOfWorkBase.cs` | `BeginTransactionAsync()` was called before step 8; `CommitTransactionAsync()` runs now (or `RollbackTransactionAsync()` on any exception from steps 8-16). |
| 18 | `Persistence/StudentDbContext.cs` | The actual `SaveChanges` call inside the transaction — this is where the `INSERT` statements are generated and sent to MySQL. |
| 19 | `Persistence/Configurations/ApplicationUserConfiguration.cs`, `RoleConfiguration.cs`, `UserRoleConfiguration.cs`, `StudentConfiguration.cs` | Consulted by EF Core (not called directly by our code) to know exact table/column names, max lengths, and uniqueness constraints when building those `INSERT` statements. |
| 20 | `Kafka/Producers/StudentEventPublisher.cs` | `PublishStudentCreatedAsync(student)` — but see note below, this runs detached, *after* the HTTP response path has already moved on. |
| 21 | `BuildingBlocks/.../Contracts/Events/StudentEvents.cs` (`StudentCreatedEvent`) | The event object constructed inside step 20, from the just-created `Student`. |
| 22 | `BuildingBlocks/.../Contracts/KafkaTopics.cs` | Supplies the `"student.created"` topic name constant used by step 20. |
| 23 | `BuildingBlocks/.../Messaging/IEventProducer.cs` / `KafkaEventProducer.cs` | The actual Kafka publish, wrapped in a Polly retry pipeline. |
| 24 | `BuildingBlocks/.../Security/IJwtTokenService.cs` / `JwtTokenService.cs` | `GenerateToken(userId, email, fullName, roles)` — mints the access+refresh token pair. |
| 25 | `Repositories/Interfaces/IRefreshTokenRepository.cs` / `Repositories/RefreshTokenRepository.cs` | `AddAsync` persists the new refresh token. |
| 26 | `Entities/RefreshToken.cs` | The entity persisted in step 25. |
| 27 | `DTOs/Responses/AuthResponse.cs` | The response shape built — `AccessToken`, `RefreshToken`, `UserId`, `Email`, `FullName`, `Roles[]`, and `StudentId` (only set if step 14 ran). |
| 28 | `Controllers/AuthController.cs` (again) | Wraps the `AuthResponse` in `ApiResponse<AuthResponse>.Ok(...)`. |
| 29 | `BuildingBlocks/.../Contracts/Common/ApiResponse.cs` | The envelope class used in step 28. |

**Why step 20 says "detached, after the response path has moved on":** `StudentAppService`/`AuthService` publish via a private `PublishFireAndForget` helper that wraps the call in `_ = Task.Run(async () => { try { await publish(...); } catch { log }; })` — the HTTP response in step 27-29 does **not** wait for step 20-23 to finish. This exists because `KafkaEventProducer.PublishAsync` can block for a long time if the broker is briefly unreachable, and the database write (steps 7-19) is already the source of truth by the time this runs.

### 2. `POST /api/v1/auth/login`

**Auth:** none (anonymous — the credentials *are* the auth) · **Flow:** validate → look up + verify → mint JWT → look up linked Student → respond

| # | File | Role in this specific request |
|---|---|---|
| 1 | `Controllers/AuthController.cs` | `Login` action. |
| 2 | `DTOs/Requests/LoginRequest.cs` | `Email` + `Password` binding target. |
| 3 | `Services/AuthService.cs` (`LoginAsync`) | Orchestrator. |
| 4 | `Validators/LoginRequestValidator.cs` | Required-field/format checks. |
| 5 | `Repositories/Interfaces/IUserRepository.cs` / `Repositories/UserRepository.cs` | `GetByEmailWithRolesAsync(email)` — a joined query across `ApplicationUser`/`UserRole`/`Role`. |
| 6 | `Entities/ApplicationUser.cs`, `Entities/UserRole.cs`, `Entities/Role.cs` | The three entities that query in step 5 reads. |
| 7 | `BuildingBlocks/.../Security/IPasswordHasher.cs` | `Verify(request.Password, user.PasswordHash)`. |
| 8 | `BuildingBlocks/.../Exceptions/AppExceptions.cs` (`AuthenticationFailedException`) | Thrown (→ 401, deliberately generic "Invalid email or password.") if the user isn't found *or* the password doesn't verify — the same message either way, so a caller can't use this endpoint to enumerate valid emails. |
| 9 | `BuildingBlocks/.../Security/IJwtTokenService.cs` / `JwtTokenService.cs` | Mints a new access+refresh pair. |
| 10 | `Repositories/Interfaces/IRefreshTokenRepository.cs` / `Repositories/RefreshTokenRepository.cs` | Persists the new refresh token. |
| 11 | `Entities/RefreshToken.cs` | The entity from step 10. |
| 12 | `Repositories/Interfaces/IStudentRepository.cs` / `Repositories/StudentRepository.cs` | `FindAsync(s => s.UserId == user.Id)` — looks up the linked Student (if any) purely to populate `AuthResponse.StudentId`. |
| 13 | `Persistence/StudentDbContext.cs` | `CommitAsync` persists the refresh token from step 10. |
| 14 | `DTOs/Responses/AuthResponse.cs` | Response built. |
| 15 | `Controllers/AuthController.cs` / `BuildingBlocks/.../Contracts/Common/ApiResponse.cs` | Wrapped and returned. |

*(No `UnitOfWork/StudentUnitOfWork.cs` transaction here — unlike register, login is a single `CommitAsync`, not a multi-entity `BeginTransactionAsync`/`CommitTransactionAsync` block, since only one new row — the refresh token — is written.)*

### 3. `POST /api/v1/students` — admin creates a Student directly (no login)

**Auth:** `[Authorize(Policy = PolicyConstants.CanManageStudents)]` (Admin/Faculty) · **Flow:** validate → uniqueness check → save → publish → respond `201`

| # | File | Role in this specific request |
|---|---|---|
| 1 | `Controllers/StudentsController.cs` | `Create` action; note the class-level `[Authorize]` plus this action's own `[Authorize(Policy = PolicyConstants.CanManageStudents)]`. |
| 2 | `BuildingBlocks/.../Constants/RoleConstants.cs` (`PolicyConstants.CanManageStudents`) | The policy name referenced by the attribute in step 1 — resolved against the policy registered at startup in `JwtAuthenticationServiceExtensions.cs`. |
| 3 | `DTOs/Requests/CreateStudentRequest.cs` | Binding target. |
| 4 | `Services/Interfaces/IStudentAppService.cs` / `Services/StudentAppService.cs` (`CreateAsync`) | Orchestrator. |
| 5 | `Validators/CreateStudentRequestValidator.cs` | Injected into `StudentAppService`'s constructor as `IValidator<CreateStudentRequest>`; `ValidateAsync` runs first. |
| 6 | `Repositories/Interfaces/IStudentRepository.cs` / `Repositories/StudentRepository.cs` | `EmailExistsAsync` (→ `BusinessRuleException`, 409, if taken); later `AddAsync(student)`. |
| 7 | `Entities/Student.cs` | The entity constructed from the request. |
| 8 | `Services/EnrollmentNumberGenerator.cs` | Generates the enrollment number. |
| 9 | `UnitOfWork/IStudentUnitOfWork.cs` / `UnitOfWork/StudentUnitOfWork.cs` | `CommitAsync` (a single commit here — no multi-step transaction needed, only one entity is written). |
| 10 | `Persistence/StudentDbContext.cs` + `Persistence/Configurations/StudentConfiguration.cs` | The actual `INSERT`. |
| 11 | `Kafka/Producers/StudentEventPublisher.cs` (`PublishStudentCreatedAsync`) | Same fire-and-forget mechanism as register's step 20 — the **same** `StudentCreatedEvent` type, so downstream consumers (enrollment-service's snapshot sync, notification-service's welcome email) can't tell whether a student came from this endpoint or from register. |
| 12 | `BuildingBlocks/.../Contracts/Events/StudentEvents.cs`, `KafkaTopics.cs`, `Messaging/KafkaEventProducer.cs` | Same roles as register's steps 21-23. |
| 13 | AutoMapper: `Mappings/StudentProfile.cs` | `_mapper.Map<StudentResponse>(student)` — converts the entity to the response DTO (this endpoint, unlike register, uses AutoMapper instead of hand-building the response). |
| 14 | `Controllers/StudentsController.cs` | Wraps the mapped response and returns `Created($"/api/v1/students/{id}", ...)` — see Part A, Gate 8 for why this is a literal string and not `CreatedAtAction`. |
| 15 | `BuildingBlocks/.../Contracts/Common/ApiResponse.cs` | Envelope. |

### 4. `GET /api/v1/students` — paged/sorted/searched list

**Auth:** `[Authorize]` (any authenticated role) · **Flow:** bind query → build filter/sort delegates → generic paged query → map → respond

| # | File | Role in this specific request |
|---|---|---|
| 1 | `Controllers/StudentsController.cs` | `GetPaged` action, binds `[FromQuery] PagedRequest`. |
| 2 | `BuildingBlocks/.../Contracts/Common/PagedRequest.cs` | The query-string binding target — `PageNumber`, `PageSize` (clamped 1-100), `SortBy`, `SortDescending`, `SearchTerm`. |
| 3 | `Services/Interfaces/IStudentAppService.cs` / `Services/StudentAppService.cs` (`GetPagedAsync`) | Builds a `Func<IQueryable<Student>, IOrderedQueryable<Student>>` from `SortBy` (switch on `"firstname"`/`"lastname"`/`"email"`/`"enrollmentnumber"`, default `CreatedDate`), and a filter expression from `SearchTerm` if present. |
| 4 | `Repositories/Interfaces/IStudentRepository.cs` (inherits `IRepository<Student>` from `BuildingBlocks/.../Repositories/IRepository.cs`) | No student-specific override needed — the generic `GetPagedAsync(pageNumber, pageSize, filter, orderBy)` is used as-is. |
| 5 | `BuildingBlocks/.../Repositories/RepositoryBase.cs` | The actual generic implementation — applies the `!IsDeleted` filter, the optional search filter, the order-by, then `.Skip().Take()`, and a separate `CountAsync` for `TotalCount`. |
| 6 | `Persistence/StudentDbContext.cs` | The `DbSet<Student>` the query above runs against. |
| 7 | AutoMapper: `Mappings/StudentProfile.cs` | Each returned `Student` mapped to a `StudentResponse`. |
| 8 | `BuildingBlocks/.../Contracts/Common/PagedResult.cs` | `PagedResult<StudentResponse>.Create(items, pageNumber, pageSize, totalCount)` — the envelope returned. |
| 9 | `Controllers/StudentsController.cs` / `BuildingBlocks/.../Contracts/Common/ApiResponse.cs` | Wrapped in `ApiResponse<PagedResult<StudentResponse>>.Ok(...)` and returned. |

## D.3 — `course-service`

### 1. `POST /api/v1/courses`

**Auth:** `CanManageCourses` (Admin/Faculty) · **Flow:** validate → uniqueness check → save → publish (awaited, try/caught) → respond `201`

| # | File | Role in this specific request |
|---|---|---|
| 1 | `Controllers/CoursesController.cs` | `CreateAsync` action. |
| 2 | `DTOs/Requests/CreateCourseRequest.cs` | Binding target (`CourseCode`, `Title`, `Description`, `Credits`, `Capacity`, `InstructorName`). |
| 3 | `Services/Interfaces/ICourseAppService.cs` / `Services/CourseAppService.cs` (`CreateAsync`) | Orchestrator. |
| 4 | `Validators/CourseValidators.cs` (`CreateCourseRequestValidator`) | Rules: `CourseCode` required + regex-shaped, `Title` required, `Credits` 1-6, `Capacity` 1-500. |
| 5 | `Repositories/Interfaces/ICourseRepository.cs` / `Repositories/CourseRepository.cs` | `CourseCodeExistsAsync` (→ `BusinessRuleException`, 409, if a duplicate would be created); later `AddAsync(course)`. |
| 6 | `Entities/Course.cs` | Entity constructed from the request, `IsActive = true`. |
| 7 | `UnitOfWork/ICourseUnitOfWork.cs` / `UnitOfWork/CourseUnitOfWork.cs` | `CommitAsync`. |
| 8 | `Persistence/CourseDbContext.cs` + `Persistence/Configurations/CourseConfiguration.cs` | The `INSERT`, using the unique index on `CourseCode` defined in the configuration as the database-level backstop behind step 5's application-level check. |
| 9 | `Kafka/Producers/CourseEventPublisher.cs` (`PublishCourseCreatedAsync`) | Called via a **`PublishSafelyAsync` wrapper that `await`s inline inside a `try/catch`** — note this is a different pattern from `student-service`'s detached `Task.Run` (see D.2 §1) — here a Kafka failure is caught and logged but the call is still awaited synchronously as part of the same request, just never allowed to fail or roll back the response. |
| 10 | `BuildingBlocks/.../Contracts/Events/CourseEvents.cs` (`CourseCreatedEvent`), `KafkaTopics.cs`, `Messaging/KafkaEventProducer.cs` | Event construction, topic name, actual publish. |
| 11 | AutoMapper: `Mappings/CourseProfile.cs` | `Course` → `CourseResponse`. |
| 12 | `Controllers/CoursesController.cs` | `Created($"/api/v1/courses/{course.Id}", response)` — the fix from Part A, Gate 8. |
| 13 | `BuildingBlocks/.../Contracts/Common/ApiResponse.cs` | Envelope. |

### 2. `PUT /api/v1/courses/{id}`

**Auth:** `CanManageCourses` · **Flow:** validate → load → re-check uniqueness (excluding self) → update → publish → respond `200`

| # | File | Role in this specific request |
|---|---|---|
| 1 | `Controllers/CoursesController.cs` | `UpdateAsync` action, binds route `id` + body. |
| 2 | `DTOs/Requests/UpdateCourseRequest.cs` | Binding target. |
| 3 | `Services/CourseAppService.cs` (`UpdateAsync`) | Orchestrator. |
| 4 | `Validators/CourseValidators.cs` (`UpdateCourseRequestValidator`) | Same shape of rules as create. |
| 5 | `Repositories/Interfaces/ICourseRepository.cs` / `Repositories/CourseRepository.cs` | `GetByIdAsync(id)` (→ `NotFoundException`, 404, if missing); `GetByCourseCodeAsync(newCode)` to check for a *different* course already owning that code; `Update(course)`. |
| 6 | `Entities/Course.cs` | The loaded entity, mutated in place (`CourseCode`, `Title`, `Description`, `Credits`, `Capacity`, `InstructorName`). |
| 7 | `Repositories/CourseRepository.cs` (`override Update`) | Bumps `RowVersion = Guid.NewGuid().ToByteArray()` before calling the base implementation — the manual concurrency-token strategy noted in Part A/beginner's guide, since MySQL has no native rowversion type. |
| 8 | `UnitOfWork/CourseUnitOfWork.cs` | `CommitAsync`. |
| 9 | `Persistence/CourseDbContext.cs` + `Persistence/Configurations/CourseConfiguration.cs` | The `UPDATE` statement. |
| 10 | `Kafka/Producers/CourseEventPublisher.cs` (`PublishCourseUpdatedAsync`) → `BuildingBlocks/.../Contracts/Events/CourseEvents.cs` (`CourseUpdatedEvent`) → `KafkaTopics.cs` → `Messaging/KafkaEventProducer.cs` | Same publish chain as create, different event type/topic. |
| 11 | AutoMapper: `Mappings/CourseProfile.cs` / `Controllers/CoursesController.cs` / `BuildingBlocks/.../Contracts/Common/ApiResponse.cs` | Map, wrap, return `200 OK`. |

### 3. `GET /api/v1/courses/{id}`

**Auth:** `[Authorize]` (any authenticated role) · **Flow:** load → map → respond

| # | File | Role in this specific request |
|---|---|---|
| 1 | `Controllers/CoursesController.cs` | `GetByIdAsync` action. |
| 2 | `Services/CourseAppService.cs` (`GetByIdAsync`) | Orchestrator — no validator needed (nothing to validate on a plain id lookup). |
| 3 | `Repositories/Interfaces/ICourseRepository.cs` (using the inherited `GetByIdAsync` from `BuildingBlocks/.../Repositories/IRepository.cs`, no course-specific override needed) | Looks up by id, excluding soft-deleted rows. |
| 4 | `BuildingBlocks/.../Repositories/RepositoryBase.cs` | The actual generic `GetByIdAsync` implementation (`FirstOrDefaultAsync(e => e.Id == id && !e.IsDeleted)`). |
| 5 | `Persistence/CourseDbContext.cs` | The `DbSet<Course>` queried. |
| 6 | `BuildingBlocks/.../Exceptions/AppExceptions.cs` (`NotFoundException`) | Thrown (→ 404) if step 3 returns null. |
| 7 | AutoMapper: `Mappings/CourseProfile.cs` | `Course` → `CourseResponse`. |
| 8 | `Controllers/CoursesController.cs` / `BuildingBlocks/.../Contracts/Common/ApiResponse.cs` | Wrapped, `200 OK`. |

### 4. `GET /api/v1/courses` — paged/sorted/searched list

**Auth:** `[Authorize]` · **Flow:** bind query → build filter (Title/CourseCode `Contains`) + sort delegate → generic paged query → map → respond

| # | File | Role in this specific request |
|---|---|---|
| 1 | `Controllers/CoursesController.cs` | `GetPagedAsync` action, binds `[FromQuery] PagedRequest`. |
| 2 | `BuildingBlocks/.../Contracts/Common/PagedRequest.cs` | Binding target. |
| 3 | `Services/CourseAppService.cs` (`GetPagedAsync`, `BuildOrderBy`) | Builds the search filter expression and the `sortBy` switch (`coursecode`/`title`/`credits`/`capacity`/`instructorname`/`isactive`, default `CreatedDate`). |
| 4 | `Repositories/Interfaces/ICourseRepository.cs` / `BuildingBlocks/.../Repositories/RepositoryBase.cs` | Generic `GetPagedAsync` implementation. |
| 5 | `Persistence/CourseDbContext.cs` | Queried. |
| 6 | AutoMapper: `Mappings/CourseProfile.cs` | Maps each item. |
| 7 | `BuildingBlocks/.../Contracts/Common/PagedResult.cs` | Envelope built. |
| 8 | `Controllers/CoursesController.cs` / `BuildingBlocks/.../Contracts/Common/ApiResponse.cs` | Wrapped, returned. |

## D.4 — `enrollment-service`

### 1. `POST /api/v1/enrollments` — the most architecturally interesting endpoint

**Auth:** `CanEnroll` (Admin/Faculty/Student) · **Flow:** load two *local* snapshots → business rule checks → save → publish

| # | File | Role in this specific request |
|---|---|---|
| 1 | `Controllers/EnrollmentsController.cs` | `Enroll` action (note the **class-level** `[Authorize(Policy = PolicyConstants.CanEnroll)]` — no per-action attribute needed here). |
| 2 | `DTOs/Requests/EnrollStudentRequest.cs` | Binding target — just `StudentId` + `CourseId`. |
| 3 | `Services/Interfaces/IEnrollmentAppService.cs` / `Services/EnrollmentAppService.cs` (`EnrollAsync`) | Orchestrator. |
| 4 | `Validators/EnrollmentValidators.cs` (`EnrollStudentRequestValidator`) | Checks both ids are non-empty GUIDs. |
| 5 | `Repositories/Interfaces/IStudentSnapshotRepository.cs` / `Repositories/StudentSnapshotRepository.cs` | `GetByIdAsync(request.StudentId)` — against the **local** `StudentSnapshot` table, never StudentDotnetDB. |
| 6 | `Entities/StudentSnapshot.cs` | The local read-model row (its `Id` deliberately equals the real `StudentId` from the source event — see the beginner's guide §11). |
| 7 | `BuildingBlocks/.../Exceptions/AppExceptions.cs` (`NotFoundException`) | Thrown (→ 404, `"Student"`) if step 5 returns null — this can legitimately mean "the `student.created` Kafka event hasn't been consumed yet," not necessarily "no such student." |
| 8 | `Repositories/Interfaces/ICourseSnapshotRepository.cs` / `Repositories/CourseSnapshotRepository.cs` | `GetByIdAsync(request.CourseId)` — same idea, against the local `CourseSnapshot` table. |
| 9 | `Entities/CourseSnapshot.cs` | Local read-model row; same `NotFoundException` (`"Course"`) if missing. |
| 10 | `BuildingBlocks/.../Exceptions/AppExceptions.cs` (`BusinessRuleException`) | Thrown (→ 409) if `courseSnapshot.EnrolledCount >= courseSnapshot.Capacity` ("Course is at full capacity.") or if step 11 finds an existing active enrollment ("Student is already enrolled in this course."). |
| 11 | `Repositories/Interfaces/IEnrollmentRepository.cs` / `Repositories/EnrollmentRepository.cs` | `HasActiveEnrollmentAsync(studentId, courseId)` (excludes `Cancelled` status); later `AddAsync(enrollment)`. |
| 12 | `Entities/Enrollment.cs` / `Entities/EnrollmentStatus.cs` | New `Enrollment` created with `Status = Confirmed`, `EnrolledOnUtc = UtcNow`. |
| 13 | `Repositories/CourseSnapshotRepository.cs` (via base `Update`) | `courseSnapshot.EnrolledCount += 1` then `Update(courseSnapshot)` — the one field on a snapshot this service is allowed to mutate locally (see beginner's guide §11). |
| 14 | `UnitOfWork/IEnrollmentUnitOfWork.cs` / `UnitOfWork/EnrollmentUnitOfWork.cs` | `CommitAsync` — persists the new `Enrollment` row *and* the `CourseSnapshot.EnrolledCount` update together in one call. |
| 15 | `Persistence/EnrollmentDbContext.cs` + `Persistence/Configurations/EnrollmentConfiguration.cs`, `CourseSnapshotConfiguration.cs` | The actual `INSERT`/`UPDATE` statements. |
| 16 | `Kafka/Producers/EnrollmentEventPublisher.cs` (`PublishEnrollmentCreatedAsync`) | Called with a **direct `await`, no try/catch wrapper** — unlike `course-service`'s `PublishSafelyAsync`, a Kafka failure here would propagate as an unhandled exception (caught generically by `ExceptionHandlingMiddleware.cs` as a 500) rather than being swallowed. |
| 17 | `BuildingBlocks/.../Contracts/Events/EnrollmentEvents.cs` (`EnrollmentCreatedEvent`) | Built from the new `Enrollment` plus the two snapshots' `Email`/`FullName`/`Title` fields — data this service never had to fetch remotely, because it already had it locally. |
| 18 | `BuildingBlocks/.../Contracts/KafkaTopics.cs`, `Messaging/KafkaEventProducer.cs` | Topic constant, actual publish. |
| 19 | AutoMapper: `Mappings/EnrollmentProfile.cs` (plus manual field assignment in `EnrollmentAppService.ToResponse`) | `Enrollment` → `EnrollmentResponse`, with `StudentFullName`/`CourseTitle` filled in manually from the snapshots (AutoMapper alone can't produce those — they don't live on the `Enrollment` entity itself). |
| 20 | `Controllers/EnrollmentsController.cs` / `BuildingBlocks/.../Contracts/Common/ApiResponse.cs` | Wrapped, `200 OK`. |

### 2. `POST /api/v1/enrollments/{id}/cancel`

**Auth:** `CanEnroll` · **Flow:** load → guard against double-cancel → mutate + decrement → publish

| # | File | Role in this specific request |
|---|---|---|
| 1 | `Controllers/EnrollmentsController.cs` | `Cancel` action, binds route `id` + body. |
| 2 | `DTOs/Requests/CancelEnrollmentRequest.cs` | Binding target (`Reason`). |
| 3 | `Services/EnrollmentAppService.cs` (`CancelAsync`) | Orchestrator. |
| 4 | `Validators/EnrollmentValidators.cs` (`CancelEnrollmentRequestValidator`) | `Reason` required, max length. |
| 5 | `Repositories/EnrollmentRepository.cs` | `GetByIdAsync(enrollmentId)`. |
| 6 | `BuildingBlocks/.../Exceptions/AppExceptions.cs` (`NotFoundException`) | Thrown if the enrollment doesn't exist **or is already `Cancelled`** (cancelling twice is treated as "not found," not a no-op success). |
| 7 | `Repositories/StudentSnapshotRepository.cs`, `Repositories/CourseSnapshotRepository.cs` | Loaded again here (for the email/title needed by the cancellation event and response). |
| 8 | `Entities/Enrollment.cs` | Mutated: `Status = Cancelled`, `CancelledOnUtc`, `CancellationReason = request.Reason`. |
| 9 | `Entities/CourseSnapshot.cs` | `EnrolledCount = Math.Max(0, EnrolledCount - 1)` — floored at zero. |
| 10 | `UnitOfWork/EnrollmentUnitOfWork.cs` / `Persistence/EnrollmentDbContext.cs` | `CommitAsync` — both updates in one transaction. |
| 11 | `Kafka/Producers/EnrollmentEventPublisher.cs` (`PublishEnrollmentCancelledAsync`) → `BuildingBlocks/.../Contracts/Events/EnrollmentEvents.cs` (`EnrollmentCancelledEvent`) → `KafkaTopics.cs` → `KafkaEventProducer.cs` | Publish chain, same pattern as enroll. |
| 12 | AutoMapper `Mappings/EnrollmentProfile.cs` / `Controllers/EnrollmentsController.cs` / `ApiResponse.cs` | Map, wrap, `200 OK`. |

### 3. `GET /api/v1/enrollments/students/{studentId}/history`

**Auth:** `CanEnroll` · **Flow:** query by student → build each response by re-joining local snapshots → respond

| # | File | Role in this specific request |
|---|---|---|
| 1 | `Controllers/EnrollmentsController.cs` | `GetHistory` action, binds route `studentId`. |
| 2 | `Services/EnrollmentAppService.cs` (`GetHistoryAsync`) | Orchestrator. |
| 3 | `Repositories/Interfaces/IEnrollmentRepository.cs` / `Repositories/EnrollmentRepository.cs` | `GetByStudentIdAsync(studentId)` — an enrollment-specific query, not from the generic base (returns *every* status, not just active). |
| 4 | `Entities/Enrollment.cs` | The rows returned. |
| 5 | `Repositories/StudentSnapshotRepository.cs`, `Repositories/CourseSnapshotRepository.cs` (via the private `BuildResponseAsync` helper, once per enrollment) | Re-looked-up per row to fill in `StudentFullName`/`CourseTitle` for each `EnrollmentResponse` — this is an N+1 query pattern, deliberately simple for a demo project's data volumes rather than a single joined query. |
| 6 | AutoMapper `Mappings/EnrollmentProfile.cs` | Base mapping per row. |
| 7 | `Controllers/EnrollmentsController.cs` / `BuildingBlocks/.../Contracts/Common/ApiResponse.cs` | Wrapped as `ApiResponse<IReadOnlyList<EnrollmentResponse>>`, `200 OK`. |

### 4. Background flow — `StudentEventsConsumer` / `CourseEventsConsumer` keeping the snapshots current

Not an HTTP endpoint, but the file trace every reader needs to fully understand endpoint #1 above — this runs continuously in the background inside the `enrollmentservice` container, triggered by Kafka messages instead of HTTP requests:

| # | File | Role |
|---|---|---|
| 1 | `Kafka/Consumers/StudentEventsConsumer.cs` (and `CourseEventsConsumer.cs`, identical shape) | Registered via `builder.Services.AddHostedService<StudentEventsConsumer>()` in `Program.cs`; its `Topics` property lists `student.created`/`student.updated`/`student.deleted`. |
| 2 | `BuildingBlocks/.../Messaging/KafkaConsumerBase.cs` | Owns the actual consume loop this class inherits — subscribes, consumes, wraps `HandleMessageAsync` in a Polly retry, commits the offset, dead-letters on exhausted retries. |
| 3 | `BuildingBlocks/.../Contracts/Events/StudentEvents.cs` | `StudentCreatedEvent`/`StudentUpdatedEvent`/`StudentDeletedEvent` — the classes the raw JSON message is deserialized into, chosen via the message's `eventType` header. |
| 4 | `Services/Interfaces/ISnapshotSyncService.cs` / `Services/SnapshotSyncService.cs` | Resolved from the **per-message DI scope** (`scopedServiceProvider`, not the consumer's own constructor-injected provider — each message gets a fresh scope, and therefore a fresh `EnrollmentDbContext`). `UpsertStudentSnapshotAsync`/`RemoveStudentSnapshotAsync` called depending on event type. |
| 5 | `Repositories/Interfaces/IStudentSnapshotRepository.cs` / `Repositories/StudentSnapshotRepository.cs` | `UpsertAsync` — checks `GetByIdAsync` first, then either `Update`s or `AddAsync`s. |
| 6 | `Entities/StudentSnapshot.cs` | The row created/updated, with `Id` explicitly set to `@event.StudentId`. |
| 7 | `UnitOfWork/IEnrollmentUnitOfWork.cs` / `UnitOfWork/EnrollmentUnitOfWork.cs`, `Persistence/EnrollmentDbContext.cs` | `CommitAsync` — this consumer commits its own transaction independent of any HTTP request. |

## D.5 — `notification-service`

### 1. `POST /api/v1/notifications/test-send`

**Auth:** `AdminOnly` · **Flow:** validate → call the exact same delivery method the Kafka consumer calls → respond

| # | File | Role in this specific request |
|---|---|---|
| 1 | `Controllers/NotificationsController.cs` | `TestSend` action — the only action in this controller with its own `[Authorize(Policy = PolicyConstants.AdminOnly)]`, stricter than the class-level `[Authorize]`. |
| 2 | `DTOs/Requests/SendTestNotificationRequest.cs` | Binding target (`Channel`, `RecipientEmail`, `RecipientPhoneNumber?`, `Subject`, `Body`). |
| 3 | `Validators/SendTestNotificationRequestValidator.cs` | *(Registered via `AddValidatorsFromAssemblyContaining<Program>()`, but note this particular controller action calls `INotificationAppService.DeliverAsync` directly rather than an app-service method that itself validates — the request DTO's own validator still runs via MVC's automatic model validation before the action executes.)* |
| 4 | `Services/Interfaces/INotificationAppService.cs` / `Services/NotificationAppService.cs` (`DeliverAsync`) | The **same method** `UpstreamEventsConsumer` calls (see #4 below) — called here with `triggeredByEvent = "ManualTestSend"`, `referenceId = null`. |
| 5 | `Services/Senders/IEmailSender.cs` / `SmtpMockEmailSender.cs`, `ISmsSender.cs` / `MockSmsSender.cs`, `IPushSender.cs` / `MockPushSender.cs` | Exactly one of these three is called, chosen by a `switch` on `request.Channel` — each logs a `[MOCK ...]` line and returns a real boolean outcome (SMS with a blank phone number genuinely returns `false`). |
| 6 | `BuildingBlocks/.../Contracts/Events/NotificationEvents.cs` (`NotificationChannel` enum) | The type `request.Channel` is declared as, and what the `switch` in step 5 matches on. |
| 7 | `Entities/NotificationHistory.cs` | Built from the real outcome of step 5 (`Success`, `FailureReason` if the send failed). |
| 8 | `Repositories/Interfaces/INotificationHistoryRepository.cs` / `Repositories/NotificationHistoryRepository.cs`, `UnitOfWork/INotificationUnitOfWork.cs` / `UnitOfWork/NotificationUnitOfWork.cs` | `AddAsync` + `CommitAsync`. |
| 9 | `Persistence/NotificationDbContext.cs` + `Persistence/Configurations/NotificationHistoryConfiguration.cs` | The `INSERT`. |
| 10 | `Kafka/Producers/NotificationEventPublisher.cs` (`PublishNotificationSentAsync`) | Publishes regardless of whether the mock send succeeded or failed — the *outcome* is what's being announced. |
| 11 | `BuildingBlocks/.../Contracts/Events/NotificationEvents.cs` (`NotificationSentEvent`), `KafkaTopics.cs`, `Messaging/KafkaEventProducer.cs` | Event construction, topic, publish. |
| 12 | `Controllers/NotificationsController.cs` (manual `NotificationHistoryResponse` construction, not AutoMapper, for this one action) / `BuildingBlocks/.../Contracts/Common/ApiResponse.cs` | Response built field-by-field from the returned `NotificationHistory` entity, wrapped, `200 OK`. |

### 2. `GET /api/v1/notifications/{id}`

**Auth:** `[Authorize]` · **Flow:** load → map → respond

| # | File | Role in this specific request |
|---|---|---|
| 1 | `Controllers/NotificationsController.cs` | `GetById` action. |
| 2 | `Services/NotificationAppService.cs` (`GetByIdAsync`) | Orchestrator. |
| 3 | `Repositories/Interfaces/INotificationHistoryRepository.cs` (inherited `GetByIdAsync`) / `BuildingBlocks/.../Repositories/RepositoryBase.cs` | Generic lookup by id, excluding soft-deleted rows. |
| 4 | `Persistence/NotificationDbContext.cs` | Queried. |
| 5 | `BuildingBlocks/.../Exceptions/AppExceptions.cs` (`NotFoundException`) | Thrown (404) if missing. |
| 6 | AutoMapper: `Mappings/NotificationProfile.cs` | `NotificationHistory` → `NotificationHistoryResponse`. |
| 7 | `Controllers/NotificationsController.cs` / `ApiResponse.cs` | Wrapped, `200 OK`. |

### 3. `GET /api/v1/notifications` — paged/sorted/searched history

**Auth:** `[Authorize]` · **Flow:** bind query → filter (RecipientEmail/Subject `Contains`) + sort → generic paged query → map → respond

| # | File | Role in this specific request |
|---|---|---|
| 1 | `Controllers/NotificationsController.cs` | `GetPaged` action. |
| 2 | `BuildingBlocks/.../Contracts/Common/PagedRequest.cs` | Binding target. |
| 3 | `Services/NotificationAppService.cs` (`GetPagedAsync`) | Builds the filter expression and the `sortBy` switch (`recipientemail`/`subject`/`sentonutc`). |
| 4 | `Repositories/Interfaces/INotificationHistoryRepository.cs` / `Repositories/NotificationHistoryRepository.cs`, `BuildingBlocks/.../Repositories/RepositoryBase.cs` | Generic paged query. |
| 5 | `Persistence/NotificationDbContext.cs` | Queried. |
| 6 | AutoMapper: `Mappings/NotificationProfile.cs` | Maps each item. |
| 7 | `BuildingBlocks/.../Contracts/Common/PagedResult.cs` | Envelope. |
| 8 | `Controllers/NotificationsController.cs` / `ApiResponse.cs` | Wrapped, returned. |

### 4. Background flow — `UpstreamEventsConsumer` (this service's real core lifecycle)

`notification-service` only exposes 3 HTTP endpoints; the fourth, most important "endpoint" is this background one — it's what the entire service exists for:

| # | File | Role |
|---|---|---|
| 1 | `Kafka/Consumers/UpstreamEventsConsumer.cs` | Registered via `AddHostedService`; `Topics` lists `student.created`, `enrollment.created`, `enrollment.cancelled`, `notification.requested` — 4 topics from 3 different upstream services. |
| 2 | `BuildingBlocks/.../Messaging/KafkaConsumerBase.cs` | The consume loop, retry, offset commit, dead-lettering — same base every consumer in the system uses. |
| 3 | `BuildingBlocks/.../Contracts/Events/StudentEvents.cs`, `EnrollmentEvents.cs`, `NotificationEvents.cs` | Whichever event type matches the message's `eventType` header is deserialized. |
| 4 | `Services/Interfaces/INotificationAppService.cs` / `Services/NotificationAppService.cs` (`DeliverAsync`) | Called once per message, from the per-message DI scope — with event-specific subject/body text built inline in the consumer (`"Welcome to Student Management System"`, `"Enrollment Confirmed"`, `"Enrollment Cancelled"`, or the requester-supplied subject/body for an ad-hoc `NotificationRequestedEvent`). |
| 5-12 | *(same files as `POST /notifications/test-send` steps 5-11 above)* | From this point on, the code path is identical to the manual test-send endpoint — same senders, same `NotificationHistory` entity, same repository/DbContext, same outbound `NotificationSentEvent` publish. This is deliberate: `DeliverAsync` is the single choke point both the HTTP endpoint and the Kafka consumer funnel through, so there is exactly one place that decides what "delivering a notification" means. |
