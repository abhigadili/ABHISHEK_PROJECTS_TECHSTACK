# Student Management Microservices — Asynchronous, API Gateway, Kafka

A beginner-friendly walkthrough of how this project was built and how to run it: four
independent Spring Boot microservices implementing a Student Management System, using
**Kafka for all cross-service communication** (no WebClient/RestClient/OpenFeign between
services), **standard Spring Data JPA** for persistence, and a fifth module — **Spring Cloud
Gateway** — as the single client-facing entry point that hides the four backend services
behind one address.

Project location: `Documents/Java_Projects/SPRINGB-student-mgmt-async-api-gateway-pattern-kafka`

This is the third project in a family that all implement the same Student Management System
(Student, Course, Enrollment, Notification) but demonstrate different architectural choices:

| Project | Cross-service calls | Persistence | Client entry point |
|---|---|---|---|
| `SPRINGB-student-mgmt-sync-repository-OpenFeign` | Synchronous (OpenFeign) | Spring Data JPA repositories | Each service's own port |
| `SPRINGB-student-mgmt-async-layered-kafka` | Asynchronous (Kafka) | Hand-written `JdbcTemplate` DAOs, no JPA | Each service's own port |
| **This project** | **Asynchronous (Kafka)** | **Spring Data JPA repositories** | **One gateway (port 8080)** |

Only two things changed versus the layered-Kafka sibling: persistence went back to plain JPA
(this prompt never asked to avoid Hibernate), and a real API Gateway was put in front of
everything. The Kafka saga itself — the actual "asynchronous communication" part — is the
identical design proven in that project, just re-implemented against `JpaRepository` instead of
hand-written DAOs.

---

## 1. Architecture at a glance

```
                         ┌─────────────────┐
        every client ───▶│   api-gateway    │  port 8080 — the ONLY address
        request          │ (Spring Cloud     │  a client needs to know
                         │  Gateway)         │
                         └─────────┬────────┘
                    path-based routing, no business logic
        ┌──────────────┬──────────────┬──────────────────┬──────────────────┐
        ▼              ▼              ▼                  ▼
┌───────────────┐ ┌───────────────┐ ┌────────────────────┐ ┌────────────────────┐
│student-service│ │course-service │ │ enrollment-service  │ │notification-service│
│  port 8081    │ │  port 8082    │ │   port 8083         │ │   port 8084         │
│  StudentDB    │ │  CourseDB     │ │   EnrollmentDB      │ │   NotificationDB    │
└───────┬───────┘ └───────┬───────┘ └──────────┬──────────┘ └──────────▲──────────┘
        │                 │                    │ publish:              │
        │                 │        enrollment.requested                │
        │◀────────────────┴────────────────────┘                       │
        │ publish: student.validation.result                           │
        │                 │ publish: course.validation.result          │
        └─────────────────┴───────────────────▶ enrollment-service     │
                                                  (saga resolves both)  │
                                                  publish: enrollment.confirmed
                                                  or       enrollment.rejected
                                                  ─────────────────────▶┘
```

Everything below the gateway box is exactly the Kafka choreography saga from the layered-Kafka
project — the gateway sits *in front of* that system, it doesn't change how the services talk to
each other.

### Why add an API Gateway here

Without a gateway, a client (or a frontend app) needs to know that students live on port 8081,
courses on 8082, enrollments on 8083, and notifications on 8084 — four different addresses for
one logical system. The **API Gateway pattern** collapses that down to one address: the gateway
inspects the request path and forwards it to whichever backend service owns that path. The
client never needs to know the backend topology exists, and if a backend service's port or host
ever changes, only the gateway's route table needs updating — every client is unaffected.

This is a different kind of pattern than "layered" or "repository" — those describe how a
*single service* is organized internally (Controller → Service → DAO, or JPA repositories).
API Gateway describes how *the whole system* presents itself to the outside world. The two are
orthogonal: this project happens to use plain JPA internally (like the OpenFeign project) while
using the Gateway pattern externally (unlike either sibling).

---

## 2. The Kafka topics and saga (identical design to the layered-Kafka project)

| Topic | Producer | Consumer(s) | Payload |
|---|---|---|---|
| `enrollment.requested` | enrollment-service | student-service, course-service | `{enrollmentId, studentId, courseId, requestedAt}` |
| `student.validation.result` | student-service | enrollment-service | `{enrollmentId, valid, reason, source, checkedAt}` |
| `course.validation.result` | course-service | enrollment-service | `{enrollmentId, valid, reason, source, checkedAt}` |
| `enrollment.confirmed` | enrollment-service | notification-service | `{enrollmentId, studentId, courseId, status, reason, occurredAt}` |
| `enrollment.rejected` | enrollment-service | notification-service | same shape, `status="REJECTED"` |

Flow for `POST /api/enrollments`:

1. enrollment-service inserts an `Enrollments` row as `PENDING_VALIDATION` (status id 1), inserts
   a matching `Enrollment_Validation` tracking row (both `student_valid`/`course_valid` start
   `NULL`), and publishes `enrollment.requested`. It responds **`202 Accepted`** immediately.
2. student-service and course-service each independently check their own database and reply on
   their own topic.
3. enrollment-service's two listeners (`StudentValidationResultListener`,
   `CourseValidationResultListener`) each update the `Enrollment_Validation` row and check: are
   *both* columns now filled in? Once they are, the saga decides `CONFIRMED` (both valid) or
   `REJECTED` (either invalid, with a reason naming which side failed), updates the `Enrollments`
   row, and publishes the matching outcome event.
4. notification-service reacts to the outcome — writing a `Notifications` row plus a matching
   `Email_Logs`/`SMS_Logs` row, simulated as `SENT` (no real email/SMS gateway is wired up, same
   simplification as the sibling projects).
5. The client polls `GET /api/enrollments/{id}` until `statusId` moves to 2 (`CONFIRMED`) or 3
   (`REJECTED`) — every single request in this guide, including that poll, goes through the
   gateway at port 8080.

`Payments` stays a plain, local, synchronous CRUD resource on enrollment-service — there's no
other service involved in creating a payment, so nothing about it needed to become async.

---

## 3. Persistence: standard Spring Data JPA (unlike the layered-Kafka sibling)

Every entity here is a normal `@Entity` class with `@Id`/`@Column`/`@GeneratedValue`, and every
repository is a one-line `interface FooRepository extends JpaRepository<Foo, Long>` — exactly the
style used in the original `SPRINGB-student-mgmt-sync-repository-OpenFeign` project. Services are
plain `@Service` classes that call the repository directly; there's no separate DAO layer to
open and read (compare this to the layered-Kafka sibling, where every SQL statement was visible
by hand in a `XxxDaoImpl` class).

**New entity not present in the OpenFeign project**: `EnrollmentValidation`
(`enrollment-service/.../entity/EnrollmentValidation.java`) — its `@Id` is the enrollment id
itself (no `@GeneratedValue`), because it's a 1:1 tracking row keyed by the enrollment it belongs
to, not an independently auto-incrementing table.

### A real bug this project's build run into — and why it matters

The very first live test of the saga **got stuck**: an enrollment sat in `PENDING_VALIDATION`
forever, even though both student-service and course-service had replied. The cause was a classic
**lost-update race condition**:

```java
// What the code originally did (buggy):
EnrollmentValidation validation = repository.findById(enrollmentId).orElseThrow(...);
validation.setStudentValid(valid);      // only touches ONE field in memory
repository.save(validation);            // but Hibernate's save() issues a FULL-ROW UPDATE
```

`student.validation.result` and `course.validation.result` are handled by **two different Kafka
listener threads**, running at essentially the same instant. If Thread A (course) loads the row,
sets `courseValid`, and saves — and then Thread B (student) had *already* loaded its own copy of
the row *before* Thread A's save committed — Thread B's save will write back the version of
`courseValid` it originally read (`null`), silently erasing Thread A's update. Both listeners logged
"still waiting on the other reply" forever, because each one's own update was overwriting the
other's.

The fix: replace the load-mutate-save with a **targeted bulk `@Modifying` JPQL update** that only
ever touches the one column each listener owns —

```java
@Modifying
@Query("UPDATE EnrollmentValidation e SET e.studentValid = :valid, e.studentReason = :reason, " +
       "e.studentCheckedAt = CURRENT_TIMESTAMP WHERE e.enrollmentId = :enrollmentId")
void updateStudentResult(@Param("enrollmentId") Long enrollmentId, @Param("valid") boolean valid, @Param("reason") String reason);
```
(`enrollment-service/.../repository/EnrollmentValidationRepository.java`)

This is exactly what the hand-written `JdbcTemplate` version in the layered-Kafka sibling did by
construction — its DAO issued `UPDATE ... SET student_valid = ? WHERE enrollment_id = ?`, a
single-column statement, so it was never exposed to this race in the first place. This is a good
example of a trade-off that isn't obvious until you hit it live: JPA's convenience (`save()` on a
full entity) can hide exactly the kind of race condition that concurrent Kafka consumers create,
whereas a targeted SQL/JPQL update sidesteps it entirely. After the fix, every enrollment created
resolved on the very first poll, consistently in well under a second.

---

## 4. Running it locally

### Prerequisites already on this machine
- Java 21, Maven 3.8
- Docker + Docker Compose (for the Kafka broker only)
- A local MySQL server on `127.0.0.1:3306`, user `abhig` / password `Pass@123` (same as the
  sibling projects — override via `DB_USERNAME`/`DB_PASSWORD` env vars if yours differ)

### Step 1 — build everything
```bash
cd Documents/Java_Projects/SPRINGB-student-mgmt-async-api-gateway-pattern-kafka
mvn -DskipTests clean package
```
A full reactor build of all **five** modules (student-service, course-service, enrollment-service,
notification-service, api-gateway) ends in **BUILD SUCCESS**.

### Step 2 — start Kafka
```bash
docker compose up -d
```
Single-broker Kafka in **KRaft mode** (no Zookeeper), exposed on **`localhost:9095`** — not 9092
(already used by an unrelated container on this machine) and not 9094 (used by the sibling
layered-Kafka project's own broker, in case both are ever run side by side).

### Step 3 — create the 4 databases
```bash
mysql -h 127.0.0.1 -u abhig -p < sql/01_student_db.sql
mysql -h 127.0.0.1 -u abhig -p < sql/02_course_db.sql
mysql -h 127.0.0.1 -u abhig -p < sql/03_enrollment_db.sql
mysql -h 127.0.0.1 -u abhig -p < sql/04_notification_db.sql
```

### Step 4 — start all five services
```bash
java -jar student-service/target/student-service.jar &
java -jar course-service/target/course-service.jar &
java -jar enrollment-service/target/enrollment-service.jar &
java -jar notification-service/target/notification-service.jar &
java -jar api-gateway/target/api-gateway.jar &
```
| Service | Port |
|---|---|
| **api-gateway** | **8080 — the only port a client should ever call** |
| student-service | 8081 |
| course-service | 8082 |
| enrollment-service | 8083 |
| notification-service | 8084 |

Give them ~10–15 seconds to finish starting (the gateway is the slowest, since it needs to load
its reactive Netty server). A few harmless `UNKNOWN_TOPIC_OR_PARTITION` / `NotCoordinatorException`
warnings in the backend logs during the first moments are normal Kafka topic auto-creation
settling, not errors.

### Step 5 — tear down
```bash
# stop all 5 java processes, then:
docker compose down
```

### Gateway route table (`api-gateway/src/main/resources/application.yml`)

| Path predicate | Forwards to |
|---|---|
| `/api/students/**`, `/api/student-addresses/**`, `/api/student-documents/**`, `/api/student-logins/**` | `http://localhost:8081` |
| `/api/courses/**`, `/api/course-categories/**`, `/api/course-schedules/**`, `/api/course-faculty/**` | `http://localhost:8082` |
| `/api/enrollments/**`, `/api/enrollment-statuses/**`, `/api/payments/**` | `http://localhost:8083` |
| `/api/notifications/**`, `/api/email-logs/**`, `/api/sms-logs/**` | `http://localhost:8084` |

No path rewriting happens anywhere — the backend controllers already expose these exact
`/api/...` paths, so the gateway just forwards the request as-is. A request to any path not
listed here (e.g. `/api/does-not-exist`) gets a plain `404` straight from the gateway, since no
route predicate matches it.

---

## 5. Full request walkthrough (real output, captured from an actual run — through the gateway only)

Every single request below was sent to **`http://localhost:8080`** — never directly to a backend
service port — to prove the gateway is genuinely in the path for the whole system.

**1. List the seeded students**
```
GET http://localhost:8080/api/students
```
Gateway forwards this to student-service (`localhost:8081`) based on the `Path=/api/students/**`
predicate. Returns the 5 sample rows from `01_student_db.sql`.

**2. List the seeded courses**
```
GET http://localhost:8080/api/courses
```
Forwards to course-service (`localhost:8082`). Returns the 6 sample courses.

**3. Create a valid enrollment — student 2 ("Diya Patel"), course 3 ("Python for Data Analysis")**
```
POST http://localhost:8080/api/enrollments
Content-Type: application/json

{"studentId":2,"courseId":3}
```
```
HTTP/1.1 202 Accepted
{"enrollmentId":6,"studentId":2,"courseId":3,"statusId":1,"enrollmentDate":"2026-07-02"}
```
(This is the enrollment created *after* the race-condition fix described in section 3 — the
`enrollmentId":5` request made just before the fix is still visible in the database, permanently
stuck at `statusId:1`, as a live artifact of the exact bug this guide documents.)

**4. Poll until the saga resolves it**
```
GET http://localhost:8080/api/enrollments/6
```
```
poll 1: {"enrollmentId":6,"studentId":2,"courseId":3,"statusId":2, ...}
```
Resolved to `statusId:2` (`CONFIRMED`, per `GET /api/enrollment-statuses`) on the very first poll.

**5. Check the notification it triggered**
```
GET http://localhost:8080/api/notifications?enrollmentId=6
```
```json
[
  {"notificationId":4,"eventType":"ENROLLMENT_CONFIRMED","channel":"EMAIL",
   "subject":"Enrollment Confirmed","message":"Your enrollment (id 6) in course 3 is confirmed.",
   "status":"SENT", ...},
  {"notificationId":5,"eventType":"ENROLLMENT_CONFIRMED","channel":"SMS",
   "message":"Your enrollment (id 6) in course 3 is confirmed.","status":"SENT", ...}
]
```
Backed by matching rows in `Email_Logs` (`toEmail: "student2@example.com"`, simulated) and
`SMS_Logs` (`toPhone: "N/A"`, simulated — no real gateway).

**6. The rejection path — an enrollment for a student that doesn't exist**
```
POST http://localhost:8080/api/enrollments
{"studentId":9999,"courseId":1}
```
```
HTTP/1.1 202 Accepted
{"enrollmentId":7,"studentId":9999,"courseId":1,"statusId":1, ...}
```
Poll it:
```
GET http://localhost:8080/api/enrollments/7
```
```json
{"enrollmentId":7,"studentId":9999,"courseId":1,"statusId":3,
 "rejectionReason":"Student 9999 does not exist in StudentDB", ...}
```
`statusId:3` is `REJECTED`. course-service correctly reported course 1 as valid; student-service
correctly reported student 9999 as invalid; the saga combined both replies and named exactly
which side failed. notification-service reacted with a single explanatory EMAIL (no SMS on
rejection, by design):
```json
[{"eventType":"ENROLLMENT_REJECTED","channel":"EMAIL","subject":"Enrollment Rejected",
  "message":"Your enrollment (id 7) in course 1 was rejected: Student 9999 does not exist in StudentDB",
  "status":"SENT", ...}]
```

**7. Payment — a normal synchronous local resource, no Kafka involved**
```
POST http://localhost:8080/api/payments
{"enrollmentId":6,"amount":18000.00,"paymentMethod":"UPI","transactionRef":"TXN-DEMO-001"}
```
```
HTTP/1.1 201 Created
{"paymentId":5,"enrollmentId":6,"amount":18000.00,"paymentMethod":"UPI","transactionRef":"TXN-DEMO-001"}
```

**8. Proof the gateway actually gatekeeps — an unmapped path**
```
GET http://localhost:8080/api/does-not-exist
```
```
HTTP/1.1 404 Not Found
```
No route predicate matches this path, so the gateway itself returns 404 — the request never
reaches any backend service.

A scan of all five services' logs after this run found zero real errors or exceptions (the
Kafka rebalance/topic-not-found lines during startup are informational, not failures).

---

## 6. Where to look in the code for each concept

| Concept | File |
|---|---|
| Gateway route table | `api-gateway/src/main/resources/application.yml` |
| Choreography saga decision logic | `enrollment-service/.../service/EnrollmentSagaService.java` |
| The lost-update fix (targeted JPQL update) | `enrollment-service/.../repository/EnrollmentValidationRepository.java` |
| Standard JPA entity (no DAO layer) | `student-service/.../entity/Student.java` + `.../repository/StudentRepository.java` |
| A Kafka consumer replacing an old Feign call | `student-service/.../kafka/EnrollmentRequestedListener.java` |
| Reacting to a saga outcome (notifications) | `notification-service/.../service/EnrollmentOutcomeService.java` |
| Kafka broker setup (KRaft, no Zookeeper) | `docker-compose.yml` |

---

## 7. Summary

This project pairs **API Gateway** (one address, path-based routing, zero business logic in the
gateway itself) with **choreography-over-Kafka** for the actual enrollment workflow, and plain
**Spring Data JPA** for persistence — deliberately the "normal" persistence choice, to isolate the
gateway as the one new variable versus the OpenFeign sibling. Building it live surfaced a real,
non-obvious concurrency bug (the lost-update race between two Kafka listener threads sharing one
row) that a hand-written DAO with targeted SQL updates would never have hit, and fixing it with a
targeted JPQL `@Modifying` query is the idiomatic JPA equivalent of that same discipline.
