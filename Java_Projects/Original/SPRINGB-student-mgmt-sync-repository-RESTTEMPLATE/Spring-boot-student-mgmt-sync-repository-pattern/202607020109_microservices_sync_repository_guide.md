# Student Management Microservices — Synchronous Communication, Repository Pattern

A beginner-friendly walkthrough of how this system was built: four independent
Spring Boot microservices, each owning its own MySQL database, communicating
with each other **only synchronously** over REST, using the Repository
Pattern with Spring Data JPA + Hibernate.

Project location: `Documents/Java_Projects/Spring-boot-student-mgmt-sync-repository-pattern`

---

## 1. The big picture

This system manages student enrollment in courses. It is deliberately split
into **four separate deployable services**, each with **its own database** —
this is the "database per service" pattern, the foundation of microservices
architecture:

| Service | Port | Owns database | Tables |
|---|---|---|---|
| `student-service` | 8091 | `StudentDB` | Students, Student_Address, Student_Documents, Student_Login |
| `course-service` | 8092 | `CourseDB` | Courses, Course_Category, Course_Schedule, Course_Faculty |
| `notification-service` | 8094 | `NotificationDB` | Notifications, Email_Logs, SMS_Logs |
| `enrollment-service` | 8093 | `EnrollmentDB` | Enrollments, Enrollment_Status, Payments |

Each service is a completely independent Spring Boot application with its own
`main()`, its own port, and its own database connection. None of them share
code, a database connection pool, or a JAR. The only way they talk to each
other is over HTTP — exactly like they would if they were deployed on
different machines.

```
                 ┌──────────────────┐
                 │  student-service │  StudentDB
                 │      :8091       │
                 └────────▲─────────┘
                          │ GET /api/students/{id}/exists
                          │ GET /api/students/{id}
┌──────────────────┐      │      ┌──────────────────────┐
│  course-service   │◄─────┤      │  notification-service│  NotificationDB
│      :8092        │      │      │        :8094         │
└────────▲───────────┘     │      └───────────▲──────────┘
         │ GET .../exists  │                  │ POST /api/notifications/send
         │                 │                  │
         │           ┌─────┴──────────────────┴───┐
         └───────────┤     enrollment-service      │  EnrollmentDB
                      │           :8093             │
                      └──────────────────────────────┘
```

`enrollment-service` is the only service that calls its peers — it validates
references and triggers notifications. The other three never call anyone;
they just serve their own data.

---

## 2. Why the databases don't have foreign keys across services

Look at `EnrollmentDB.Enrollments`:

```sql
CREATE TABLE Enrollments (
    enrollment_id    BIGINT AUTO_INCREMENT PRIMARY KEY,
    student_id       BIGINT NOT NULL,   -- reference to StudentDB.Students.student_id
    course_id        BIGINT NOT NULL,   -- reference to CourseDB.Courses.course_id
    status_id        BIGINT NOT NULL,
    ...
    CONSTRAINT fk_enrollment_status FOREIGN KEY (status_id) REFERENCES Enrollment_Status(status_id)
);
```

`status_id` has a real foreign key — `Enrollment_Status` lives in the *same*
database, owned by the *same* service. But `student_id` and `course_id` have
**no** foreign key, even though they conceptually point at rows in other
tables.

This is intentional, not an oversight. `student_id` points into `StudentDB`,
which belongs to `student-service`. MySQL can't create a foreign key across
two separate databases/schemas that aren't guaranteed to be co-located in
this architecture, and even if it could, doing so would violate "database
per service" — `enrollment-service` would be reaching directly into another
service's private storage, bypassing its API entirely. If `student-service`
ever changed its schema, `enrollment-service` would break without ever
calling `student-service`'s code.

Instead, referential integrity for `student_id`/`course_id` is enforced at
the **application layer**, synchronously, right before the insert — see
`EnrollmentService.create()`:

```java
public Enrollment create(Enrollment enrollment) {
    if (!studentClient.exists(enrollment.getStudentId())) {
        throw new IllegalArgumentException("Student does not exist: " + enrollment.getStudentId());
    }
    if (!courseClient.exists(enrollment.getCourseId())) {
        throw new IllegalArgumentException("Course does not exist: " + enrollment.getCourseId());
    }
    ...
    return enrollmentRepository.save(enrollment);
}
```

If either check fails, the method throws before `enrollmentRepository.save()`
is ever called — no invalid row is written.

---

## 3. Why synchronous communication (RestTemplate)

The requirement for this system was **synchronous-only** communication
between services. Spring offers several ways to call one service from
another; here's why `RestTemplate` was the right choice for this shape of
problem, and what the alternatives would have meant:

| Option | Synchronous? | Verdict for this project |
|---|---|---|
| **RestTemplate** | Yes — blocks until the peer responds | **Used.** Simple, mature, works with plain `spring-boot-starter-web` (already a dependency), no extra library needed. |
| WebClient (reactive) | Only if you call `.block()` | Built for non-blocking pipelines; using it purely to `.block()` adds the reactive dependency (`spring-boot-starter-webflux`) for no benefit here. |
| OpenFeign | Yes (blocking under the hood) | A declarative alternative (`@FeignClient` interfaces instead of manual `restTemplate.getForObject(...)` calls) — nicer for large numbers of peer calls, but pulls in Spring Cloud OpenFeign and typically pairs with service discovery (Eureka/Consul), which this system doesn't use. Overkill for three fixed, localhost peer URLs. |
| Message queue (Kafka/RabbitMQ) | No — that's asynchronous by definition | Explicitly ruled out — the requirement was synchronous-only. |

`RestTemplate` is the smallest, most direct tool that satisfies "synchronous
communication" without adding infrastructure this system doesn't need. Each
peer's base URL is externalised in `application.properties`:

```properties
services.student.base-url=${STUDENT_SERVICE_URL:http://localhost:8091}
services.course.base-url=${COURSE_SERVICE_URL:http://localhost:8092}
services.notification.base-url=${NOTIFICATION_SERVICE_URL:http://localhost:8094}
```

so pointing `enrollment-service` at different hosts (e.g. containers) never
requires a code change.

### The synchronous call chain, end to end

**Creating an enrollment** (`POST /api/enrollments`) blocks on two calls
before writing anything:

```
enrollment-service                student-service          course-service
       │  GET /api/students/{id}/exists  │                        │
       ├─────────────────────────────────►│                       │
       │◄─── {"exists": true} ────────────┤                       │
       │                                                          │
       │  GET /api/courses/{id}/exists                            │
       ├──────────────────────────────────────────────────────────►│
       │◄─── {"exists": true} ─────────────────────────────────────┤
       │
       │  (only now) save the Enrollment row
```

**Recording a successful payment** (`POST /api/payments`) chains three
synchronous calls:

```
enrollment-service        student-service         notification-service
       │  save Payment row
       │  flip Enrollment.status_id to 'Active'
       │
       │  GET /api/students/{id}   (need the student's email)
       ├──────────────────────────►│
       │◄─── {"email": "..."} ─────┤
       │
       │  POST /api/notifications/send
       ├───────────────────────────────────────────────────────────►│
       │◄─── 201 Created (Notification + Email_Logs row written) ────┤
       │
       │  return the Payment response to the original caller
```

Every arrow above is a blocking HTTP call — the calling thread in
`enrollment-service` is parked until the peer responds (or the 3s
connect-timeout / 5s read-timeout configured on the shared `RestTemplate`
bean fires). This was verified against the four running services:

```bash
curl -X POST http://localhost:8093/api/enrollments -d '{"studentId":3,"courseId":4}'
# -> 201, statusId defaulted to 'Pending'

curl -X POST http://localhost:8093/api/payments \
     -d '{"enrollmentId":8,"amount":25000.00,"paymentStatus":"Success",...}'
# -> 201

curl http://localhost:8093/api/enrollments/8
# -> statusId is now 'Active' (flipped by PaymentService)

curl "http://localhost:8094/api/notifications?recipientId=3"
# -> a new EMAIL notification, status SENT, with the correct student email
#    fetched synchronously from student-service moments earlier
```

---

## 4. Repository Pattern + JPA + Hibernate

Every service follows the same layering:

```
Controller  ->  Service  ->  Repository (Spring Data JPA)  ->  Hibernate  ->  MySQL
```

Each table has a `@Entity` class and a one-line repository interface — Spring
Data JPA generates the implementation (and every parameterised query) at
startup:

```java
@Entity
@Table(name = "Students")
public class Student { ... }

public interface StudentRepository extends JpaRepository<Student, Long> {
}
```

Services never see a `Connection`, a `Statement`, or a raw SQL string — they
only call methods like `studentRepository.findById(id)`. This is the same
Repository Pattern used in the earlier `cricket-universe-springboot` project
in this workspace, applied four times over, once per microservice.

`enrollment-service` additionally has a `client/` package
(`StudentClient`, `CourseClient`, `NotificationClient`) — these are **not**
part of the Repository Pattern; they're a separate concern (calling a peer
*service*, not a *database*). Keeping them in their own package makes that
distinction obvious when reading the code.

---

## 5. A subtle bug this build caught: case-sensitive table names

The very first time all four services were started, every GET request
against a real table failed with:

```
Table 'StudentDB.students' doesn't exist
```

The tables were created exactly as `Students`, `Course_Category`, etc.
(matching the names given in the task), and `@Table(name = "Students")`
in the entity matches that exactly. The problem: this MySQL server has
`lower_case_table_names = 0` (case-sensitive identifiers on Linux), but
Hibernate's *default* physical naming strategy lowercases table/column names
**even when you gave it an explicit `@Table`/`@Column` name** — so `Students`
was being turned into `students` before the SQL was ever sent, and MySQL
correctly reported that lowercase table as missing.

Fixed in every service's `application.properties`:

```properties
spring.jpa.hibernate.naming.physical-strategy=org.hibernate.boot.model.naming.PhysicalNamingStrategyStandardImpl
```

This tells Hibernate to use table/column names exactly as given, with no
transformation. This was only caught by actually starting the services and
calling the API — the code compiled fine and no unit test would have caught
it, because the mismatch only exists between the running application and the
live database's case-sensitivity setting.

## 6. A second bug: validation order vs. defaulting logic

`Enrollment.statusId` was initially `@NotNull`. But `EnrollmentService` is
*supposed* to default `statusId` to the `'Pending'` row when a caller omits
it — that's the whole point of letting a client `POST` an enrollment with
just `studentId` and `courseId`. Bean validation (`@Valid` on the controller
parameter) runs **before** the service method's defaulting logic ever
executes, so every enrollment creation failed with
`"statusId: must not be null"` before it had a chance to be defaulted.

Fixed by removing `@NotNull` from `statusId` — the column itself is still
`nullable = false` in the database, and `EnrollmentService.create()`
guarantees it's always set before `save()`, but bean validation must allow
the field to arrive blank from the client. **The general lesson: never mark
a field `@NotNull`/`@NotBlank` if a lower layer is responsible for filling
it in — bean validation always runs first.**

---

## 7. Error handling

Each service has its own `GlobalExceptionHandler` (`@RestControllerAdvice`)
returning a consistent JSON error body:

| Exception | HTTP status |
|---|---|
| `ResourceNotFoundException` | 404 |
| `PeerServiceException` (enrollment-service only — a peer call failed) | 502 |
| `MethodArgumentNotValidException` (bean validation) | 400 |
| `MethodArgumentTypeMismatchException` (e.g. non-numeric id in a `Long` param) | 400 |
| `DataIntegrityViolationException` (FK/unique constraint) | 409 |
| anything else | 500 |

The `MethodArgumentTypeMismatchException` handler was added after testing
confirmed that, without it, a malformed id fell through to the generic
handler and returned an unhelpful 500 — a type-conversion failure is a
client mistake, not a server fault, so it now correctly returns 400.

`PeerServiceException` is specific to `enrollment-service`: if
`student-service`, `course-service`, or `notification-service` is
unreachable or errors out, the synchronous call throws this exception rather
than letting a raw `RestClientException` leak out, and it's mapped to
**502 Bad Gateway** — the standard status for "I depend on another service
and it failed."

---

## 8. How SQL injection is prevented

Every data-access call in all four services goes through Spring Data JPA —
either a `JpaRepository` method (`findById`, `save`, `deleteById`, `findAll`)
or a derived query method like `findByStudentId(Long studentId)`. Spring Data
JPA compiles these into parameterised JPQL/SQL with bound placeholders at
startup; a value passed in from a controller is always sent to MySQL as a
separate, typed parameter — **never** concatenated into a query string.

This codebase has an additional structural advantage over the earlier
cricket_universe projects in this workspace: **every foreign-key-style
parameter here is a `Long`, not a free-text `String`.** There is no
`LIKE '%search%'` endpoint anywhere in this system. That means Spring MVC's
own request-parameter binding rejects a malicious string *before it ever
reaches a repository method* — this was verified directly against the
running services:

```bash
curl "http://localhost:8091/api/students/1' OR '1'='1"
# -> 400 Bad Request
#    "Invalid value for parameter 'id': expected Long"
```

Spring tried to convert `"1' OR '1'='1"` to a `Long`, failed, and the request
never got anywhere near a `Repository`, an `EntityManager`, or a SQL string —
the attack payload is neutralised by type checking at the web layer, one
step earlier than a parameterised query even gets the chance to matter.

After every test in this project — including the attempted injection above —
the row counts in all four databases were re-checked and were exactly what
the CRUD operations performed should have produced; nothing was altered
outside the expected inserts:

```sql
SELECT COUNT(*) FROM StudentDB.Students;      -- 5 (unchanged)
SELECT COUNT(*) FROM CourseDB.Courses;        -- 6 (unchanged)
SELECT COUNT(*) FROM EnrollmentDB.Enrollments; -- grew only by the enrollments this test created
SELECT COUNT(*) FROM NotificationDB.Notifications; -- grew only by the notifications this test created
```

**The rule that makes this hold everywhere in this codebase:** every
repository method is either a Spring Data JPA-generated query (always
parameterised) or a plain `save()`/`findById()` call — there is no hand-built
SQL string anywhere in any of the four services, and no endpoint accepts a
free-text value that gets used inside a `WHERE ... LIKE` clause.

---

## 9. How the build and system were verified

```bash
cd Documents/Java_Projects/Spring-boot-student-mgmt-sync-repository-pattern
mvn clean package        # builds all 4 modules — BUILD SUCCESS
```

Then, with all four jars running (`student-service` :8091, `course-service`
:8092, `notification-service` :8094, `enrollment-service` :8093):

- Full CRUD (`GET`/`POST`/`PUT`/`DELETE`) exercised on all 14 tables across
  the four services
- `student-service`'s `/exists` endpoint confirmed both true and false cases
- `course-service`'s `/exists` endpoint confirmed
- Enrollment creation confirmed to **reject** invalid `studentId`/`courseId`
  (synchronous validation working) and confirmed to **default** `statusId`
  to `Pending` when omitted
- Payment creation with `paymentStatus: "Success"` confirmed to:
  - flip the linked enrollment's status to `Active`
  - fetch the student's email synchronously from `student-service`
  - call `notification-service` synchronously, which wrote both a
    `Notifications` row and a matching `Email_Logs` row
- `Student_Login`'s `passwordHash` field confirmed absent from every JSON
  response (`@JsonIgnore`)
- The type-mismatch/SQL-injection-style test above
- Database row counts re-checked against MySQL directly after every test to
  confirm no unexpected mutation occurred

---

## 10. Running it yourself

```bash
cd Documents/Java_Projects/Spring-boot-student-mgmt-sync-repository-pattern

# 1. Load schema + sample data (run once)
mysql -u <user> -p < sql/01_student_db.sql
mysql -u <user> -p < sql/02_course_db.sql
mysql -u <user> -p < sql/03_enrollment_db.sql
mysql -u <user> -p < sql/04_notification_db.sql

# 2. Build everything
mvn clean package

# 3. Start each service (order matters only for the demo below —
#    each service is independently runnable and will simply fail its
#    peer calls until the others are up)
java -jar student-service/target/student-service.jar        # :8091
java -jar course-service/target/course-service.jar           # :8092
java -jar notification-service/target/notification-service.jar  # :8094
java -jar enrollment-service/target/enrollment-service.jar    # :8093
```

DB credentials and peer service URLs are all externalised via environment
variables (`DB_USERNAME`, `DB_PASSWORD`, `STUDENT_SERVICE_URL`,
`COURSE_SERVICE_URL`, `NOTIFICATION_SERVICE_URL`) with sane localhost
defaults baked into each `application.properties`.

---

## 11. Key takeaways for a beginner

1. **"Microservices" means independent deployables with independent
   databases** — not just "many Spring Boot projects in one folder." The
   absence of a foreign key between `Enrollments.student_id` and
   `StudentDB.Students` is the architecture working as intended, not a gap.
2. **Synchronous communication is a real design choice with real
   trade-offs** — `enrollment-service` cannot create an enrollment while
   `student-service` is down, because it blocks waiting for an answer. That
   is exactly what "synchronous-only" was asked for; an asynchronous design
   (message queue) would have let the enrollment be created "provisionally"
   and validated later, which is a different — not automatically better —
   trade-off.
3. **Bean validation runs before your service logic, always.** Any field a
   lower layer intends to default or compute must not be marked
   `@NotNull`/`@NotBlank`, or the request never reaches the code that would
   have filled it in. This bit both the `Country.id` field in an earlier
   project and `Enrollment.statusId` here — the same category of mistake in
   two different codebases.
4. **A framework default (Hibernate's naming strategy) can silently disagree
   with your database's configuration (case sensitivity).** This is invisible
   at compile time and only shows up when you actually run the app against
   the real database — another reason "it compiles" is never the same claim
   as "it works."
5. **Strongly-typed parameters are a free SQL-injection defense.** Because
   every cross-reference in this system is a `Long`, not a search string,
   Spring's own type conversion rejects malformed input before it ever
   reaches a database call.
