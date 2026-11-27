# Student Management Microservices — Asynchronous, CQRS, Kafka, Shared-Secret JWT

A beginner-friendly walkthrough of how this project was built and how to run it: four
independent Spring Boot microservices implementing a Student Management System, using **CQRS**
(Command Query Responsibility Segregation) for each service's main aggregate, **Kafka** for both
the CQRS read-model sync and all cross-service communication, and a **shared-secret JWT** that
gives single sign-on across all four services without a gateway in front of them.

Project location: `Documents/Java_Projects/SPRINGB-student-mgmt-async-CQRS-pattern-kafka`

This is the fourth project in a family that all implement the same Student Management System
(Student, Course, Enrollment, Notification) with different architectural choices:

| Project | Cross-service calls | Internal pattern | Auth |
|---|---|---|---|
| `SPRINGB-student-mgmt-sync-repository-OpenFeign` | Sync (OpenFeign) | JPA repositories | none |
| `SPRINGB-student-mgmt-async-layered-kafka` | Async (Kafka) | Layered (JdbcTemplate DAOs) | none |
| `SPRINGB-student-mgmt-async-api-gateway-pattern-kafka` | Async (Kafka) | JPA + API Gateway | none |
| **This project** | **Async (Kafka)** | **CQRS (command/query split)** | **Shared-secret JWT** |

The enrollment saga — the actual "asynchronous communication" mechanism between services — is
the *identical* choreography design proven in the two earlier async siblings. What's new here is
that each service's main entity is additionally split into a **write side** and a **read side**,
kept in sync with their own internal Kafka events, and every request now has to carry a valid JWT.

---

## 1. What CQRS means here, concretely

**Command Query Responsibility Segregation** means: don't read and write through the same model.
Writes go through a **command** path that hits a normalized write table; reads go through a
separate **query** path that hits its own, independently-shaped read table. The two are kept in
sync asynchronously — there's a small window (normally well under a second) where they can
disagree, and that's accepted, not a bug.

Applying this to **every** table in this system (student addresses, course schedules, payment
records, ...) would have meant 300+ files for very little benefit — those are reference/log
tables with no meaningfully different read/write shape. Instead, CQRS is applied to the **one
aggregate root per service** that's actually interesting this way:

| Service | Aggregate (CQRS) | Plain CRUD (unchanged) |
|---|---|---|
| student-service | **Student** | Student_Address, Student_Documents, Student_Login |
| course-service | **Course** | Course_Category, Course_Faculty, Course_Schedule |
| enrollment-service | **Enrollment** | Enrollment_Status, Payments |
| notification-service | **Notification** | Email_Logs, SMS_Logs |

### The pattern, per aggregate (shown for Student — Course/Enrollment/Notification are the same shape)

```
command/entity/Student.java              write @Entity -> Students table
command/repository/StudentCommandRepository.java   JpaRepository<Student, Long>
command/service/StudentCommandService.java          create/update/delete -> writes Students,
                                                      then publishes StudentChangedEvent
command/controller/StudentCommandController.java     POST/PUT/DELETE /api/students
query/entity/StudentView.java             read @Entity -> Students_View table (denormalized)
query/repository/StudentQueryRepository.java         JpaRepository<StudentView, Long>
query/service/StudentQueryService.java               GET reads, from Students_View only
query/controller/StudentQueryController.java         GET /api/students
event/StudentChangedEvent.java            {operation, studentId, ...fields}
kafka/StudentChangedProducer.java         publishes to topic `student.changed`
kafka/StudentChangedProjector.java        @KafkaListener on `student.changed`,
                                           upserts/deletes the Students_View row
```

`StudentCommandController` and `StudentQueryController` both map to `/api/students` but different
HTTP methods — Spring routes `POST`/`PUT`/`DELETE` to the command controller and `GET` to the
query controller. From the outside it looks like one resource; internally it's two independent
code paths that never call each other.

### Denormalization — the actual payoff, not just plumbing

- `Courses_View` carries `category_name` directly. `CourseCommandService` looks the name up
  **once**, at write time, and puts it in the Kafka event — so `GET /api/courses` never has to
  join `Course_Category`. Verified live: creating course `DS301` (category 2) and reading it back
  immediately showed `"categoryName":"Data Science"` with no join query anywhere in the read path.
- `Enrollments_View` carries `status_name` the same way — replacing the
  `SELECT ... JOIN Enrollment_Status` every prior sibling project needed just to show a human-
  readable status.
- `Students_View` adds a derived `full_name` (`firstName + " " + lastName`), computed by the
  projector — showing the read model can *reshape* data, not just mirror it.
- `Notifications_View` is a plain mirror of `Notifications`. Not every aggregate has an obvious
  denormalization target within a single service, and that's fine — CQRS doesn't require one.

### A CQRS-correctness rule: never validate against the read model

`student-service`'s `EnrollmentRequestedListener` (the saga participant that answers "does this
student exist?") checks `StudentCommandRepository` — the write/source-of-truth side — not
`StudentQueryRepository`/`Students_View`. The read model is only *eventually* consistent; using it
for a correctness-critical check would occasionally say "doesn't exist" for a student that was
just created a moment ago and hasn't been projected yet. Same rule applies in course-service.

---

## 2. The enrollment saga (unchanged design, now also feeding a read model)

| Topic | Producer | Consumer(s) |
|---|---|---|
| `enrollment.requested` | enrollment-service | student-service, course-service |
| `student.validation.result` | student-service | enrollment-service |
| `course.validation.result` | course-service | enrollment-service |
| `enrollment.confirmed` / `enrollment.rejected` | enrollment-service | notification-service |
| `student.changed` / `course.changed` / `enrollment.changed` / `notification.changed` | each service, internally | that same service's own projector |

`EnrollmentCommandService.create()` inserts `Enrollments` as `PENDING_VALIDATION`, publishes
`enrollment.requested` (the saga trigger) **and** `enrollment.changed` (so `Enrollments_View`
shows the pending row right away). `EnrollmentSagaService` — the same choreography logic proven
in both earlier async siblings — waits for both validation replies (tracked in a command-side-only
`Enrollment_Validation` table, never exposed via any read model), then publishes **two** more
events once resolved: `enrollment.confirmed`/`enrollment.rejected` (for notification-service) and
a second `enrollment.changed` (so the read model catches up to CONFIRMED/REJECTED).

### Reusing a fix, not just a design

The two validation replies (`student.validation.result`, `course.validation.result`) arrive on
two different Kafka listener threads at nearly the same instant. The naive approach —
`findById(...).setXValid(...).save(...)` — has a **lost-update race**: Hibernate's `save()` issues
a full-row `UPDATE`, so whichever thread committed *last*, having read the row *before* the other
thread's write landed, silently overwrites the other thread's column back to `null`. This exact
bug was found and fixed in the `api-gateway-pattern` sibling project; the fix carries over
verbatim here — `EnrollmentValidationRepository` uses **targeted `@Modifying` JPQL updates**
(`UPDATE EnrollmentValidation SET studentValid = ... WHERE enrollmentId = ...`) that only ever
touch the one column each listener owns, so the two threads can never clobber each other. In this
project's live run, every enrollment resolved correctly on the very first poll — the fix worked
from the start because it was applied up front, based on the earlier project's experience.

---

## 3. Authentication: shared-secret JWT, single sign-on, no gateway

The prompt asked: *how will you handle authentication for all microservices at a single time?*
The answer here — since no API gateway was in scope for this variant — is a **shared signing
secret**:

- `app.jwt.secret` holds the *exact same literal value* in all four services'
  `application.properties` (`cqrs-student-mgmt-shared-jwt-secret-key-2026-please-rotate-me`,
  overridable via the `JWT_SECRET` env var — a real deployment would pull this from a secrets
  manager, never commit it as a literal).
- Only **student-service** exposes `POST /auth/login` (`AuthController`). It checks the submitted
  username/password against the existing `Student_Login` table with a plain `equals()` against
  the stored `password_hash` — a deliberate simplification for this demo; a real system would use
  `BCryptPasswordEncoder.matches(raw, stored)` and never compare raw strings. On success it
  returns `{"token": "...", "tokenType": "Bearer"}`, signed with the shared secret, 1-hour expiry.
- **Every** service — including student-service itself — runs a `JwtAuthFilter`
  (`extends OncePerRequestFilter`, `@Component`, auto-registered by Spring Boot with zero extra
  configuration) that rejects any request outside `/auth/**` lacking a valid
  `Authorization: Bearer <token>` header, with a hand-written 401 JSON body (filters run before
  `@RestControllerAdvice`, so the usual exception handler can't be reused here).
- No Spring Security dependency anywhere — `OncePerRequestFilter` lives in `spring-web` (already
  pulled in by `spring-boot-starter-web`), and JWT parsing uses the lightweight `io.jsonwebtoken`
  (jjwt) library. The whole mechanism is "does this token verify against our shared key?", which
  doesn't need a full security framework.
- **Verified live**: logging in once against student-service and presenting that exact token to
  course-service, enrollment-service, and notification-service each independently returned `200` —
  true single sign-on with zero network hop to a central authority per request. A request with no
  token, or a garbage token, gets `401` from whichever service receives it.

---

## 4. Running it locally

### Prerequisites already on this machine
- Java 21, Maven 3.8, Docker + Docker Compose (for the Kafka broker only)
- A local MySQL server on `127.0.0.1:3306`, user `abhig` / password `Pass@123` (same as the
  sibling projects — override via `DB_USERNAME`/`DB_PASSWORD` env vars if yours differ)

### Step 1 — build everything
```bash
cd Documents/Java_Projects/SPRINGB-student-mgmt-async-CQRS-pattern-kafka
mvn -DskipTests clean package
```
All four modules end in **BUILD SUCCESS**. (One compile error was hit and fixed along the way —
a `ResponseEntity<?>` returned from an `Optional.map()/orElseGet()` chain in `AuthController`
couldn't infer a common type between a `LoginResponse` body and a `String` error body; rewritten
as a plain `if (match.isEmpty())` check, which sidesteps generic inference entirely.)

### Step 2 — start Kafka
```bash
docker compose up -d
```
Single-broker Kafka in KRaft mode, exposed on **`localhost:9096`** — not 9092 (unrelated container
on this machine), not 9094 (layered-kafka sibling), not 9095 (api-gateway-pattern sibling).

### Step 3 — create the 4 databases (now including the `_View` read tables)
```bash
mysql -h 127.0.0.1 -u abhig -p < sql/01_student_db.sql
mysql -h 127.0.0.1 -u abhig -p < sql/02_course_db.sql
mysql -h 127.0.0.1 -u abhig -p < sql/03_enrollment_db.sql
mysql -h 127.0.0.1 -u abhig -p < sql/04_notification_db.sql
```

### Step 4 — start all four services
```bash
java -jar student-service/target/student-service.jar &
java -jar course-service/target/course-service.jar &
java -jar enrollment-service/target/enrollment-service.jar &
java -jar notification-service/target/notification-service.jar &
```
| Service | Port |
|---|---|
| student-service | 8081 (also hosts `/auth/login`) |
| course-service | 8082 |
| enrollment-service | 8083 |
| notification-service | 8084 |

### Step 5 — tear down
```bash
# stop the 4 java processes, then:
docker compose down
```

---

## 5. Full request walkthrough (real output, captured from an actual run)

**1. Prove auth is enforced — no token**
```
GET http://localhost:8081/api/students
```
```
HTTP/1.1 401
{"status":401,"error":"Unauthorized","message":"Missing Authorization: Bearer <token> header"}
```

**2. Log in against student-service**
```
POST http://localhost:8081/auth/login
{"username":"aarav.sharma","password":"hash_9f2b1c0a"}
```
```json
{"token":"eyJhbGciOiJIUzM4NCJ9.eyJzdWIiOiJhYXJhdi5zaGFybWEi...","tokenType":"Bearer"}
```

**3. The same token against all four services**
```
student-service    (/api/students)    with shared token -> 200
course-service      (/api/courses)     with shared token -> 200
enrollment-service  (/api/enrollments) with shared token -> 200
notification-service(/api/notifications) with shared token -> 200
```
One login, four independent services accepting the same proof of identity.

**4–5. CQRS in action — Student**
```
POST http://localhost:8081/api/students   (command side)
{"firstName":"Rahul","lastName":"Verma","email":"rahul.verma@example.com", ...}
```
```
HTTP/1.1 201 Created
{"studentId":6,"firstName":"Rahul","lastName":"Verma", ...}
```
One second later:
```
GET http://localhost:8081/api/students/6   (query side, Students_View)
```
```json
{"studentId":6,"firstName":"Rahul","lastName":"Verma","fullName":"Rahul Verma",
 "email":"rahul.verma@example.com", ...}
```
`fullName` only exists on the read side — proof this came from `Students_View`, not `Students`.

**6–7. CQRS denormalization in action — Course**
```
POST http://localhost:8082/api/courses   (command side)
{"categoryId":2,"courseCode":"DS301","courseName":"Deep Learning", ...}
```
```
HTTP/1.1 201 Created
{"courseId":7,"categoryId":2,"courseCode":"DS301", ...}
```
```
GET http://localhost:8082/api/courses/7   (query side, Courses_View)
```
```json
{"courseId":7,"categoryId":2,"categoryName":"Data Science","courseCode":"DS301", ...}
```
`categoryName` appears with zero join — `CourseCommandService` looked it up once at write time.

**8–9. The enrollment saga — confirmed path**
```
POST http://localhost:8083/api/enrollments
{"studentId":6,"courseId":7}
```
```
HTTP/1.1 202 Accepted
{"enrollmentId":5,"studentId":6,"courseId":7,"statusId":1, ...}
```
```
GET http://localhost:8083/api/enrollments/5
```
```json
poll 1: {"enrollmentId":5, ..., "statusId":2,"statusName":"CONFIRMED", ...}
```
Resolved on the very first poll.

**10. The notification it triggered**
```
GET http://localhost:8084/api/notifications?enrollmentId=5
```
```json
[
  {"eventType":"ENROLLMENT_CONFIRMED","channel":"EMAIL","status":"SENT", ...},
  {"eventType":"ENROLLMENT_CONFIRMED","channel":"SMS","status":"SENT", ...}
]
```

**11–13. The enrollment saga — rejected path**
```
POST http://localhost:8083/api/enrollments
{"studentId":9999,"courseId":1}
```
```
HTTP/1.1 202 Accepted
```
```
GET http://localhost:8083/api/enrollments/6
```
```json
{"enrollmentId":6,"studentId":9999,"courseId":1,"statusId":3,"statusName":"REJECTED",
 "rejectionReason":"Student 9999 does not exist in StudentDB", ...}
```
```
GET http://localhost:8084/api/notifications?enrollmentId=6
```
```json
[{"eventType":"ENROLLMENT_REJECTED","channel":"EMAIL",
  "message":"Your enrollment (id 6) in course 1 was rejected: Student 9999 does not exist in StudentDB",
  "status":"SENT", ...}]
```

**14. A garbage token — still rejected, correctly**
```
GET http://localhost:8082/api/courses
Authorization: Bearer not-a-real-token
```
```
HTTP/1.1 401
{"status":401,"error":"Unauthorized","message":"Invalid or expired token"}
```

A scan of all four services' logs after this run found zero real errors or exceptions.

---

## 6. Where to look in the code for each concept

| Concept | File |
|---|---|
| CQRS command/query split (full example) | `student-service/.../command/` and `.../query/` |
| Denormalization at write time | `course-service/.../command/service/CourseCommandService.java` |
| The read-only correctness rule | `student-service/.../kafka/EnrollmentRequestedListener.java` |
| The lost-update fix, reused | `enrollment-service/.../command/repository/EnrollmentValidationRepository.java` |
| Choreography saga decision logic | `enrollment-service/.../command/service/EnrollmentSagaService.java` |
| JWT issuance (the only place) | `student-service/.../controller/AuthController.java` |
| JWT enforcement (every service) | `<service>/.../security/JwtAuthFilter.java` |
| Kafka broker setup (KRaft, no Zookeeper) | `docker-compose.yml` |

---

## 7. Summary

This project pairs **CQRS** (command/query split with denormalized, Kafka-synced read models) for
each service's core aggregate with the same **choreography-over-Kafka** saga proven twice before,
plus a **shared-secret JWT** answering the prompt's authentication requirement without needing a
gateway. The interesting parts weren't the boilerplate — they were the two correctness rules CQRS
forces you to confront explicitly: never trust the read model for a decision that matters (the
saga's existence checks), and never let a full-entity `save()` silently clobber a concurrent
partial update (the targeted-JPQL fix, reused from direct experience in an earlier sibling).
