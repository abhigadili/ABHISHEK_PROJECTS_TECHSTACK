# Student Management System — .NET 8 Microservices

A production-shaped **Student Management System** built as four independently deployable **.NET 8** microservices, communicating **asynchronously over Apache Kafka**, each owning its own **MySQL** database. Built with Clean Architecture, the Repository + Unit of Work patterns, JWT authentication, Serilog structured logging, and a real (not mocked) EF Core + Kafka + Docker stack.

For the full beginner-friendly walkthrough of *how* this was built, *why* each pattern was chosen, and a traced example of a request flowing through the whole system, see the companion guide:
`202607042230-dotnet-student-mgmt-beginners-guide-and-patterns.md` (and its `.pdf`).

---

## 1. Architecture at a glance

```
                        ┌───────────────────────┐
                        │      Client / UI       │  (Swagger, Postman, Angular/React/Next.js dev server)
                        └───────────┬────────────┘
          ┌────────────────────────┼─────────────────────────┬─────────────────────────┐
          ▼                        ▼                          ▼                         ▼
 ┌──────────────────┐    ┌──────────────────┐      ┌────────────────────┐    ┌───────────────────────┐
 │  student-service  │    │  course-service   │      │ enrollment-service │    │ notification-service  │
 │   port 8121        │    │   port 8122       │      │    port 8123        │    │     port 8124          │
 │  StudentDotnetDB   │    │   CourseDotnetDB  │      │  EnrollmentDotnetDB │    │  NotificationDotnetDB │
 │  (issues JWTs)     │    │                    │      │  (local read-model  │    │  (mock email/SMS/push)│
 └─────────┬──────────┘    └─────────┬─────────┘      │   snapshots only)   │    └───────────┬────────────┘
           │  produces               │  produces      └──────────┬──────────┘                │
           │  student.*              │  course.*                 │  produces/consumes         │  consumes
           ▼                         ▼                            ▼                            ▼
                        ┌─────────────────────────────────────────────────────────┐
                        │                        Kafka (+ Zookeeper)                │
                        └─────────────────────────────────────────────────────────┘
```

- **Database per Service** — each service owns its own MySQL database; none of them ever opens a connection to another service's database.
- **No synchronous HTTP calls between services** — `enrollment-service` never calls `student-service` or `course-service` directly. Instead it keeps its own local "snapshot" tables (`StudentSnapshot`, `CourseSnapshot`) kept in sync purely via Kafka events — a real example of event-driven choreography.
- **student-service is the identity owner** — it's the only service with `/auth/*` endpoints (register/login/refresh/revoke) and the only one with a `Users`/`Roles`/`RefreshTokens` schema. The other three services never issue tokens; they only validate JWTs signed with the same shared secret.

---

## 2. Folder structure

```
DOTNET-student-mgmt-clean-arch-repo-uow-kafka/
├── StudentManagement.sln
├── Directory.Build.props        # shared TargetFramework/Nullable/ImplicitUsings for every project
├── docker-compose.yml
├── sql/init-databases.sql       # creates the 4 empty databases on first mysql container start
├── BuildingBlocks/              # shared class libraries every service references
│   ├── StudentMgmt.BuildingBlocks.Contracts/   # Kafka event classes, DTOs, KafkaTopics constants
│   ├── StudentMgmt.BuildingBlocks.Messaging/   # Kafka producer/consumer base classes, retry, DLQ
│   └── StudentMgmt.BuildingBlocks.Common/      # BaseEntity, generic Repository/UnitOfWork, JWT,
│                                                  middlewares, exceptions, CORS/Swagger/health/versioning extensions
├── Services/
│   ├── StudentService/          # Controllers, Entities, Persistence, Repositories, UnitOfWork,
│   │   (same shape in each)       Services, Kafka/{Producers,Consumers}, DTOs, Validators, Mappings, Dockerfile
│   ├── CourseService/
│   ├── EnrollmentService/
│   └── NotificationService/
└── tests/
    ├── StudentService.Tests/
    ├── CourseService.Tests/
    ├── EnrollmentService.Tests/
    └── NotificationService.Tests/
```

---

## 3. Prerequisites

- [Docker](https://docs.docker.com/get-docker/) + Docker Compose v2 (`docker compose version`)
- To build/run **outside** Docker (optional): [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0) and the `dotnet-ef` tool (`dotnet tool install --global dotnet-ef`)

You do **not** need MySQL or Kafka installed locally — `docker-compose.yml` provisions both.

---

## 4. Running everything (Docker — recommended)

```bash
cd DOTNET-student-mgmt-clean-arch-repo-uow-kafka
docker compose build
docker compose up -d
docker compose ps          # wait until every service shows "healthy"
```

This starts, in order: MySQL → Zookeeper → Kafka → all four microservices (each runs its own EF Core migrations automatically on startup — no manual migration step needed in Docker).

To stop everything (keeping data): `docker compose stop`
To stop and remove containers (keeping the named volumes / data): `docker compose down`
To wipe all data too: `docker compose down -v`

### Swagger URLs (with JWT "Authorize" button built in)

| Service | Swagger UI | Health check |
|---|---|---|
| student-service | http://localhost:8121/swagger | http://localhost:8121/health |
| course-service | http://localhost:8122/swagger | http://localhost:8122/health |
| enrollment-service | http://localhost:8123/swagger | http://localhost:8123/health |
| notification-service | http://localhost:8124/swagger | http://localhost:8124/health |

### Seeded admin account

`student-service` seeds one Admin user on first startup so you can test admin-only endpoints (create course, manage students, test-send a notification) immediately:

```
email:    admin@studentmgmt.local
password: Admin@12345
```

### A full end-to-end example with curl

```bash
# 1. Log in as the seeded admin
TOKEN=$(curl -s -X POST http://localhost:8121/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@studentmgmt.local","password":"Admin@12345"}' | python3 -c "import json,sys;print(json.load(sys.stdin)['data']['accessToken'])")

# 2. Register a student (student-service issues the JWT and publishes StudentCreatedEvent)
curl -s -X POST http://localhost:8121/api/v1/auth/register -H "Content-Type: application/json" \
  -d '{"firstName":"Amy","lastName":"Nguyen","email":"amy@example.com","password":"Passw0rd!","dateOfBirth":"2004-03-15"}'
# -> response.data.studentId is what you pass to enrollment-service (NOT userId)

# 3. Create a course (as admin)
curl -s -X POST http://localhost:8122/api/v1/courses -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"courseCode":"CS101","title":"Intro to CS","description":"...","credits":3,"capacity":30,"instructorName":"Dr. Smith"}'

# 4. Enroll (enrollment-service validates against its own local StudentSnapshot/CourseSnapshot,
#    which are populated a few seconds after step 2/3 via Kafka — see Troubleshooting if you get a 404 immediately after)
curl -s -X POST http://localhost:8123/api/v1/enrollments -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" -d '{"studentId":"<studentId from step 2>","courseId":"<id from step 3>"}'

# 5. Check that notification-service delivered a "welcome" and "enrollment confirmed" email (mocked, logged + stored)
curl -s "http://localhost:8124/api/v1/notifications?pageSize=5&sortDescending=true" -H "Authorization: Bearer $TOKEN"
```

---

## 5. Running a single service outside Docker (local development)

Useful when actively editing one service's code and want fast iteration without rebuilding its image.

```bash
# 1. Start just the infrastructure containers
docker compose up -d mysql zookeeper kafka

# 2. Run one service directly with the SDK (appsettings.json already points at
#    localhost:3311 for MySQL and localhost:9095 for Kafka, matching the
#    ports docker-compose exposes on the host)
cd Services/StudentService
dotnet run
```

Each service's `Program.cs` calls `db.Database.Migrate()` on startup, so no manual migration step is required even in this mode — but if you want to add a new migration after changing an entity:

```bash
cd Services/StudentService   # or CourseService / EnrollmentService / NotificationService
dotnet ef migrations add <DescriptiveName> -o Persistence/Migrations
dotnet ef database update
```

---

## 6. Database configuration

Each service's `appsettings.json` has its own `ConnectionStrings:DefaultConnection` pointing at `localhost:3311` (the host-mapped MySQL port) and its own database name (`StudentDotnetDB`, `CourseDotnetDB`, `EnrollmentDotnetDB`, `NotificationDotnetDB`). `docker-compose.yml` overrides this per-container via the `ConnectionStrings__DefaultConnection` environment variable to point at the internal `mysql:3306` hostname instead — standard ASP.NET Core [configuration override via environment variables](https://learn.microsoft.com/aspnet/core/fundamentals/configuration/#environment-variables), no code branching needed.

Root MySQL credentials (fine for this learning project; would come from a secrets manager in a real production deployment): `root` / `Root@12345`.

---

## 7. Kafka setup

`docker-compose.yml` runs Confluent's `cp-zookeeper` + `cp-kafka` images with a dual-listener setup:
- `kafka:29092` — used by the 4 microservice containers on the internal Docker network
- `localhost:9095` — exposed to the host, so you can run a service outside Docker (§5) or point a Kafka UI tool at it

Topics (`student.created`, `student.updated`, `student.deleted`, `course.created`, `course.updated`, `course.deleted`, `enrollment.created`, `enrollment.cancelled`, `notification.requested`, `notification.sent`, plus a `.dlq` dead-letter topic per topic) are auto-created on first use (`KAFKA_AUTO_CREATE_TOPICS_ENABLE=true`) — no manual topic creation step needed.

---

## 8. Testing

```bash
dotnet test StudentManagement.sln
```

102 tests across the 4 services (xUnit + Moq + FluentAssertions + EF Core InMemory), covering application-service business rules, repository queries, controller response shapes, and validators.

---

## 9. Troubleshooting

- **A brand-new Kafka topic's first message takes a few seconds to reach a consumer.** Topics are created lazily on first publish. A consumer that subscribed before the topic existed needs one metadata refresh cycle (typically well under a second, but can occasionally take longer) to notice it. This only affects the *very first* message ever published to a given topic in a fresh environment — every message after that is delivered immediately. If an enrollment immediately after registering a brand-new student/course 404s with "Student/Course not found", wait a few seconds and retry; `enrollment-service`'s local snapshot hadn't been populated yet.
- **`docker compose up` fails to bind port 3311/8121-8124/9095.** Something else on the host is already using that port. Either stop it or edit the `ports:` mapping in `docker-compose.yml` (only the host-side number needs to change; inter-container communication is unaffected).
- **`AutoMapper` NU1903 build warning.** `AutoMapper` 13.0.1 has a published advisory; it does not affect this project's usage (no untrusted mapping expressions), and newer AutoMapper major versions changed their license terms, so we pinned 13.0.1 deliberately. Safe to leave as a warning, or bump if your organization's policy requires a clean advisory scan.
- **JWT token from student-service is rejected by another service ("401 Unauthorized").** All four `appsettings.json` files must have byte-for-byte identical `Jwt:Secret`/`Issuer`/`Audience` values — that's what lets a token minted by student-service validate on the other three without any of them calling student-service over HTTP. `docker-compose.yml`'s `x-jwt-env` YAML anchor keeps this in sync automatically for the containerized setup; if you edit one service's `appsettings.json` secret for local dev, update all four.
- **Logs.** Every service writes structured logs to both console and `logs/<service-name>-<date>.log` (rolling daily, 14-day retention), each line tagged with a correlation id you can `grep` across every service's log to trace one request end-to-end (`docker logs studentmgmt-<service>-service`, or the mounted `logs/` folder if you added a volume for it).
