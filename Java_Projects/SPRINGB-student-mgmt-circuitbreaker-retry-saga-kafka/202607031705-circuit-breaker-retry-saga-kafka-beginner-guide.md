# Student Management Microservices — Circuit Breaker, Retry & Saga (Beginner's Guide)

This document explains **everything** about this project: what it is, how to start it, how every request actually flows through the system, and — in detail, with real code from this codebase — how the three resilience/consistency patterns it demonstrates (**Circuit Breaker**, **Retry**, **Saga**) actually work. It assumes no prior microservices experience.

If you only read one section, read **§7–§9** (the three pattern deep-dives) and **§11** (the full Saga trace) — that's the actual point of this project.

---

## Table of Contents

1. [What This Project Is](#1-what-this-project-is)
2. [Architecture at a Glance](#2-architecture-at-a-glance)
3. [Vocabulary Primer](#3-vocabulary-primer)
4. [How to Start Everything](#4-how-to-start-everything)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [Endpoint Reference](#6-endpoint-reference)
7. [Pattern Deep Dive — Retry](#7-pattern-deep-dive--retry)
8. [Pattern Deep Dive — Circuit Breaker](#8-pattern-deep-dive--circuit-breaker)
9. [Pattern Deep Dive — Saga](#9-pattern-deep-dive--saga)
10. [Full Request Trace — A Simple GET](#10-full-request-trace--a-simple-get)
11. [Full Request Trace — POST /api/enrollments (The Saga in Motion)](#11-full-request-trace--post-apienrollments-the-saga-in-motion)
12. [Observability — Logs, Correlation IDs, Actuator](#12-observability--logs-correlation-ids-actuator)
13. [Testing](#13-testing)
14. [One-Page Cheat Sheet](#14-one-page-cheat-sheet)

---

## 1. What This Project Is

A **Student Management System** built as five independent Spring Boot microservices instead of one monolith, so it can demonstrate three patterns that only make sense once there's more than one service talking to more than one other service:

| Pattern | Question it answers | Where it lives in this project |
|---|---|---|
| **Retry** | "This call just failed — was that a one-off blip worth trying again, or a real problem?" | Every Kafka publish (student-service, course-service, enrollment-service), and notification-service's simulated email/SMS send |
| **Circuit Breaker** | "This dependency has failed repeatedly — should I keep hammering it, or back off and fail fast?" | enrollment-service's calls to student-service/course-service; notification-service's simulated gateway |
| **Saga** | "This 'transaction' spans three databases I can't wrap in one commit — how do I keep them consistent?" | The enrollment approval workflow: student-service + course-service + enrollment-service coordinating over Kafka |

Everything else in the project (MySQL persistence, JWT authentication, role-based authorization, CORS, structured logging, Actuator monitoring, unit tests) exists to make those three patterns sit inside something that looks and behaves like a real system, not a toy.

---

## 2. Architecture at a Glance

```
                                   ┌─────────────────────┐
                        CORS,      │     api-gateway      │   port 8110
                     JWT auth,     │  (Spring Cloud       │   Netty (reactive)
                  authorization    │   Gateway / WebFlux) │
                                   └──────────┬───────────┘
                     ┌────────────────────────┼────────────────────────┐
                     ▼                        ▼                        ▼
            ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────────┐
            │ student-service │      │  course-service  │      │  enrollment-service  │◀──┐
            │   port 8111     │      │   port 8112      │      │     port 8113        │   │
            │   StudentDB     │      │    CourseDB      │      │    EnrollmentDB      │   │
            └────────┬────────┘      └────────┬─────────┘      └──────────┬───────────┘   │
                     │                         │                          │ HTTP (Circuit  │
                     │                         │                          │ Breaker) ───────┘
                     └───────────┐  ┌──────────┘                          │
                                 ▼  ▼                                     ▼
                          ┌─────────────┐                        ┌──────────────────────┐
                          │    Kafka    │◀───────────────────────│ notification-service │
                          │ (port 9097) │───────────────────────▶│      port 8114        │
                          └─────────────┘                        │   NotificationDB      │
                                                                  └──────────────────────┘
```

- **Database per service** — each backend service owns its own MySQL schema (`StudentDB`, `CourseDB`, `EnrollmentDB`, `NotificationDB`) and nobody else is allowed to query it directly.
- **api-gateway is the only thing browsers/clients talk to** — port 8110 is the single public entry point; ports 8111–8114 are only reachable on `localhost` for local development.
- **Kafka is the backbone of the Saga** — student-service, course-service, enrollment-service and notification-service all produce and/or consume Kafka messages; none of them call each other over HTTP for the enrollment workflow.
- **The one exception** is enrollment-service's `GET /api/enrollments/{id}/details`, which *does* call student-service and course-service over plain HTTP — that's deliberate, so this project has a concrete place to demonstrate Circuit Breaker (§8).

---

## 3. Vocabulary Primer

Read this once; everything below assumes you know these terms.

| Term | Plain-English meaning |
|---|---|
| **Microservice** | One independently-deployable program (its own JVM process, own database) that does one job and talks to other services over the network instead of via direct in-process method calls. |
| **Kafka / topic / producer / consumer / consumer group** | Kafka is a message broker — a separate program services send messages to and read messages from instead of calling each other directly. A **topic** (e.g. `enrollment.requested`) is a named channel. A **producer** sends messages to a topic. A **consumer** reads them. A **consumer group** is a label — two consumers in *different* groups each get their own independent copy of every message, which is exactly how both student-service and course-service each react to the same `enrollment.requested` message. |
| **Synchronous vs. asynchronous call** | Synchronous (a plain HTTP call): the caller sends a request and *waits* for the response before doing anything else. Asynchronous (publishing a Kafka message): the caller fires the message and moves on immediately — it finds out what happened, if it ever needs to, some other way, later. |
| **Retry** | Automatically re-attempting an operation that just failed, instead of giving up on the first failure — useful when the failure might be *transient* (a brief network blip) rather than permanent. |
| **Circuit Breaker** | A safety switch that "trips" (opens) after too many recent failures calling some dependency, and then rejects further calls to it *immediately* — without even trying — for a cool-down period, instead of letting every new request hang or fail slowly against something that's clearly down. |
| **Saga** | A way to keep data consistent across multiple databases/services when you *can't* use one ACID database transaction spanning all of them — by breaking the work into a sequence of local transactions, each publishing an event that triggers the next step, with explicit compensating logic if something downstream fails. |
| **Choreography vs. orchestration (saga styles)** | *Choreography* (used here): every service reacts to events and publishes its own events in response — nobody is "in charge." *Orchestration*: one central coordinator explicitly tells every other service what to do, step by step, and tracks a saga state machine itself. |
| **JWT (JSON Web Token)** | A signed, tamper-proof piece of text a server hands a client after login, proving "this really is who they say they are" on every later request, without the server needing to remember a session. |
| **Correlation ID** | A random ID generated once per incoming request and threaded through every log line (and forwarded to every downstream service) touched while handling it — lets you `grep` one ID across every service's log file and see that one request's entire journey. |
| **Actuator** | Spring Boot's built-in set of `/actuator/...` HTTP endpoints for inspecting a running application's health, metrics, and (in this project) live Circuit Breaker/Retry state — without needing a separate monitoring tool. |

---

## 4. How to Start Everything

### Step 1 — Start Kafka

```bash
cd SPRINGB-student-mgmt-circuitbreaker-retry-saga-kafka
docker compose up -d
```

This starts a single-broker Kafka cluster listening on `localhost:9097` (deliberately not the Kafka default `9092` — see the comment in `docker-compose.yml` explaining the port choices made across this machine's sibling projects).

### Step 2 — Create the databases

Run each script against your local MySQL server (default credentials `abhig` / `Pass@123`, overridable via `DB_USERNAME`/`DB_PASSWORD` env vars):

```bash
mysql -u abhig -p < sql/01_student_db.sql
mysql -u abhig -p < sql/02_course_db.sql
mysql -u abhig -p < sql/03_enrollment_db.sql
mysql -u abhig -p < sql/04_notification_db.sql
```

Each script `DROP DATABASE IF EXISTS ... ; CREATE DATABASE ...` — safe to re-run any time you want a clean slate. Sample data is seeded automatically, including one `ADMIN` login (`admin` / `admin123`) alongside five `STUDENT` logins (`aarav.sharma` / `password123`, etc.).

### Step 3 — Build everything once

```bash
mvn -q clean package -DskipTests
```

This compiles all five modules and produces one runnable jar per module under `<module>/target/`.

### Step 4 — Start the four backend services, then the gateway

Order matters a little: the backend services need to be up before the gateway can proxy anything to them (though nothing crashes if you start the gateway first — requests will just fail until the target is up). Open five terminals:

```bash
cd student-service      && mvn spring-boot:run     # port 8111
cd course-service       && mvn spring-boot:run     # port 8112
cd enrollment-service   && mvn spring-boot:run     # port 8113
cd notification-service && mvn spring-boot:run     # port 8114
cd api-gateway          && mvn spring-boot:run     # port 8110 — start this LAST
```

### Step 5 — Confirm it's alive

```bash
curl http://localhost:8110/actuator/health
```

Then log in and use the token for everything else (see §5 for the full flow):

```bash
curl -X POST http://localhost:8110/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"aarav.sharma","password":"password123"}'
# → {"token":"eyJhbGciOiJIUzI1NiJ9..."}

curl http://localhost:8110/api/students/1 \
  -H "Authorization: Bearer <paste-token-here>"
```

> **If step 5 fails:** the most common cause is MySQL not running, or one of the four backend services not being up yet — check each service's own console output; Spring Boot fails loudly and early if it can't reach its database.

---

## 5. Authentication & Authorization

These are two different questions, answered by two different classes, deliberately kept separate:

- **Authentication** — "is there a valid, unexpired token, and who does it belong to?" → `JwtUtil` + `GatewayAuthFilter`.
- **Authorization** — "given a proven identity and role, is this role allowed to do THIS specific thing?" → `AuthorizationPolicy`.

### 5.1 The login flow

```
1. Client → POST /auth/login {username, password} → api-gateway
2. api-gateway's AuthController calls StudentLoginClient.verify(...)
3. StudentLoginClient → POST http://student-service:8111/api/student-logins/verify
4. student-service's StudentLoginService compares the password (plain-text
   comparison for teaching clarity — see the note in StudentLogin.java) and
   returns {valid, username, role}
5. If valid: api-gateway's JwtUtil.generateToken(username, role) mints a JWT
   containing both the username (subject) and role (custom claim), signed
   with a secret that exists ONLY in api-gateway
6. api-gateway returns {"token": "..."} to the client
```

### 5.2 Every subsequent request

```
Client → GET/POST/... with header "Authorization: Bearer <token>" → api-gateway
                                    │
                                    ▼
                         GatewayAuthFilter (order = -1, runs first)
                                    │
                    ┌───────────────┴────────────────┐
                    ▼                                 ▼
         1. AUTHENTICATION check            2. AUTHORIZATION check
         JwtUtil.isValid(token)?            AuthorizationPolicy.isAllowed(
         No  → 401 Unauthorized                 method, path, role)?
         Yes → extract username + role       No  → 403 Forbidden
                                              Yes → continue
                                    │
                                    ▼
              Request forwarded to the backend service with two new
              headers added: X-Authenticated-User, X-Authenticated-Role
                                    │
                                    ▼
         Backend service's AuthenticatedUserFilter reads those headers
         (never sees the JWT or the signing secret at all) and makes them
         available to WhoAmIController / application logic via request attributes
```

### 5.3 The authorization rules (`AuthorizationPolicy`)

| Method | Path prefix | Required role | Reasoning |
|---|---|---|---|
| POST/PUT/DELETE | `/api/students` | `ADMIN` | Only staff can create/edit/remove student master data |
| POST/PUT/DELETE | `/api/courses` | `ADMIN` | Only staff can create/edit/remove course master data |
| POST | `/api/enrollments` | *(any authenticated role)* | Students enroll themselves |
| PUT/DELETE | `/api/enrollments` | `ADMIN` | Only staff can manually override/cancel an enrollment |
| POST | `/api/notifications/admin` | `ADMIN` | Only staff can flip the simulated-failure toggle used for the Circuit Breaker demo (§8.3) |
| *(everything else)* | — | *(any authenticated role)* | Reading data is fine for anyone logged in |

This logic lives in one small, dependency-free class (`AuthorizationPolicy`) precisely so it can be unit tested with plain strings and booleans — see `AuthorizationPolicyTest`, no mocked HTTP request needed.

### 5.4 CORS

Configured **once**, in `api-gateway`'s `CorsConfig` — never in the backend services, since browsers never talk to them directly. Allowed origins default to `http://localhost:3000,http://localhost:4200` (typical React/Angular dev server ports) and are overridable via the `CORS_ALLOWED_ORIGINS` environment variable for a real deployment.

---

## 6. Endpoint Reference

All paths below are relative to `http://localhost:8110` (the gateway) — the gateway path-routes each prefix to the matching backend service.

### student-service (`/api/students`, `/api/student-logins`)

| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/api/students` | any | List all students |
| GET | `/api/students/{id}` | any | Get one student |
| GET | `/api/students/{id}/exists` | any | Existence check (debugging only — the Saga doesn't use this) |
| GET | `/api/students/me` | any | Echo back the caller's identity/role (proves auth is working) |
| POST | `/api/students` | `ADMIN` | Create a student |
| PUT | `/api/students/{id}` | `ADMIN` | Update a student |
| DELETE | `/api/students/{id}` | `ADMIN` | Delete a student |
| POST | `/api/student-logins/verify` | *(internal — gateway only)* | Credential check during login |

### course-service (`/api/courses`)

| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/api/courses` | any | List all courses |
| GET | `/api/courses/{id}` | any | Get one course |
| GET | `/api/courses/{id}/exists` | any | Existence check (debugging only) |
| GET | `/api/courses/me` | any | Echo caller identity |
| POST | `/api/courses` | `ADMIN` | Create a course |
| PUT | `/api/courses/{id}` | `ADMIN` | Update a course |
| DELETE | `/api/courses/{id}` | `ADMIN` | Delete a course |

### enrollment-service (`/api/enrollments`, `/api/enrollment-statuses`)

| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/api/enrollments` | any | List all enrollments |
| GET | `/api/enrollments/{id}` | any | Get one enrollment (see its current status) |
| GET | `/api/enrollments/{id}/details` | any | **Circuit Breaker demo** — aggregates live student + course data |
| GET | `/api/enrollment-statuses` | any | List the possible status values |
| POST | `/api/enrollments` | any | **Saga entry point** — always returns `202 Accepted` |
| PUT | `/api/enrollments/{id}` | `ADMIN` | Manually override status |
| DELETE | `/api/enrollments/{id}` | `ADMIN` | Delete an enrollment |

### notification-service (`/api/notifications`)

| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/api/notifications` | any | List all notifications (optionally `?enrollmentId=`) |
| GET | `/api/notifications/{id}` | any | Get one notification |
| POST | `/api/notifications/admin/toggle-failure` | `ADMIN` | **Retry + Circuit Breaker demo** — force the simulated gateway to fail |

---

## 7. Pattern Deep Dive — Retry

**Where:** `ValidationResultProducer` (student-service and course-service), `EnrollmentRequestedProducer` / `EnrollmentOutcomeProducer` (enrollment-service).

**The problem it solves:** publishing a Kafka message is a network call to a separate broker process. A momentary hiccup — the broker is mid-leader-election after a restart, a brief network blip — shouldn't be treated the same as "Kafka is permanently gone." Retry gives transient failures a few more chances before giving up.

**How it's wired (annotation style):**

```java
@Retry(name = "kafkaPublish", fallbackMethod = "publishFallback")
public void publish(ValidationResultEvent event) {
    try {
        String payload = objectMapper.writeValueAsString(event);
        kafkaTemplate.send(topic, String.valueOf(event.getEnrollmentId()), payload)
                .get(3, TimeUnit.SECONDS);   // <- turns the async send into a synchronous
                                              //    call so a failure actually throws HERE
    } catch (Exception e) {
        throw new IllegalStateException("Failed to publish validation result to Kafka", e);
    }
}

private void publishFallback(ValidationResultEvent event, Throwable t) {
    log.error("Giving up publishing validation result for enrollmentId={} after all retry attempts: {}",
            event.getEnrollmentId(), t.getMessage());
}
```

Configuration (`application.properties`):

```properties
resilience4j.retry.instances.kafkaPublish.max-attempts=3
resilience4j.retry.instances.kafkaPublish.wait-duration=500ms
resilience4j.retry.instances.kafkaPublish.enable-exponential-backoff=true
resilience4j.retry.instances.kafkaPublish.exponential-backoff-multiplier=2
resilience4j.retry.instances.kafkaPublish.retry-exceptions=java.lang.IllegalStateException
```

**What actually happens on failure:**

| Attempt | When | Outcome |
|---|---|---|
| 1 (original call) | t = 0ms | Fails (transient broker issue) |
| 2 (retry #1) | t ≈ 500ms | Fails again |
| 3 (retry #2) | t ≈ 1500ms (500ms × 2 backoff) | Succeeds → method returns normally, caller never knows there was a problem |

If attempt 3 *also* fails, `publishFallback()` runs instead of the exception propagating — the failure is logged loudly rather than silently swallowed (a real system would additionally write to a dead-letter topic or an outbox table here for later replay).

> **⚠️ A critical, easy-to-miss gotcha:** `@Retry` (like `@Transactional`) works via a Spring AOP proxy. It **cannot** be applied to a `private` method, and it is **silently skipped** if you call the annotated method from *another method in the same class* ("self-invocation") — the call bypasses the proxy entirely. `EnrollmentOutcomeProducer` in this project deliberately has two small, independently-`@Retry`-annotated public methods (`publishConfirmed`/`publishRejected`) instead of one shared private helper, specifically to avoid this trap.

**Proven independently of Spring/Kafka:** `student-service`'s `RetryPatternTest` builds the exact same Resilience4j `Retry` engine by hand (no Spring context, no live broker) and proves: a call that fails twice then succeeds returns successfully after 3 attempts; a call that always fails is attempted exactly `max-attempts` times before giving up; an exception *not* in `retry-exceptions` is never retried at all.

---

## 8. Pattern Deep Dive — Circuit Breaker

**Where:** `StudentServiceClient` / `CourseServiceClient` (enrollment-service's synchronous calls for `/details`), and `NotificationDispatchService`'s simulated external gateway call.

**The problem it solves:** Retry helps with *brief* blips. But if student-service is genuinely down for five minutes, retrying every single incoming request against it (each one waiting out a timeout before failing) means every one of *this* service's own request-handling threads gets tied up waiting on a dependency that isn't coming back soon — potentially taking this service down too. A circuit breaker notices the pattern and stops trying altogether for a while.

### 8.1 The three states

```
                    enough recent calls failed
        ┌──────────────────────────────────────────┐
        │                                            ▼
   ┌─────────┐                                  ┌─────────┐
   │ CLOSED  │                                  │  OPEN   │
   │ (normal)│                                  │(rejects │
   │         │◀─────────────────────────────────│ instantly)
   └─────────┘   enough trial calls succeeded    └────┬────┘
        ▲        during HALF_OPEN                     │
        │                                    wait-duration-in-open-state
        │                                    has elapsed
        │              ┌─────────────┐             │
        └──────────────│  HALF_OPEN  │◀────────────┘
       any trial call  │ (a few calls│
       fails → back    │ let through)│
       to OPEN          └─────────────┘
```

- **CLOSED** — every call actually goes through to the real dependency; Resilience4j just counts successes/failures in a sliding window.
- **OPEN** — the moment the failure rate crosses `failure-rate-threshold` (with at least `minimum-number-of-calls` calls observed), the breaker trips. Every call for the next `wait-duration-in-open-state` is rejected **immediately** with a `CallNotPermittedException` — the real dependency isn't even contacted.
- **HALF_OPEN** — after the wait duration, a small number of trial calls (`permitted-number-of-calls-in-half-open-state`) are let through to test the water. All succeed → back to CLOSED. Any fail → straight back to OPEN.

### 8.2 How it's wired — enrollment-service's cross-service lookup

```java
@CircuitBreaker(name = "studentServiceClient", fallbackMethod = "getStudentFallback")
public StudentSummary getStudent(Long studentId) {
    return restTemplate.getForObject(studentServiceUrl + "/api/students/{id}", StudentSummary.class, studentId);
}

private StudentSummary getStudentFallback(Long studentId, Throwable t) {
    log.warn("Circuit breaker fallback: student-service unavailable for studentId={} ({})", studentId, t.toString());
    return StudentSummary.fallback(studentId);   // {"firstName":"Unavailable", ...}
}
```

`CourseServiceClient` mirrors this exactly with its **own, independent** `courseServiceClient` breaker — course-service being down must not trip the breaker guarding student-service, because in reality the two dependencies fail independently.

```properties
resilience4j.circuitbreaker.instances.studentServiceClient.sliding-window-size=5
resilience4j.circuitbreaker.instances.studentServiceClient.minimum-number-of-calls=5
resilience4j.circuitbreaker.instances.studentServiceClient.failure-rate-threshold=50
resilience4j.circuitbreaker.instances.studentServiceClient.wait-duration-in-open-state=10s
resilience4j.circuitbreaker.instances.studentServiceClient.permitted-number-of-calls-in-half-open-state=2
```

Try it yourself: stop `student-service`, then hit `GET /api/enrollments/1/details` five times in a row. The first few calls will hang for ~2 seconds each (the `RestTemplateConfig` connect/read timeout) before falling back; after the 5-call window sees enough failures, later calls fail **instantly** — that's the breaker having tripped OPEN. Check `GET http://localhost:8113/actuator/health` and look for the `circuitBreakers` component to see the state directly.

### 8.3 How it's wired — notification-service's simulated gateway (Circuit Breaker + Retry combined)

This is the one place in the project where both patterns protect the *same* call, and it's built **programmatically** (not via annotations) specifically so the number of attempts made is observable:

```java
Supplier<Void> protectedAction = Decorators.ofSupplier(action)
        .withRetry(retry)               // <- applied first → becomes the INNERMOST layer
        .withCircuitBreaker(circuitBreaker)  // <- applied second → becomes the OUTERMOST layer
        .decorate();
```

This composition order is Resilience4j's own documented default for the equivalent annotations, and it matters a lot: **all of a Retry's attempts count as a single call towards the Circuit Breaker's failure count.** Three failed retry attempts for one `dispatch()` call = one failed data point for the breaker's sliding window, not three.

Flip the simulated gateway to failing and watch both patterns react in sequence:

```bash
curl -X POST "http://localhost:8110/api/notifications/admin/toggle-failure?failing=true" \
  -H "Authorization: Bearer <admin-token>"

# now create an enrollment (any student/course id) and wait a couple of seconds
curl -X POST http://localhost:8110/api/enrollments \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"studentId":1,"courseId":1}'

curl http://localhost:8110/api/notifications?enrollmentId=<the-new-id>
```

You'll see a `Notification` row with `status=FAILED` and `attemptCount=3` (Retry tried 3 times, gateway failed every time). Do this a few more times and the circuit trips — the *next* attempt shows `attemptCount=0` (the call was rejected before Retry — and therefore the simulated gateway — ever ran). Flip failure back off and, after `wait-duration-in-open-state` (8s), the breaker's HALF_OPEN trial calls succeed and it closes again.

**Proven independently of Spring:** `enrollment-service`'s `CircuitBreakerPatternTest` builds the same engine by hand and proves the OPEN state genuinely skips the wrapped call (`CallNotPermittedException`, not the real exception). `notification-service`'s `NotificationDispatchServiceTest` exercises the *actual* `NotificationDispatchService` class end-to-end (mocking only the database) and proves all three scenarios above with real assertions on `attemptCount`.

---

## 9. Pattern Deep Dive — Saga

**Where:** the entire enrollment-approval workflow, spanning `enrollment-service`, `student-service`, and `course-service`.

**The problem it solves:** creating an enrollment needs to check that both the student and the course actually exist — but that data lives in two *other* services' databases. A single ACID transaction can't span three separate MySQL schemas owned by three separate services. The Saga pattern accepts that trade-off explicitly: instead of one atomic all-or-nothing transaction, it's a sequence of local transactions, each triggered by an event from the previous step.

This project uses the **choreography** style — there is no central coordinator giving orders; every service just reacts to the events it's subscribed to and publishes its own event in response.

### 9.1 The event flow

```
                     enrollment.requested (key = enrollmentId)
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
     student-service                   course-service
     (consumer group:                  (consumer group:
      student-service-group)            course-service-group)
     "does student exist?"             "does course exist?"
              │                               │
              ▼                               ▼
   student.validation.result        course.validation.result
              │                               │
              └───────────────┬───────────────┘
                              ▼
                    enrollment-service
           (EnrollmentSagaService — waits for BOTH,
            resolves CONFIRMED or REJECTED)
                              │
                 ┌────────────┴────────────┐
                 ▼                         ▼
        enrollment.confirmed      enrollment.rejected
                 └────────────┬────────────┘
                              ▼
                    notification-service
              (dispatches EMAIL [+ SMS if CONFIRMED])
```

Both `student-service` and `course-service` receive an **independent copy** of the same `enrollment.requested` message because they're registered under two *different* Kafka consumer group IDs — that's the mechanism that lets both branches of the fan-out happen without either service knowing the other exists.

### 9.2 The resolution logic (the actual "distributed transaction")

`EnrollmentSagaService` is the one piece of code that needs to know about *both* replies:

```java
private void resolveIfComplete(EnrollmentValidation validation) {
    if (!validation.isResolved()) {          // isResolved() == both columns non-null
        log.info("Enrollment {} still waiting on the other validation reply...", ...);
        return;                               // <- whichever reply arrives FIRST just returns here
    }
    // whichever reply arrives SECOND reaches this point and actually resolves the saga
    boolean confirmed = validation.isFullyValid();   // both true?
    ...
}
```

Because `student.validation.result` and `course.validation.result` are produced by two completely independent processes, **there is no guarantee which one arrives first** — the code above is written so either order produces the same correct result: whichever arrives first just records its own column and exits; whichever arrives second sees both columns filled in and does the actual resolving.

### 9.3 What "consistency" means here

There's no rollback across databases — instead:

- The `Enrollments` row is created immediately in `PENDING_VALIDATION` status (a real, queryable, if-incomplete state — never invisible).
- `Enrollment_Validation` tracks partial progress explicitly (`student_valid`/`course_valid`, both nullable) instead of pretending the answer is already known.
- The **compensating action** for "student doesn't exist" or "course doesn't exist" isn't undoing a write — it's simply transitioning the same row to `REJECTED` with a reason, which is itself an event other services (notification-service) react to.

This is different from a **orchestration**-style saga (not used here), where one service would explicitly call the others in sequence and track a saga state machine itself, able to issue explicit "undo" commands if a later step fails.

---

## 10. Full Request Trace — A Simple GET

`GET http://localhost:8110/api/students/1` with header `Authorization: Bearer <valid-jwt>`:

```
1. Client sends the request; TCP connects to api-gateway's Netty server on port 8110
2. Spring Cloud Gateway's routing engine matches "/api/students/1" against
   Path=/api/students/**,/api/student-logins/** → routes to student-service (port 8111)
3. GatewayAuthFilter (runs before the route forwards anything):
     a. validates the JWT (JwtUtil.isValid)
     b. extracts username + role from the token
     c. checks AuthorizationPolicy.isAllowed("GET", "/api/students/1", role) → true for any role
     d. adds X-Authenticated-User / X-Authenticated-Role headers, forwards the request
4. A brand new TCP connection carries the request to student-service:8111
5. student-service's CorrelationIdFilter + AuthenticatedUserFilter run (log the caller identity)
6. DispatcherServlet routes to StudentController.findById(1L)
7. StudentController → StudentService.findById(1L) → StudentRepository.findById(1L)
8. Spring Data JPA's generated proxy issues: SELECT * FROM Students WHERE student_id = 1
9. Hibernate builds a Student object from the row; wrapped in Optional, returned up
10. Jackson serializes it to JSON; response status 200 OK
11. Response travels back: student-service → gateway → client, unchanged
```

The response body:

```json
{"studentId":1,"firstName":"Aarav","lastName":"Sharma","email":"aarav.sharma@example.com","phone":"9876500001","enrollmentDate":"2024-06-01"}
```

---

## 11. Full Request Trace — POST /api/enrollments (The Saga in Motion)

`POST http://localhost:8110/api/enrollments` with body `{"studentId":1,"courseId":3}`.

### 11.1 The synchronous part (client is still waiting)

```
1-5.  Same gateway hops as §10 (auth, authorization, routing) — this time to enrollment-service:8113
6.  EnrollmentController.create(enrollment) → EnrollmentService.create(enrollment)
7.  Inside one @Transactional block:
      a. looks up "PENDING_VALIDATION" status id
      b. INSERT INTO Enrollments (...) — MySQL returns the new enrollment_id, say 37
      c. INSERT INTO Enrollment_Validation (enrollment_id=37, both columns NULL)
8.  EnrollmentRequestedProducer.publish(...) — RETRY-protected (§7) —
      publishes {enrollmentId:37, studentId:1, courseId:3} to topic "enrollment.requested"
9.  Transaction commits
10. EnrollmentController returns; @ResponseStatus(ACCEPTED) → HTTP 202, NOT 200/201
11. Response travels back to the client: {"enrollmentId":37, "statusId":<PENDING_VALIDATION-id>, ...}
```

> **Why 202, not 201?** `201 Created` says "this is fully done, here's the final result." `202 Accepted` says "I've started this, but I can't tell you the outcome yet" — which is the honest answer, since CONFIRMED/REJECTED isn't decided until the asynchronous steps below finish.

### 11.2 The asynchronous part (client has already moved on)

```
12. student-service's Kafka consumer (idle until now) wakes up on "enrollment.requested":
      EnrollmentRequestedListener.onEnrollmentRequested(...)
        → studentRepository.existsById(1) → true
        → ValidationResultProducer.publish(...) [RETRY-protected] → topic "student.validation.result"

13. SIMULTANEOUSLY, course-service's Kafka consumer wakes up on the SAME message
    (different consumer group ⇒ its own independent copy):
      EnrollmentRequestedListener.onEnrollmentRequested(...)
        → courseRepository.existsById(3) → true
        → ValidationResultProducer.publish(...) [RETRY-protected] → topic "course.validation.result"

14. Back in enrollment-service, two listeners wake up independently, order not guaranteed:
      StudentValidationResultListener → EnrollmentSagaService.applyStudentValidationResult(37, true, ...)
      CourseValidationResultListener  → EnrollmentSagaService.applyCourseValidationResult(37, true, ...)
    Whichever runs SECOND sees both columns filled in and resolves the saga (§9.2):
      → UPDATE Enrollments SET status_id = <CONFIRMED-id> WHERE enrollment_id = 37
      → EnrollmentOutcomeProducer.publishConfirmed(...) [RETRY-protected] → topic "enrollment.confirmed"

15. notification-service's Kafka consumer wakes up on "enrollment.confirmed":
      EnrollmentOutcomeListener → EnrollmentOutcomeService.handle(event)
        → NotificationDispatchService.dispatch(37, 1, EMAIL, "...CONFIRMED...")
        → NotificationDispatchService.dispatch(37, 1, SMS,   "...CONFIRMED...")
    Each dispatch is RETRY + CIRCUIT-BREAKER protected (§8.3) against the simulated gateway.
```

### 11.3 Finding out what happened

The client that originally got `202 Accepted` has no way to be pushed the outcome — it has to ask again:

```bash
curl http://localhost:8110/api/enrollments/37 -H "Authorization: Bearer <token>"
# → statusId now points at CONFIRMED, proving steps 12-15 above actually happened
# entirely in the background, across three other JVM processes, while the
# original POST had already returned many milliseconds earlier.

curl http://localhost:8110/api/notifications?enrollmentId=37 -H "Authorization: Bearer <token>"
# → two rows: one EMAIL, one SMS, both status=SENT
```

---

## 12. Observability — Logs, Correlation IDs, Actuator

### 12.1 Correlation IDs

Every request gets an `X-Correlation-Id` header — minted by `api-gateway`'s `CorrelationIdWebFilter` if the client didn't send one, then forwarded to whichever backend service the request is routed to. Each backend service's own `CorrelationIdFilter` puts it in that request's SLF4J MDC, so every log line (`logback-spring.xml`'s `%X{correlationId}` pattern) from every service touched by one client request shares the same ID:

```
grep "4ae7249a-c0eb-4f0d-b6c1-d49314075fc8" api-gateway/logs/*.log student-service/logs/*.log enrollment-service/logs/*.log
```

reconstructs that one request's entire journey without needing a dedicated distributed-tracing tool.

> **Caveat:** the gateway is reactive (WebFlux/Netty), where MDC's normal thread-local behavior doesn't map cleanly onto Reactor's execution model — `CorrelationIdWebFilter`'s approach (writing to the Reactor `Context` and copying into MDC per signal) is a reasonable approximation for this project's teaching purposes, not a fully rigorous solution; the backend services (plain Spring MVC / servlet threads) don't have this problem at all.

### 12.2 Actuator endpoints worth knowing

| Endpoint | What it shows |
|---|---|
| `GET /actuator/health` | Overall health, including a `circuitBreakers` component per instance and its current state |
| `GET /actuator/circuitbreakers` | Every configured circuit breaker instance and its config |
| `GET /actuator/circuitbreakerevents` | A live event log of every state transition (CLOSED→OPEN, etc.) and every call outcome |
| `GET /actuator/retries` | Every configured retry instance |
| `GET /actuator/retryevents` | A live event log of every retry attempt made |
| `GET /actuator/metrics/resilience4j.circuitbreaker.calls` | Micrometer metric: call counts by outcome (successful, failed, not_permitted) |
| `GET /actuator/prometheus` | All metrics in Prometheus scrape format |

### 12.3 Log files

Every service writes to both the console and a rolling file under `<service>/logs/<service-name>.log` (10MB per file, 7 days retained, gzip-compressed on rotation — see each module's `logback-spring.xml`).

---

## 13. Testing

`mvn test` from the project root runs every module's tests with **no live MySQL, no live Kafka, no live anything** required — every test is either:

- A plain **Mockito unit test** of a service class (e.g. `StudentServiceTest`, `EnrollmentSagaServiceTest`) — the repository/producer dependencies are mocked, so only the business logic itself is exercised.
- A **`@WebMvcTest` slice test** of a controller (e.g. `CourseControllerTest`) — loads only the web layer + validation + the `@RestControllerAdvice` exception handler, with the service layer mocked; no database or message broker autoconfiguration is triggered.
- A **standalone Resilience4j test** (`RetryPatternTest`, `CircuitBreakerPatternTest`, `NotificationDispatchServiceTest`) that builds the real Resilience4j engine in-process and proves the pattern's actual behavior — retry counts, backoff, circuit state transitions — independent of Spring entirely.

```bash
mvn -q clean test          # run everything
mvn -q clean package       # run everything + produce the 5 runnable jars
```

45 tests, 0 failures, across all five modules as of this guide's writing.

---

## 14. One-Page Cheat Sheet

**Ports:** gateway 8110 · student 8111 · course 8112 · enrollment 8113 · notification 8114 · Kafka 9097 · MySQL 3306

**Start order:** Kafka → MySQL scripts → 4 backend services → gateway last

**Login:**
```bash
curl -X POST http://localhost:8110/auth/login -H "Content-Type: application/json" \
  -d '{"username":"aarav.sharma","password":"password123"}'
```

**Create an enrollment (triggers the Saga):**
```bash
curl -X POST http://localhost:8110/api/enrollments -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"studentId":1,"courseId":3}'
```

**Watch the Circuit Breaker trip (as ADMIN):**
```bash
curl -X POST "http://localhost:8110/api/notifications/admin/toggle-failure?failing=true" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Where each pattern lives:**

| Pattern | Class(es) |
|---|---|
| Retry | `ValidationResultProducer` (×2), `EnrollmentRequestedProducer`, `EnrollmentOutcomeProducer` |
| Circuit Breaker | `StudentServiceClient`, `CourseServiceClient` |
| Retry + Circuit Breaker combined | `NotificationDispatchService` |
| Saga | `EnrollmentSagaService` (+ the four Kafka listener classes it's fed by) |
| Authentication | `JwtUtil`, `GatewayAuthFilter` |
| Authorization | `AuthorizationPolicy` |
