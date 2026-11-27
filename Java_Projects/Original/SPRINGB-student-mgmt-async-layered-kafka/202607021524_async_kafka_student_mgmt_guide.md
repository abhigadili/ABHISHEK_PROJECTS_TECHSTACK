# Student Management Microservices — Asynchronous, Layered, Kafka

A beginner-friendly walkthrough of how this project was built and how to run
it: four independent Spring Boot microservices implementing a Student
Management System, using **Kafka for all cross-service communication** (no
WebClient/RestClient/OpenFeign calls between services) and a hand-written
**Controller → Service → DAO layered architecture** (no Spring Data
repositories, no JPA/Hibernate).

Project location: `Documents/Java_Projects/SPRINGB-student-mgmt-async-layered-kafka`

This is a sibling of `SPRINGB-student-mgmt-sync-repository-OpenFeign`, which
implements the same business idea (Student, Course, Enrollment, Notification)
but the opposite way: **synchronous** HTTP calls (OpenFeign) between services,
and Spring Data **repository** interfaces for persistence. Reading both side
by side is a good way to see what "async + layered" actually buys you over
"sync + repository."

| | Sync/Repository/OpenFeign variant | **This variant** |
|---|---|---|
| Cross-service calls | Blocking HTTP (`StudentFeignClient.exists()`) | Kafka events, no blocking calls at all |
| Persistence | Spring Data JPA repository interfaces + Hibernate | Hand-written DAOs on top of `JdbcTemplate` |
| Enrollment creation | `POST` blocks until student+course are verified, returns final result | `POST` returns immediately (`202 Accepted`) as `PENDING_VALIDATION`; client polls for the final status |
| Failure mode | If student-service is down, the `POST` fails outright | If student-service is down, the enrollment just stays `PENDING_VALIDATION` until it comes back |

---

## 1. Architecture at a glance

```
                    ┌───────────────────┐
   POST /enrollments│ enrollment-service │  owns EnrollmentDB
   ─────────────────▶  (port 8083)       │
                    └─────────┬──────────┘
                              │ publish: enrollment.requested
                 ┌────────────┴────────────┐
                 ▼                         ▼
        ┌────────────────┐        ┌────────────────┐
        │ student-service │        │ course-service  │
        │  (port 8081)    │        │  (port 8082)    │
        │  owns StudentDB │        │  owns CourseDB  │
        └────────┬────────┘        └────────┬────────┘
                 │ publish:                  │ publish:
                 │ student.validation.result │ course.validation.result
                 └────────────┬───────────────┘
                              ▼
                    ┌───────────────────┐
                    │ enrollment-service │  (same service, consumer side)
                    │  saga resolves:    │
                    │  both valid?       │
                    └─────────┬──────────┘
                    publish: enrollment.confirmed
                          or  enrollment.rejected
                              │
                              ▼
                  ┌─────────────────────┐
                  │ notification-service │  owns NotificationDB
                  │   (port 8084)        │
                  │  writes Notification │
                  │  + Email/SMS log rows│
                  └─────────────────────┘
```

Nothing in this diagram is a synchronous HTTP call between services — every
arrow after the initial client `POST` is a Kafka topic. The only synchronous
HTTP calls in the whole system are the ones a human/Postman/curl makes
directly against one service's own REST API (e.g. `GET /api/students`,
`POST /api/enrollments`).

### Why this shape

The old (sync) version had `enrollment-service` call
`StudentFeignClient.exists(studentId)` and `CourseFeignClient.exists(courseId)`
and block until both answered before writing anything to EnrollmentDB. That's
simple to reason about, but it means enrollment-service's availability is now
coupled to student-service's and course-service's availability — if either is
briefly down, enrollment fails outright.

The async version accepts the request immediately, records it as
`PENDING_VALIDATION`, and lets student-service and course-service answer
whenever they're ready (this pattern is sometimes called a **choreography
saga** — there's no central orchestrator, each service reacts to events on
its own). The trade-off: the client no longer gets an immediate yes/no; it
has to poll (or, in a real system, subscribe to a webhook/websocket) to learn
the outcome.

---

## 2. Layered Architecture — what "layered, not repository" means here

Every service is organized the same way, under `com.studentmgmt.<service>`:

```
model/        plain POJOs (no @Entity, no @Id, no JPA annotations at all)
dto/          request/response shapes used only at the REST boundary
event/        Kafka message POJOs — see "why every service has its own copy" below
dao/          interface + JdbcTemplate-backed impl, one pair per table
service/      interface + impl — business rules, calls the DAO, may call Kafka producers
controller/   @RestController classes — thin, just delegate to a service
kafka/        Kafka producer wrapper(s) and @KafkaListener consumer(s)
config/       (only enrollment-service needs anything here beyond application.properties)
exception/    ResourceNotFoundException + a @RestControllerAdvice GlobalExceptionHandler
```

The request always flows **Controller → Service → DAO → database**, and
never skips a layer. Compare this to the sync/repository sibling project,
where `@Repository` came from `JpaRepository<Student, Long>` (an interface
Spring Data implements for you at runtime) — here `StudentDao` is a plain
interface and `StudentDaoImpl` is a real class you can open and read,
hand-written with `org.springframework.jdbc.core.JdbcTemplate`. There's no
Hibernate session, no lazy-loading, no `@Transactional` proxy magic — every
SQL statement executed by the app is visible in the DAO layer, in plain SQL
strings.

**Why `JdbcTemplate` and not raw `java.sql.Connection`/`PreparedStatement`?**
The requirement was "avoid JPA/Hibernate/JDBC if possible, otherwise use as
you wish." `JdbcTemplate` is Spring's thin wrapper *around* JDBC — it still
issues plain SQL and gets back a `ResultSet`, but it handles opening/closing
`Connection`s and `PreparedStatement`s and translates `SQLException` into
Spring's unchecked `DataAccessException` hierarchy. That gets us out of
hand-rolling connection management in every DAO method while staying well
short of an ORM.

---

## 3. Kafka topics — the actual cross-service contract

| Topic | Producer | Consumer(s) | Payload |
|---|---|---|---|
| `enrollment.requested` | enrollment-service | student-service, course-service | `{enrollmentId, studentId, courseId, requestedAt}` |
| `student.validation.result` | student-service | enrollment-service | `{enrollmentId, valid, reason, source, checkedAt}` |
| `course.validation.result` | course-service | enrollment-service | `{enrollmentId, valid, reason, source, checkedAt}` |
| `enrollment.confirmed` | enrollment-service | notification-service | `{enrollmentId, studentId, courseId, status, reason, occurredAt}` |
| `enrollment.rejected` | enrollment-service | notification-service | same shape as above, `status="REJECTED"` |

Messages are plain **JSON strings** (Kafka's built-in `StringSerializer` /
`StringDeserializer`), hand-serialized with Jackson's `ObjectMapper` inside
each `kafka/` producer/listener class — there's no Avro schema registry, no
custom Kafka `Serializer<T>` class to write.

**Why does every service define its own copy of each event class**, instead
of sharing one `enrollment-events` jar across all four services? Because the
JSON on the topic — the field names — is the real contract, not any
particular Java class. If enrollment-service and student-service shared a
jar, upgrading that jar would force you to redeploy every service that
depends on it, which defeats the point of having independent microservices.
Each service instead keeps its own minimal copy of the fields it actually
reads or writes (you'll find `EnrollmentRequestedEvent.java` duplicated,
nearly identically, in `student-service`, `course-service`, and
`enrollment-service` — that's intentional, not an oversight).

Consumer groups (one per service, e.g. `student-service-group`) mean each
service's listener sees every message on the topics it subscribes to, and
Kafka tracks its own read offset independently of the other services.

---

## 4. The enrollment saga, step by step

1. **Client calls `POST /api/enrollments`** on enrollment-service with
   `{studentId, courseId}`.
2. enrollment-service inserts an `Enrollments` row with status
   `PENDING_VALIDATION`, inserts a matching `Enrollment_Validation` tracking
   row (both `student_valid`/`course_valid` start `NULL`), and publishes
   `enrollment.requested`. It responds **`202 Accepted`** immediately — this
   is not the final answer.
3. **student-service**'s `EnrollmentRequestedListener` consumes the message,
   checks `studentId` against its own `Students` table, and publishes a
   `ValidationResultEvent` to `student.validation.result`.
4. **course-service**'s `EnrollmentRequestedListener` does the same
   independently, checking `courseId` against its own `Courses` table, and
   publishes to `course.validation.result`.
5. **enrollment-service** has two listeners
   (`StudentValidationResultListener`, `CourseValidationResultListener`),
   each of which calls `EnrollmentSagaServiceImpl`. Every time either reply
   arrives, the saga service writes it into the `Enrollment_Validation` row
   and checks: *do I now have both replies?*
   - If not yet — it just waits; the other reply will trigger the check again.
   - If both are in and both are valid → status becomes `CONFIRMED`, and
     `EnrollmentOutcomeEvent` is published to `enrollment.confirmed`.
   - If both are in and at least one is invalid → status becomes
     `REJECTED` (with a `rejectionReason` explaining which side failed), and
     the event goes to `enrollment.rejected` instead.
6. **notification-service**'s `EnrollmentOutcomeListener` consumes both
   outcome topics, and `EnrollmentOutcomeServiceImpl` writes a `Notification`
   row plus a matching `Email_Logs` row (and, for confirmations only, an
   `SMS_Logs` row too) — simulated as `SENT` immediately, since there's no
   real email/SMS gateway wired up (same simplification the sync/OpenFeign
   sibling project makes).
7. **Client polls `GET /api/enrollments/{id}`** until `statusName` reads
   `CONFIRMED` or `REJECTED`. In this project's test run the whole round
   trip — steps 2 through 6 — consistently finished in **under one second**,
   fast enough that a single poll already saw the resolved status.

`Payments` stay a plain, local, synchronous CRUD resource inside
enrollment-service — there's no other service involved in creating a
payment, so there was nothing to make asynchronous.

---

## 5. Running it locally

### Prerequisites already on this machine
- Java 21, Maven 3.8 (`java -version`, `mvn -version`)
- Docker + Docker Compose (used only for the Kafka broker)
- A local MySQL server already running on `127.0.0.1:3306` with user
  `abhig` / password `Pass@123` (same credentials the sync/OpenFeign sibling
  project uses — override via `DB_USERNAME`/`DB_PASSWORD` env vars if yours differ)

### Step 1 — build everything
```bash
cd Documents/Java_Projects/SPRINGB-student-mgmt-async-layered-kafka
mvn -DskipTests clean package
```
This produces one runnable jar per service under each module's `target/`
directory. A full reactor build of all four modules ended in **BUILD
SUCCESS** with no errors.

### Step 2 — start Kafka
```bash
docker compose up -d
```
This starts a single-broker Kafka cluster in **KRaft mode** (no Zookeeper
needed) via `docker-compose.yml`, exposed on **`localhost:9094`** — not the
Kafka default `9092`, because this machine already had an unrelated Kafka
container from another project bound to that port. If your machine doesn't
have that conflict, you're still fine leaving it on `9094`; every service's
`application.properties` already points at it by default
(`KAFKA_BOOTSTRAP_SERVERS` env var to override).

### Step 3 — create the 4 databases
```bash
mysql -h 127.0.0.1 -u abhig -p < sql/01_student_db.sql
mysql -h 127.0.0.1 -u abhig -p < sql/02_course_db.sql
mysql -h 127.0.0.1 -u abhig -p < sql/03_enrollment_db.sql
mysql -h 127.0.0.1 -u abhig -p < sql/04_notification_db.sql
```
Each script drops-and-recreates its own database (`StudentDB`, `CourseDB`,
`EnrollmentDB`, `NotificationDB`) and inserts a handful of sample rows so the
GET endpoints have something to show immediately.

### Step 4 — start the four services
```bash
java -jar student-service/target/student-service.jar &
java -jar course-service/target/course-service.jar &
java -jar enrollment-service/target/enrollment-service.jar &
java -jar notification-service/target/notification-service.jar &
```
| Service | Port |
|---|---|
| student-service | 8081 |
| course-service | 8082 |
| enrollment-service | 8083 |
| notification-service | 8084 |

Give them ~10 seconds — on first boot each service's Kafka consumer will log
a few harmless `UNKNOWN_TOPIC_OR_PARTITION` / `NotCoordinatorException`
warnings while the broker auto-creates topics and settles group
coordination. These are not errors; they stop once the first real message
flows.

### Step 5 — tear down
```bash
# stop the 4 java processes, then:
docker compose down
```

---

## 6. Full request walkthrough (real output, captured from an actual run)

All of the responses below are exactly what this project returned when it
was run end-to-end — nothing here is hypothetical.

**1. List the seeded students**
```
GET http://localhost:8081/api/students
```
```json
[{"studentId":1,"firstName":"Aarav","lastName":"Sharma","email":"aarav.sharma@example.com", ...}, ...]
```
5 students come back — the sample rows from `01_student_db.sql`.

**2. List the seeded courses**
```
GET http://localhost:8082/api/courses
```
Returns the 6 sample courses from `02_course_db.sql` (CS101, CS201, DS101, DS201, BU101, DZ101).

**3. Create a valid enrollment — student 2 ("Diya Patel"), course 3 ("Python for Data Analysis")**
```
POST http://localhost:8083/api/enrollments
Content-Type: application/json

{"studentId":2,"courseId":3}
```
```
HTTP/1.1 202 Accepted

{"enrollmentId":5,"studentId":2,"courseId":3,"statusId":1,
 "statusName":"PENDING_VALIDATION","enrollmentDate":"2026-07-02", ...}
```
Notice the status code: **202 Accepted**, not 201 Created — the row exists,
but the saga hasn't resolved it yet.

**4. Poll until the saga resolves it**
```
GET http://localhost:8083/api/enrollments/5
```
```
poll 1: {"enrollmentId":5,"studentId":2,"courseId":3,"statusId":2,
         "statusName":"CONFIRMED","enrollmentDate":"2026-07-02", ...}
```
Resolved to `CONFIRMED` by the very first poll — student 2 and course 3 both
passed validation over Kafka in well under a second.

**5. Check the notification it triggered**
```
GET http://localhost:8084/api/notifications?enrollmentId=5
```
```json
[
  {"notificationId":4,"enrollmentId":5,"recipientId":2,"eventType":"ENROLLMENT_CONFIRMED",
   "channel":"EMAIL","subject":"Enrollment Confirmed",
   "message":"Your enrollment (id 5) in course 3 is confirmed.","status":"SENT", ...},
  {"notificationId":5,"enrollmentId":5,"recipientId":2,"eventType":"ENROLLMENT_CONFIRMED",
   "channel":"SMS","message":"Your enrollment (id 5) in course 3 is confirmed.","status":"SENT", ...}
]
```
Two notifications — EMAIL and SMS — both created by
`EnrollmentOutcomeServiceImpl` in response to the `enrollment.confirmed`
Kafka message, with a matching row in `Email_Logs`/`SMS_Logs` each:
```
GET http://localhost:8084/api/email-logs   -> includes emailLogId 3, toEmail "student2@example.com"
GET http://localhost:8084/api/sms-logs     -> includes smsLogId 2, toPhone "N/A" (simulated, no real SMS gateway)
```

**6. Now the rejection path — an enrollment for a student that doesn't exist**
```
POST http://localhost:8083/api/enrollments
Content-Type: application/json

{"studentId":9999,"courseId":1}
```
```
HTTP/1.1 202 Accepted

{"enrollmentId":6,"studentId":9999,"courseId":1,"statusId":1,
 "statusName":"PENDING_VALIDATION", ...}
```
Poll it:
```
GET http://localhost:8083/api/enrollments/6
```
```json
{"enrollmentId":6,"studentId":9999,"courseId":1,"statusId":3,
 "statusName":"REJECTED",
 "rejectionReason":"Student 9999 does not exist in StudentDB", ...}
```
student-service correctly reported `valid: false` for student 9999 over
`student.validation.result`; course-service reported `valid: true` for
course 1 over `course.validation.result`; enrollment-service's saga combined
both replies and rejected the enrollment with a reason that names exactly
which side failed. notification-service reacted with a single explanatory
EMAIL (no SMS is sent on rejection, by this project's design choice):
```json
[{"notificationId":6,"eventType":"ENROLLMENT_REJECTED","channel":"EMAIL",
  "subject":"Enrollment Rejected",
  "message":"Your enrollment (id 6) in course 1 was rejected: Student 9999 does not exist in StudentDB",
  "status":"SENT", ...}]
```

**7. Proof both async replies were actually recorded — the `Enrollment_Validation` table**
```sql
SELECT * FROM EnrollmentDB.Enrollment_Validation WHERE enrollment_id IN (5,6);
```
```
enrollment_id: 5   student_valid: 1   student_reason: Student 2 exists
                   course_valid:  1   course_reason:  Course 3 exists

enrollment_id: 6   student_valid: 0   student_reason: Student 9999 does not exist in StudentDB
                   course_valid:  1   course_reason:  Course 1 exists
```
This table is the mechanism that makes the choreography saga work without a
central orchestrator: each side writes its own column independently, in
whatever order its Kafka message happens to arrive, and
`EnrollmentSagaServiceImpl` only makes a final decision once both columns
are non-`NULL`.

**8. Payment stays a normal synchronous local resource — no Kafka involved**
```
POST http://localhost:8083/api/payments
{"enrollmentId":5,"amount":18000.00,"paymentMethod":"UPI","transactionRef":"TXN-DEMO-001"}
```
```
HTTP/1.1 201 Created
{"paymentId":5,"enrollmentId":5,"amount":18000.00,"paymentMethod":"UPI",
 "paymentStatus":"PENDING","transactionRef":"TXN-DEMO-001", ...}
```

---

## 7. Where to look in the code for each concept

| Concept | File |
|---|---|
| Choreography saga decision logic | `enrollment-service/.../service/EnrollmentSagaServiceImpl.java` |
| Publishing the initial trigger event | `enrollment-service/.../kafka/EnrollmentRequestedProducer.java` |
| A DAO built on `JdbcTemplate` (no JPA) | `student-service/.../dao/StudentDaoImpl.java` |
| A Kafka consumer replacing an old Feign call | `student-service/.../kafka/EnrollmentRequestedListener.java` |
| The tracking table for partial saga progress | `sql/03_enrollment_db.sql` → `Enrollment_Validation` |
| Reacting to a saga outcome (notifications) | `notification-service/.../service/EnrollmentOutcomeServiceImpl.java` |
| Kafka broker setup (KRaft, no Zookeeper) | `docker-compose.yml` |

---

## 8. Summary

This project proves out a specific architectural pair: **layered
(Controller/Service/DAO with hand-written `JdbcTemplate` DAOs) +
choreography-over-Kafka** for a 4-service system that used to be
**repository-pattern + synchronous OpenFeign**. The functional behavior is
the same (students, courses, enrollments, notifications), but the failure
characteristics and the request lifecycle for creating an enrollment are
fundamentally different: nothing blocks on another service ever being up at
that exact moment, at the cost of the client no longer getting an immediate
final answer.
