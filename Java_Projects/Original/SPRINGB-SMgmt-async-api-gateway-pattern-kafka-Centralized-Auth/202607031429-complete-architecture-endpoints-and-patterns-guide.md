# SPRINGB-SMgmt-async-api-gateway-pattern-kafka-Centralized-Auth
## Complete Architecture, File-by-File, Endpoint-by-Endpoint, and Design-Pattern Guide

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Infrastructure & Build Setup](#3-infrastructure--build-setup)
4. [Database-per-Service Layout](#4-database-per-service-layout)
5. [Design Patterns Used in This Project — Concept, Real-World Analogy, Generic Example, and This Project's Implementation](#5-design-patterns-used-in-this-project)
   - 5.1 [Microservices Architecture](#51-microservices-architecture)
   - 5.2 [API Gateway Pattern](#52-api-gateway-pattern)
   - 5.3 [Saga Pattern](#53-saga-pattern)
   - 5.4 [Repository Pattern](#54-repository-pattern)
   - 5.5 [Layered Architecture Pattern](#55-layered-architecture-pattern)
6. [Module-by-Module, File-by-File Explanation](#6-module-by-module-file-by-file-explanation)
   - 6.1 [api-gateway](#61-api-gateway-port-8080)
   - 6.2 [student-service](#62-student-service-port-8081)
   - 6.3 [course-service](#63-course-service-port-8082)
   - 6.4 [enrollment-service](#64-enrollment-service-port-8083)
   - 6.5 [notification-service](#65-notification-service-port-8084)
7. [Complete Endpoint Inventory](#7-complete-endpoint-inventory)
8. [Endpoint-by-Endpoint Flow Explanations](#8-endpoint-by-endpoint-flow-explanations)
9. [Kafka Topics Reference](#9-kafka-topics-reference)
10. [End-to-End System Flows (Full Sequence Walkthroughs)](#10-end-to-end-system-flows)
11. [Centralized Authentication — Deep Mechanics](#11-centralized-authentication--deep-mechanics)
12. [Prerequisites — What Must Be Ready Before You Start](#12-prerequisites--what-must-be-ready-before-you-start)
13. [Running the System — Step-by-Step Startup](#13-running-the-system--step-by-step-startup)
14. [Stopping the System & Common Startup Problems](#14-stopping-the-system--common-startup-problems)
15. [Design Trade-offs and Why They Were Made](#15-design-trade-offs-and-why-they-were-made)
16. [Glossary](#16-glossary)
17. [Absolute Beginner's Guide — The Complete Flow From Zero](#17-absolute-beginners-guide--the-complete-flow-from-zero) **(start here if you're new to Java)**
    - 17.1 [Vocabulary Primer](#171-vocabulary-primer)
    - 17.2 [Part A — What Happens the Instant You Start ONE Service](#172-part-a--what-happens-the-instant-you-start-one-service)
    - 17.3 [Part B — What Happens on the Network Before Any Java Code Runs](#173-part-b--what-happens-on-the-network-before-any-java-code-runs)
    - 17.4 [Part C — Full Trace: A Simple GET Request, Entry Point to Response](#174-part-c--full-trace-a-simple-get-request-entry-point-to-response)
    - 17.5 [Part D — Full Trace: A POST That Writes Data and Wakes Up Kafka](#175-part-d--full-trace-a-post-that-writes-data-and-wakes-up-kafka)
    - 17.6 [One-Page Cheat Sheet](#176-one-page-cheat-sheet)

---

## 1. Project Overview

`SPRINGB-SMgmt-async-api-gateway-pattern-kafka-Centralized-Auth` is a **Student Management System** built as five independent Spring Boot modules under a single Maven reactor (parent `pom.xml` with `packaging=pom`):

| # | Module | Port | Owns Database | Role |
|---|--------|------|----------------|------|
| 1 | `api-gateway` | 8080 | none (stateless) | Single public entry point, JWT minting, centralized auth enforcement, request routing |
| 2 | `student-service` | 8081 | `StudentDB` | Student master data, addresses, documents, login credentials |
| 3 | `course-service` | 8082 | `CourseDB` | Course catalog, categories, schedules, faculty |
| 4 | `enrollment-service` | 8083 | `EnrollmentDB` | Enrollment lifecycle, saga orchestration, payments |
| 5 | `notification-service` | 8084 | `NotificationDB` | Email/SMS notification simulation, driven entirely by Kafka events |

> **New to Java/Spring entirely?** Every section below assumes you already know basic Java/Spring vocabulary (class, annotation, controller, etc.). If you want a **zero-knowledge, entry-point-to-response trace** — what literally happens the instant you type `mvn spring-boot:run`, and what literally happens the instant a request hits an endpoint, one line at a time — skip ahead to **[§17](#17-absolute-beginners-guide--the-complete-flow-from-zero)** first, then come back here.

The system demonstrates **five architectural/design patterns simultaneously**, and this document explains each one both generically (with a textbook example unrelated to this codebase) and concretely (pointing at the exact classes that implement it here):

1. **Microservices Architecture** — five independently deployable Spring Boot applications, each with its own database, communicating over the network instead of via in-process method calls.
2. **API Gateway Pattern** — Spring Cloud Gateway (`api-gateway` module) as the single client-facing door; backend services are never called directly by an outside client.
3. **Saga Pattern (Choreography style)** — `enrollment-service`, `student-service`, and `course-service` cooperate over Kafka to atomically decide whether an enrollment is valid, without a two-phase-commit distributed transaction.
4. **Repository Pattern** — every service isolates persistence behind Spring Data JPA repository interfaces (`JpaRepository<Entity, Id>`), so service classes never write raw SQL or touch `EntityManager` directly.
5. **Layered Architecture Pattern** — every backend service is internally organized as Controller → Service → Repository → Entity, with a cross-cutting Security filter and a cross-cutting Exception-handling layer.

Two things make this project's authentication model distinctive, and they are the reason "Centralized-Auth" is in the project name:

- **One and only one JWT secret exists in the whole system**, inside `api-gateway`'s `JwtUtil`. No backend service (`student-service`, `course-service`, `enrollment-service`, `notification-service`) ever sees this secret or parses a JWT.
- Backend services instead trust a plain HTTP header, `X-Authenticated-User`, that the gateway injects **after** it has already validated the token. This is the opposite of the "shared-secret validated independently by every service" model used in a sibling project (`SPRINGB-student-mgmt-async-CQRS-pattern-kafka`, visible as a neighboring folder) — here, trust flows outward from a single choke point instead of being duplicated everywhere.

---

## 2. High-Level Architecture

```
                                   ┌─────────────────────────────┐
                                   │           CLIENT            │
                                   │ (Postman / curl / frontend) │
                                   └──────────────┬───────────────┘
                                                  │  HTTPS/HTTP
                                                  │  Authorization: Bearer <JWT>
                                                  ▼
                              ┌───────────────────────────────────────┐
                              │            API GATEWAY (8080)          │
                              │      Spring Cloud Gateway (WebFlux)    │
                              │                                         │
                              │  ┌───────────────────────────────────┐ │
                              │  │ POST /auth/login  (local, not      │ │
                              │  │ proxied) → AuthController          │ │
                              │  │   → StudentLoginClient (WebClient) │ │
                              │  │   → JwtUtil.generateToken()        │ │
                              │  └───────────────────────────────────┘ │
                              │  ┌───────────────────────────────────┐ │
                              │  │ GatewayAuthFilter (GlobalFilter,   │ │
                              │  │ order = -1) — runs for every       │ │
                              │  │ ROUTED request:                    │ │
                              │  │  1. reads Authorization header     │ │
                              │  │  2. JwtUtil.isValid(token)         │ │
                              │  │  3. injects X-Authenticated-User   │ │
                              │  │  4. rejects with 401 on failure    │ │
                              │  └───────────────────────────────────┘ │
                              │  Path-based routing table (4 routes)   │
                              └───────┬───────┬───────┬───────┬────────┘
                     /api/students/** │       │       │       │ /api/notifications/**
                /api/student-addr..** │       │       │       │ /api/email-logs/**
                /api/student-docs..** │       │       │       │ /api/sms-logs/**
                  /api/student-log..**│       │       │       │
                                      ▼       │       │       ▼
                ┌─────────────────────────┐  │       │  ┌──────────────────────────┐
                │  student-service (8081)  │  │       │  │ notification-service      │
                │       StudentDB          │  │       │  │      (8084)                │
                └───────────┬─────────────┘  │       │  │     NotificationDB         │
                            │                 │       │  └─────────────┬─────────────┘
                 Kafka:     │                 │       │                │ Kafka:
       student.validation.result             │       │    enrollment.confirmed /
                            │                 │       │    enrollment.rejected
                            │      /api/courses/**    │                │
                            │      /api/course-cat..**│                │
                            │      /api/course-sch..**│                │
                            │      /api/course-fac..**│                │
                            │                 ▼       │                │
                            │      ┌─────────────────────────┐         │
                            │      │  course-service (8082)   │         │
                            │      │       CourseDB           │         │
                            │      └───────────┬─────────────┘         │
                            │        Kafka:     │                       │
                            │      course.validation.result             │
                            │                    │                       │
                            │                    │  /api/enrollments/**  │
                            │                    │  /api/enrollment-st..**
                            │                    │  /api/payments/**     │
                            │                    ▼                       │
                            │        ┌───────────────────────────┐      │
                            └───────▶│  enrollment-service (8083)  │──────┘
                          Kafka:     │       EnrollmentDB          │  Kafka:
              enrollment.requested   │   (Saga Orchestrator)       │  enrollment.confirmed /
              (fan-out to both)      └─────────────────────────────┘  enrollment.rejected
                                                    ▲
                                                    │
                                        ┌───────────────────────┐
                                        │   Apache Kafka (KRaft)  │
                                        │  broker, port 9095      │
                                        │  (docker-compose.yml)   │
                                        └─────────────────────────┘
```

**Key observations baked into this diagram:**

- The client never talks to `student-service`, `course-service`, `enrollment-service`, or `notification-service` directly — only to `api-gateway:8080`. (Direct calls are technically possible since each service listens on its own port, but nothing in the intended flow does this, and doing so bypasses all authentication — see §11.)
- The **only synchronous HTTP call anywhere in this system** is the gateway's login handshake: `api-gateway` → `student-service` (`POST /api/student-logins/verify`) via a reactive `WebClient`. Everything else — the enrollment validation, the outcome notification — happens asynchronously over Kafka.
- Kafka is the backbone for all cross-service business logic. There is no OpenFeign, no RestTemplate/WebClient between the four backend services.

---

## 3. Infrastructure & Build Setup

### 3.1 Maven Multi-Module Build (`pom.xml`)

The root `pom.xml` is a **reactor POM** (`<packaging>pom</packaging>`) — it builds no code of its own, it just aggregates five child modules so `mvn clean install` from the root compiles all five in dependency order:

```xml
<modules>
    <module>student-service</module>
    <module>course-service</module>
    <module>notification-service</module>
    <module>enrollment-service</module>
    <module>api-gateway</module>
</modules>
```

Shared coordinates fixed at the parent level:
- Parent BOM: `spring-boot-starter-parent:3.4.2` — pins every Spring dependency's version for all five children.
- `java.version = 21`
- `spring-cloud.version = 2024.0.0` — used only by `api-gateway` for Spring Cloud Gateway.
- `jjwt.version = 0.12.6` — the JWT library, used only by `api-gateway`.

Each child module has its own `pom.xml` (not shown as a bundled file above, but present on disk) declaring its own dependencies (`spring-boot-starter-web`, `spring-boot-starter-data-jpa`, `spring-kafka`, `mysql-connector-j`, `spring-boot-starter-validation`), which is what allows each service to be built, versioned, and deployed independently — a Microservices Architecture requirement (see §5.1).

### 3.2 Docker Compose (`docker-compose.yml`)

Only **one** infrastructure container is defined: a **KRaft-mode Apache Kafka broker** (`apache/kafka:3.7.0` — no separate Zookeeper needed, since KRaft folds the controller role into the broker itself).

```yaml
services:
  kafka:
    image: apache/kafka:3.7.0
    ports:
      - "9095:9095"          # host port, deliberately non-default
    environment:
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_LISTENERS: PLAINTEXT://0.0.0.0:19092,CONTROLLER://0.0.0.0:19093,EXTERNAL://0.0.0.0:9095
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:19092,EXTERNAL://localhost:9095
      ...
      KAFKA_AUTO_CREATE_TOPICS_ENABLE: "true"
```

Notable details:
- **Three listeners** are configured: `PLAINTEXT` (internal, for other containers on the `kafka` Docker network), `CONTROLLER` (KRaft consensus traffic), and `EXTERNAL` (what host-machine Spring Boot processes actually connect to, at `localhost:9095`).
- Port **9095** was deliberately chosen instead of the Kafka default `9092` because the developer's machine already runs an unrelated project's broker on `9092`, and a sibling project (`SPRINGB-student-mgmt-async-CQRS-pattern-kafka`) uses `9094` — this is a comment left directly in the compose file to prevent port clashes when running multiple Kafka-based projects side by side.
- `KAFKA_AUTO_CREATE_TOPICS_ENABLE: "true"` means none of the five topics (`enrollment.requested`, `student.validation.result`, `course.validation.result`, `enrollment.confirmed`, `enrollment.rejected`) need to be pre-created — Kafka creates them the first time a producer publishes to a topic name it hasn't seen.
- MySQL itself is **not containerized** here — `application.properties` in every backend service defaults to `jdbc:mysql://localhost:3306/...`, so MySQL is expected to already be running on the host (installed natively), seeded by the four scripts in `/sql`.

### 3.3 SQL Seed Scripts (`/sql`)

Four scripts, one per owned database, each idempotent (`DROP DATABASE IF EXISTS ... ; CREATE DATABASE ...`) and pre-loaded with sample rows so the system is immediately explorable via GET requests without needing to POST data first:

| Script | Database | Tables Created |
|---|---|---|
| `01_student_db.sql` | `StudentDB` | `Students`, `Student_Address`, `Student_Documents`, `Student_Login` |
| `02_course_db.sql` | `CourseDB` | `Course_Category`, `Courses`, `Course_Schedule`, `Course_Faculty` |
| `03_enrollment_db.sql` | `EnrollmentDB` | `Enrollment_Status`, `Enrollments`, `Enrollment_Validation`, `Payments` |
| `04_notification_db.sql` | `NotificationDB` | `Notifications`, `Email_Logs`, `SMS_Logs` |

Every backend service's `application.properties` sets `spring.jpa.hibernate.ddl-auto=none` — Hibernate never generates or alters schema. The SQL scripts are the single source of truth for table structure, and must be run manually (or via a setup script) before any service starts.

---

## 4. Database-per-Service Layout

This is the data half of the Microservices pattern: **each service owns one schema, and no other service is permitted to query it directly.**

```
StudentDB          CourseDB            EnrollmentDB              NotificationDB
───────────         ─────────           ─────────────             ───────────────
Students            Course_Category     Enrollment_Status         Notifications
Student_Address     Courses             Enrollments               Email_Logs
Student_Documents   Course_Schedule     Enrollment_Validation     SMS_Logs
Student_Login       Course_Faculty      Payments

  owned by             owned by              owned by                 owned by
student-service     course-service      enrollment-service       notification-service
```

Cross-schema references (e.g., `Enrollments.student_id` pointing conceptually at `StudentDB.Students.student_id`) are **plain `BIGINT` columns with no foreign-key constraint** — MySQL cannot enforce a foreign key across two separate schemas/databases in this configuration, and even if it could, "database per service" as a principle forbids `enrollment-service` from reaching into `StudentDB` directly. The `03_enrollment_db.sql` comments spell this out explicitly:

> "There is deliberately NO foreign key across those schemas... An Enrollment row is created immediately in PENDING_VALIDATION status, and validity is confirmed asynchronously via the Kafka saga."

This is precisely why the Saga Pattern (§5.3) exists in this codebase: without a shared database and without a synchronous cross-service call, something else has to guarantee that an enrollment referencing a nonexistent student or course eventually gets caught and rejected. That "something else" is the Kafka-based validation saga in `enrollment-service`.

---

## 5. Design Patterns Used in This Project

Each pattern below is explained in three layers: **(a)** the general concept as it would be taught in a systems-design course, **(b)** a real-world/generic software example that has nothing to do with this codebase, and **(c)** exactly how and where this project implements it.

### 5.1 Microservices Architecture

**(a) The concept.** Microservices architecture structures an application as a collection of small, independently deployable services, each built around a specific business capability, each owning its own data store, and communicating with other services over the network (HTTP, messaging, gRPC) rather than through in-process function calls. This is the opposite of a **monolith**, where all business capabilities (say, user management, catalog, ordering, billing) live in one codebase, one deployable artifact, and one shared database.

The benefits microservices chase: independent deployability (ship the billing team's code without redeploying catalog), independent scalability (scale the checkout service to 50 instances during a sale without scaling everything else), fault isolation (catalog crashing doesn't necessarily take down billing), and technology freedom (each service can pick its own language/framework/database). The costs: network latency and partial failure become everyday realities, data consistency across services requires deliberate patterns (like Sagas), and operational complexity (more things to deploy, monitor, and version) goes up substantially.

**(b) Generic example (unrelated to this codebase).** Picture an e-commerce platform split into: `catalog-service` (owns the `ProductsDB`, exposes `GET /products/{id}`), `inventory-service` (owns `StockDB`, exposes `POST /reserve`), `order-service` (owns `OrdersDB`, orchestrates checkout), and `payment-service` (owns `PaymentsDB`, talks to a card processor). When a customer clicks "Buy," `order-service` doesn't run a SQL join across all four databases — it calls `inventory-service` to reserve stock, then `payment-service` to charge the card, coordinating the two over the network. Each of those four services can be written by a different team, redeployed on its own schedule, and would keep functioning (in a degraded way) if one of the others went down temporarily.

**(c) In this project.** The five modules — `api-gateway`, `student-service`, `course-service`, `enrollment-service`, `notification-service` — are exactly this pattern, scaled down to a teaching-sized system:

- Each is a **separate Spring Boot application** with its own `@SpringBootApplication` main class (`StudentServiceApplication`, `CourseServiceApplication`, `EnrollmentServiceApplication`, `NotificationServiceApplication`, `ApiGatewayApplication`), its own `application.properties`/`application.yml`, and its own port (8081–8084, plus 8080 for the gateway).
- Each owns a **separate MySQL database** (`StudentDB`, `CourseDB`, `EnrollmentDB`, `NotificationDB`) — see §4.
- They communicate **exclusively over the network**: HTTP through the gateway for client-facing CRUD, and Kafka topics for cross-service business events (the enrollment validation saga, the outcome notification).
- Each can, in principle, be started, stopped, and redeployed independently — `notification-service` being down does not prevent a student from being created in `student-service`, it just means an eventual `enrollment.confirmed` message would sit unconsumed in Kafka until `notification-service` comes back (Kafka retains it — this is a benefit of asynchronous messaging over direct calls).

### 5.2 API Gateway Pattern

**(a) The concept.** An API Gateway is a single entry point that sits in front of a set of backend services and handles cross-cutting concerns — routing, authentication, rate limiting, request/response transformation, aggregation — so that individual backend services don't have to duplicate that logic, and so that clients don't need to know how many backend services exist or where each one lives. Without a gateway, a mobile app would need to know student-service is at `host-a:8081`, course-service at `host-b:8082`, and so on, and would need to implement auth-token validation itself against every one of those hosts. With a gateway, the client only ever needs one hostname and one credential-passing convention; the gateway takes care of finding and forwarding to the right backend.

**(b) Generic example (unrelated to this codebase).** Netflix's edge service (historically Zuul, later Spring Cloud Gateway) sits in front of hundreds of internal microservices. A mobile client hits `api.netflix.com/browse`, and the gateway — based on path, headers, or the caller's device type — routes that single request to whichever internal `browse-service` instance should handle it, injects the authenticated user's ID as a header so `browse-service` doesn't need to re-validate a session token, and can even merge responses from multiple backend calls into one payload before returning it to the client.

**(c) In this project.** The `api-gateway` module, built on **Spring Cloud Gateway** (reactive, Netty/WebFlux-based, not the older Netflix Zuul/servlet based gateway), is this pattern precisely:

- `application.yml` defines **four path-based routes**, each forwarding an entire family of paths to one backend service untouched (no path rewriting):

```yaml
routes:
  - id: student-service
    uri: ${SERVICE_STUDENT_URL:http://localhost:8081}
    predicates:
      - Path=/api/students/**,/api/student-addresses/**,/api/student-documents/**,/api/student-logins/**
  - id: course-service
    uri: ${SERVICE_COURSE_URL:http://localhost:8082}
    predicates:
      - Path=/api/courses/**,/api/course-categories/**,/api/course-schedules/**,/api/course-faculty/**
  - id: enrollment-service
    uri: ${SERVICE_ENROLLMENT_URL:http://localhost:8083}
    predicates:
      - Path=/api/enrollments/**,/api/enrollment-statuses/**,/api/payments/**
  - id: notification-service
    uri: ${SERVICE_NOTIFICATION_URL:http://localhost:8084}
    predicates:
      - Path=/api/notifications/**,/api/email-logs/**,/api/sms-logs/**
```

- `GatewayAuthFilter` (a `GlobalFilter`) is the cross-cutting authentication concern living **once**, at the gateway, instead of being reimplemented four times inside each backend service.
- `AuthController`'s `/auth/login` is a **local, non-routed** endpoint — the one exception where the gateway does more than forward; it centralizes token issuance the same way it centralizes token validation.
- The client only ever needs to know `http://localhost:8080` — it never learns that `course-service` happens to run on 8082, and that mapping could change (or `course-service` could be split into two services, or scaled to three instances behind a load balancer) without the client's code changing at all.

### 5.3 Saga Pattern

**(a) The concept.** In a monolith with one database, a multi-step business operation ("place an order, reserve stock, charge a card") is wrapped in a single ACID database transaction — if any step fails, the whole thing rolls back atomically. In microservices, that operation's steps are scattered across services with separate databases, so a single database transaction is impossible, and a classic distributed transaction protocol (two-phase commit) is generally avoided because it requires all participants to hold locks until every participant votes, which harms availability and doesn't play well with typical microservice deployments.

The **Saga pattern** solves this by breaking the operation into a sequence of local transactions, one per service, each of which either completes and publishes an event/triggers the next step, or fails and triggers **compensating actions** to undo the effects of the steps that already succeeded. There are two common implementation styles:

- **Choreography** — there is no central coordinator. Each service listens for events from other services and decides on its own what to do next, publishing its own event when it's done. This keeps services decoupled but can make the overall flow harder to trace for a human reading the code, since the logic is spread across N services.
- **Orchestration** — a dedicated orchestrator service explicitly tells each participant what to do, step by step ("reserve stock," then "charge card," then "ship order"), and handles compensation centrally if a step fails. This centralizes the flow logic (easier to reason about) at the cost of introducing a coordinator that all participants depend on.

**(b) Generic example (unrelated to this codebase).** A travel-booking system needs to book a flight, a hotel, and a rental car as one logical "trip booking." `flight-service`, `hotel-service`, and `car-service` each have their own database. In an orchestrated saga, a `trip-orchestrator` calls `flight-service.book()`, and on success calls `hotel-service.book()`, and on success calls `car-service.book()`. If `car-service.book()` fails (no cars available), the orchestrator issues compensating calls: `hotel-service.cancel()` and `flight-service.cancel()`, unwinding the two steps that had already succeeded, so the customer isn't left with a flight and hotel booked but no car and a mysteriously silent failure.

**(c) In this project — a choreographed saga.** `enrollment-service`'s `EnrollmentSagaService`, together with the Kafka listeners in `student-service` and `course-service`, implements a **choreographed** saga (no single orchestrator class tells the other two services what to do — they each independently listen for `enrollment.requested` and reply on their own topic):

**Saga steps, in order:**

1. **Local transaction 1 (enrollment-service):** `POST /api/enrollments` arrives. `EnrollmentService.create()` inserts an `Enrollments` row with `status = PENDING_VALIDATION`, inserts a companion `Enrollment_Validation` row (both `student_valid` and `course_valid` columns `NULL`), and publishes `enrollment.requested` to Kafka — all inside one `@Transactional` method, so the local database write and the fact that a Kafka event was queued to be sent happen together. The HTTP response is `202 Accepted`, not `201 Created`, because the saga hasn't resolved yet.
2. **Local transaction 2a (student-service), independent of 2b:** `EnrollmentRequestedListener` consumes `enrollment.requested`, checks `studentRepository.existsById(studentId)` against its own `StudentDB`, and publishes the answer to `student.validation.result`.
3. **Local transaction 2b (course-service), independent of 2a:** `EnrollmentRequestedListener` consumes the same `enrollment.requested` message (Kafka fans one message out to every consumer group subscribed to the topic — `student-service-group` and `course-service-group` are different consumer groups, so both receive every message), checks `courseRepository.existsById(courseId)` against `CourseDB`, and publishes to `course.validation.result`.
4. **Local transaction 3 (enrollment-service), fired twice, order not guaranteed:** `StudentValidationResultListener` and `CourseValidationResultListener` each consume their respective topic and call into `EnrollmentSagaService.applyStudentValidationResult(...)` / `applyCourseValidationResult(...)`. Each of these does a **targeted bulk `UPDATE`** (not a load-modify-save) on the single column it owns in `Enrollment_Validation`, specifically to avoid a lost-update race between the two nearly-simultaneous listener threads (see the extended comment in `EnrollmentValidationRepository` — this is the concurrency-correctness detail that makes the choreography safe).
5. **Saga resolution (enrollment-service):** after each partial update, `EnrollmentSagaService.resolveIfComplete()` checks `EnrollmentValidation.isResolved()` (both columns non-null). The **first** of the two listener threads to arrive sees the saga still incomplete and does nothing further; the **second** thread to arrive sees both columns populated, decides `CONFIRMED` (both valid) or `REJECTED` (either invalid), updates `Enrollments.status_id` accordingly, and publishes `enrollment.confirmed` or `enrollment.rejected`.
6. **Terminal consumer (notification-service):** `EnrollmentOutcomeListener` consumes both `enrollment.confirmed` and `enrollment.rejected`, and `EnrollmentOutcomeService` writes `Notifications`/`Email_Logs` (and `SMS_Logs` on confirmation only) rows — simulating the "send an email/SMS" step with no external mail/SMS gateway wired up.

**Compensation, or the lack of it:** this saga has **no explicit compensating transaction** because none of its steps mutate external state that would need to be undone — `student-service` and `course-service` only *read* their databases to answer the validation question; they never write anything on behalf of the saga. The only saga participant that writes durable state as a result of validation is `enrollment-service` itself (flipping `Enrollments.status_id` to `CONFIRMED`/`REJECTED`), and that write only ever happens once, after the saga is already fully resolved — there's nothing earlier to compensate for. This is a **simple/read-only-participant saga**, which is why the implementation could skip compensating actions and still be correct; a saga involving payments or stock reservation (like the generic travel-booking example above) would need them.

### 5.4 Repository Pattern

**(a) The concept.** The Repository pattern puts an abstraction layer between business/service logic and the actual mechanism used to persist and retrieve data. Instead of a service class writing `SELECT * FROM students WHERE student_id = ?` directly (or manipulating a JDBC `Connection`/`ResultSet`, or even directly using JPA's `EntityManager`), it depends on a `Repository` interface — `findById`, `save`, `deleteById`, `findByX` — and never knows or cares whether that interface is backed by a relational database, an in-memory `HashMap`, MongoDB, or a REST call to another system. This makes service logic trivially unit-testable (swap in a fake in-memory repository), and it means a later decision to change databases only requires rewriting the repository implementation, not every service method that touches data.

**(b) Generic example (unrelated to this codebase).** A `UserService` in a Node.js/TypeScript app depends on a `UserRepository` interface with `findById(id): User | null` and `save(user): void`. In production, `SqlUserRepository implements UserRepository` runs parameterized SQL against Postgres. In unit tests, `InMemoryUserRepository implements UserRepository` just keeps a `Map<string, User>` in memory — the exact same `UserService` code, and the exact same tests asserting business rules like "a user's email must be unique," run against both implementations without any change, because `UserService` only ever calls the interface, never a concrete SQL statement.

**(c) In this project.** Every entity gets its own **Spring Data JPA repository interface**, extending `JpaRepository<EntityType, IdType>`, which is Spring's ready-made implementation of the Repository pattern — you declare an interface, and Spring generates the implementation (a dynamic proxy) at startup, wiring `findAll`, `findById`, `save`, `deleteById`, `existsById` for free, plus any custom finder methods you declare by naming convention:

```java
public interface StudentRepository extends JpaRepository<Student, Long> {
}

public interface StudentLoginRepository extends JpaRepository<StudentLogin, Long> {
    List<StudentLogin> findByStudentId(Long studentId);
    Optional<StudentLogin> findByUsername(String username);   // Spring derives the SQL from the method name
}
```

Every one of the thirteen entities in this project (`Student`, `StudentAddress`, `StudentDocument`, `StudentLogin`, `CourseCategory`, `Course`, `CourseSchedule`, `CourseFaculty`, `Enrollment`, `EnrollmentStatus`, `EnrollmentValidation`, `Payment`, `Notification`, `EmailLog`, `SmsLog`) has exactly one matching repository interface, and every `Service` class depends only on the repository interface, never on `EntityManager`, `JdbcTemplate`, or a raw `DataSource`. The one place this project goes slightly beyond auto-generated finders is `EnrollmentValidationRepository`, which declares two **custom `@Query`-annotated bulk-update methods** (`updateStudentResult`, `updateCourseResult`) specifically to get atomic single-column updates instead of Spring Data's default load-then-save behavior — still entirely inside the Repository abstraction, just with a hand-written JPQL query instead of a derived one.

### 5.5 Layered Architecture Pattern

**(a) The concept.** Layered (or "N-tier") architecture organizes a single application/service internally into horizontal layers, each with one clear responsibility, where a layer may only call the layer directly below it (never skip layers, never call upward). A typical web-service stack is:

- **Presentation/Controller layer** — parses HTTP requests, validates input shape, calls the service layer, maps results back to HTTP responses. Contains no business logic.
- **Service/Business layer** — implements business rules, orchestrates one or more repository calls, decides what's allowed and what isn't.
- **Persistence/Repository layer** — talks to the database.
- **Data/Entity layer** — plain objects mapping to database rows or DTOs shaping wire payloads.

This keeps concerns separated: a change to how HTTP requests are parsed (say, switching from Spring MVC to a different web framework) shouldn't require touching business rules, and a change to a business rule shouldn't require touching SQL.

**(b) Generic example (unrelated to this codebase).** A banking app's `TransferController` (presentation layer) receives `POST /transfers {from, to, amount}`, does basic null/format checks, and calls `TransferService.transfer(from, to, amount)`. `TransferService` (business layer) enforces the actual rule — "the source account's balance must be >= amount, else throw InsufficientFundsException" — by calling `AccountRepository.findById(from)` and `AccountRepository.findById(to)` (persistence layer), which return `Account` objects (data layer) that themselves know nothing about HTTP or business rules — they're just fields plus getters/setters. If the bank later needs to also expose transfers over a gRPC API alongside REST, only a new presentation-layer class is needed; `TransferService` and everything below it is reused unchanged.

**(c) In this project.** Every one of the four backend services (`student-service`, `course-service`, `enrollment-service`, `notification-service`) follows this exact stack, visible directly in the package structure:

```
com.studentmgmt.<service>
 ├── controller/   ← @RestController classes: parse HTTP, call service, return DTO/entity
 ├── service/      ← @Service classes: business rules, orchestrate repositories
 ├── repository/   ← JpaRepository interfaces: talk to the database
 ├── entity/       ← @Entity classes: JPA-mapped rows
 ├── dto/          ← request/response shapes that aren't raw entities (e.g. login verify)
 ├── event/        ← Kafka message payload shapes (a variant of DTOs, for the messaging layer)
 ├── kafka/        ← producers/listeners: the messaging equivalent of the controller layer
 ├── security/     ← AuthenticatedUserFilter: a cross-cutting layer, runs before controllers
 └── exception/    ← GlobalExceptionHandler + custom exceptions: cross-cutting error mapping
```

For example, in `student-service`, `StudentController.create(...)` never touches `StudentRepository` directly — it calls `StudentService.create(...)`, which calls `studentRepository.save(...)`. `StudentController` has zero business logic (it doesn't even check whether the email already exists — that would be `StudentService`'s job if it needed it, though in this simplified project it's left to the database's `UNIQUE` constraint and `GlobalExceptionHandler`'s `DataIntegrityViolationException` handler to catch it at the boundary). This project adds two layers not in the classic four-layer textbook list, both cross-cutting rather than sequential:

- The **`kafka` package** acts as an *alternate, asynchronous presentation layer* — instead of an HTTP request triggering the service layer, a Kafka message does, via `@KafkaListener`-annotated methods that call straight into the same kind of service classes (`EnrollmentSagaService`) used by the synchronous controllers.
- The **`security` package** (`AuthenticatedUserFilter`, a `OncePerRequestFilter`) sits *above* the controller layer in the servlet filter chain, executing on every request before any `@RestController` method runs, making the already-validated identity available via a request attribute.

---

## 6. Module-by-Module, File-by-File Explanation

### 6.1 `api-gateway` (port 8080)

Package root: `com.studentmgmt.gateway`. Built on Spring Cloud Gateway (WebFlux/reactive), not Spring MVC — this is the only reactive module in the whole system.

| File | Layer | Purpose |
|---|---|---|
| `ApiGatewayApplication.java` | bootstrap | Standard `@SpringBootApplication` entry point; `SpringApplication.run(...)`. Nothing custom. |
| `controller/AuthController.java` | presentation | The **only** place a JWT is ever minted. Exposes `POST /auth/login`. Delegates credential checking to `student-service` via `StudentLoginClient`, then calls `JwtUtil.generateToken()` on success. Returns `401` with a plain string body on invalid credentials, `200` with a `LoginResponse` (token + `"Bearer"` type) on success. This is a **local WebFlux controller**, not a proxied route — `/auth/login` matches none of the four `Path=` predicates in `application.yml`, so it's handled directly inside the gateway process and never forwarded anywhere. |
| `client/StudentLoginClient.java` | integration | Wraps the **one synchronous-style HTTP call** in the entire system. Uses a reactive `WebClient` (`Mono`-returning, never blocks Netty's event loop) to `POST /api/student-logins/verify` on `student-service`. Returns a `Mono<VerifyCredentialsResponse>`. |
| `config/WebClientConfig.java` | configuration | Declares the single `WebClient` bean, base-URL'd to `student-service` via the `services.student.url` property (reuses the same env var, `SERVICE_STUDENT_URL`, as the gateway's own routing table, so both always point at the same place). |
| `security/JwtUtil.java` | security | Generates and validates HMAC-SHA-signed JWTs (`io.jsonwebtoken` / jjwt 0.12.6). Holds the **only copy of the signing secret** in the whole system (`app.jwt.secret`, defaulting to a placeholder string with a "please rotate me" comment). `generateToken(username)` sets `subject`, `issuedAt`, `expiration` (1 hour, `app.jwt.expiration-ms=3600000`), and signs. `isValid(token)` and `extractUsername(token)` parse and verify signature/expiry. |
| `security/GatewayAuthFilter.java` | security | A Spring Cloud Gateway `GlobalFilter` (implements `Ordered`, `getOrder() = -1` so it runs before routing filters). This is **the actual enforcement point** of centralized auth. Skips `/auth/**` paths. For everything else: requires `Authorization: Bearer <token>`, validates it via `JwtUtil`, and on success **mutates the outgoing request** to add an `X-Authenticated-User: <username>` header before letting the request continue to the routed backend. On failure, writes a `401` JSON body directly and never calls `chain.filter(...)` — the backend service is never reached. |
| `dto/LoginRequest.java` | data | `{username, password}`, both `@NotBlank` — the body shape for `POST /auth/login`. |
| `dto/LoginResponse.java` | data | `{token, tokenType="Bearer"}` — the body shape returned on successful login. |
| `dto/VerifyCredentialsRequest.java` | data | The gateway's own copy of the request shape it sends to `student-service`'s verify endpoint — `{username, password}`. |
| `dto/VerifyCredentialsResponse.java` | data | The gateway's own copy of the response shape it expects back — `{valid, studentId, username}`. |
| `application.yml` | configuration | Server port `8080`; the four Spring Cloud Gateway routes; `services.student.url`; `app.jwt.secret` / `app.jwt.expiration-ms`. |

**Why the DTOs are duplicated instead of shared:** `api-gateway`'s `dto` package and `student-service`'s `dto` package each define their own `VerifyCredentialsRequest`/`VerifyCredentialsResponse` classes with identical fields. This is deliberate (the codebase comments call it out explicitly in the event classes too) — sharing a common JAR between services would recreate a coupling point that defeats independent deployability: if you change the shared JAR, every service depending on it must be rebuilt and redeployed together. Keeping each service's copy of a cross-service contract independent means the JSON wire format is the only real contract, and either side can evolve its internal representation freely as long as the JSON shape is preserved.

### 6.2 `student-service` (port 8081)

Package root: `com.studentmgmt.student`. Standard Spring MVC (servlet, blocking) service.

| File | Layer | Purpose |
|---|---|---|
| `StudentServiceApplication.java` | bootstrap | Entry point. |
| `controller/StudentController.java` | presentation | `/api/students` — full CRUD (`GET` all, `GET /{id}`, `GET /{id}/exists`, `POST`, `PUT /{id}`, `DELETE /{id}`). The `/{id}/exists` endpoint is explicitly a debugging convenience — the real saga validation path goes through Kafka (`EnrollmentRequestedListener`), not this REST endpoint. |
| `controller/StudentAddressController.java` | presentation | `/api/student-addresses` — CRUD, `GET` supports optional `?studentId=` filter. |
| `controller/StudentDocumentController.java` | presentation | `/api/student-documents` — `GET` (optionally filtered by `studentId`), `GET /{id}`, `POST`, `DELETE /{id}` (no `PUT` — documents are immutable once uploaded, by design). |
| `controller/StudentLoginController.java` | presentation | `/api/student-logins` — full CRUD **plus** `POST /verify`, which is the endpoint the gateway calls during login. `/verify` always returns HTTP 200 with a `valid` boolean rather than a 401, precisely so the gateway's `WebClient` call can treat "wrong password" as ordinary data instead of an HTTP error to catch. |
| `controller/WhoAmIController.java` | presentation | `GET /api/students/me` — reads the `AuthenticatedUserFilter`-populated request attribute and echoes back who the gateway thinks is calling. A literal `/me` path segment beats the `/{id}` path-variable pattern in Spring MVC's route-matching regardless of declaration order, so this needed no change to `StudentController` and no new gateway route. |
| `dto/VerifyCredentialsRequest.java` / `VerifyCredentialsResponse.java` | data | Mirror the shapes the gateway sends/expects, on this side of the wire. `VerifyCredentialsResponse` has static factories `invalid()` and `valid(studentId, username)` for readability. |
| `entity/Student.java` | data | Maps `Students` table. Fields: `studentId` (PK, identity), `firstName`, `lastName`, `email` (`@Email @NotBlank unique`), `phone`, `dateOfBirth`, `gender`, `enrollmentDate`, `createdAt`/`updatedAt` (DB-managed, `insertable=false, updatable=false`). |
| `entity/StudentAddress.java` | data | Maps `Student_Address`. FK `studentId` (plain long, same-schema so no cross-service concern here), `addressType`, address lines, city/state/postal/country. |
| `entity/StudentDocument.java` | data | Maps `Student_Documents`. `documentType` (`@NotBlank`), `documentNumber`, `filePath`, `uploadedAt` (DB-managed). |
| `entity/StudentLogin.java` | data | Maps `Student_Login`. `username` (unique), `passwordHash` (`@JsonIgnore` — **never serialized back to any HTTP response**, a security-conscious detail), `active` (boolean), `lastLogin`. |
| `event/EnrollmentRequestedEvent.java` | data (messaging) | This service's own copy of the `enrollment.requested` message shape: `{enrollmentId, studentId, courseId, requestedAt}`. |
| `event/ValidationResultEvent.java` | data (messaging) | The shape this service *publishes*: `{enrollmentId, valid, reason, source, checkedAt}`. |
| `exception/GlobalExceptionHandler.java` | cross-cutting | `@RestControllerAdvice` mapping `ResourceNotFoundException→404`, `DataIntegrityViolationException→409`, `MethodArgumentNotValidException→400` (with field-level messages joined), `IllegalArgumentException→400`, `MethodArgumentTypeMismatchException→400` (e.g. `/api/students/abc` where `abc` isn't a valid `Long`), and a catch-all `Exception→500`. Every response body is a consistent `{timestamp, status, error, message}` JSON shape. |
| `exception/ResourceNotFoundException.java` | cross-cutting | Simple `RuntimeException` subclass thrown by every `Service.findById()` when a row doesn't exist. |
| `kafka/EnrollmentRequestedListener.java` | messaging (presentation-equivalent) | `@KafkaListener(topics = enrollment.requested)`. On each message: deserializes to `EnrollmentRequestedEvent`, checks `studentRepository.existsById(studentId)`, and publishes a `ValidationResultEvent` via `ValidationResultProducer`. This is the **direct replacement** for what would have been a synchronous `StudentFeignClient.exists()` call in a non-Kafka version of this system. |
| `kafka/ValidationResultProducer.java` | messaging | Thin `KafkaTemplate<String,String>` wrapper; the only class in this service that publishes to Kafka. Serializes the event to JSON via Jackson `ObjectMapper`, keys the Kafka message by `enrollmentId` (so all messages about the same enrollment land on the same partition, preserving order per-enrollment). |
| `repository/StudentRepository.java` | persistence | `JpaRepository<Student, Long>` — no custom methods needed. |
| `repository/StudentAddressRepository.java` | persistence | Adds `findByStudentId(Long)`. |
| `repository/StudentDocumentRepository.java` | persistence | Adds `findByStudentId(Long)`. |
| `repository/StudentLoginRepository.java` | persistence | Adds `findByStudentId(Long)` and `findByUsername(String)`. |
| `security/AuthenticatedUserFilter.java` | cross-cutting | A `OncePerRequestFilter` that reads `X-Authenticated-User` (set by the gateway) into a request attribute, defaulting to `"anonymous"` if absent. This service **enforces nothing** — it has no notion of "reject this request," it only records identity for controllers (specifically `WhoAmIController`) to read. If you hit `student-service:8081` directly, bypassing the gateway, every request is simply treated as anonymous — nothing blocks it, which is a deliberate trade-off discussed in §11. |
| `service/StudentService.java` | business | `findAll`, `findById` (throws `ResourceNotFoundException`), `existsById`, `create`, `update` (loads existing, copies every field from the incoming object, saves), `delete` (loads first, to get a proper 404 instead of a silent no-op, then deletes). |
| `service/StudentAddressService.java` | business | Same CRUD shape, `findAll(studentId)` branches to the filtered repository method when a `studentId` param is present. |
| `service/StudentDocumentService.java` | business | Same shape; no `update` method (documents are create/delete only). |
| `service/StudentLoginService.java` | business | `verifyCredentials(username, password)` — looks up by username, filters on `active == true` and `passwordHash.equals(password)` (a plain string comparison, explicitly called out in a comment as a simplification for the demo — a production system would use `BCryptPasswordEncoder.matches()` and never compare raw strings), and returns `VerifyCredentialsResponse.valid(...)` or `.invalid()`. Plus standard CRUD for login records themselves. |
| `application.properties` | configuration | Port `8081`; MySQL connection to `StudentDB`; `ddl-auto=none`; Kafka bootstrap servers (`localhost:9095`), consumer group `student-service-group`; topic name properties `app.kafka.topic.enrollment-requested` / `app.kafka.topic.student-validation-result`. |

### 6.3 `course-service` (port 8082)

Package root: `com.studentmgmt.course`. Structurally a near-mirror of `student-service`, minus login/auth-verification concerns (course-service has no credentials to check).

| File | Layer | Purpose |
|---|---|---|
| `CourseServiceApplication.java` | bootstrap | Entry point. |
| `controller/CourseController.java` | presentation | `/api/courses` — CRUD, `GET` supports `?categoryId=` filter, `GET /{id}/exists` (debug-only, same caveat as student-service). |
| `controller/CourseCategoryController.java` | presentation | `/api/course-categories` — full CRUD. |
| `controller/CourseScheduleController.java` | presentation | `/api/course-schedules` — `GET` (optional `?courseId=`), `GET /{id}`, `POST`, `DELETE` (no `PUT`). |
| `controller/CourseFacultyController.java` | presentation | `/api/course-faculty` — `GET` (optional `?courseId=`), `GET /{id}`, `POST`, `DELETE` (no `PUT`). |
| `controller/WhoAmIController.java` | presentation | `GET /api/courses/me` — identical pattern to student-service's version. |
| `entity/Course.java` | data | Maps `Courses`: `categoryId` (FK, same schema), `courseCode` (unique), `courseName`, `description`, `durationWeeks`, `credits`, `fee` (`BigDecimal`), `createdAt`. |
| `entity/CourseCategory.java` | data | Maps `Course_Category`: `categoryName` (unique), `description`. |
| `entity/CourseSchedule.java` | data | Maps `Course_Schedule`: `courseId` (FK), `startDate`/`endDate`, `classDays`, `startTime`/`endTime`, `roomNumber`. |
| `entity/CourseFaculty.java` | data | Maps `Course_Faculty`: `courseId` (FK), `facultyName`, `email`, `designation`, `department`. |
| `event/EnrollmentRequestedEvent.java` | data (messaging) | Course-service's own copy of the incoming saga trigger shape. |
| `event/ValidationResultEvent.java` | data (messaging) | The shape this service publishes to `course.validation.result`. |
| `exception/GlobalExceptionHandler.java` / `ResourceNotFoundException.java` | cross-cutting | Byte-for-byte the same pattern as student-service's. |
| `kafka/EnrollmentRequestedListener.java` | messaging | Consumes `enrollment.requested`, checks `courseRepository.existsById(courseId)`, publishes to `course.validation.result` via `ValidationResultProducer`. Replaces a hypothetical synchronous `CourseFeignClient.exists()`. |
| `kafka/ValidationResultProducer.java` | messaging | Same `KafkaTemplate` wrapper pattern as student-service's, targeting `app.kafka.topic.course-validation-result`. |
| `repository/CourseRepository.java` | persistence | Adds `findByCategoryId(Long)`. |
| `repository/CourseCategoryRepository.java` | persistence | No custom methods. |
| `repository/CourseScheduleRepository.java` | persistence | Adds `findByCourseId(Long)`. |
| `repository/CourseFacultyRepository.java` | persistence | Adds `findByCourseId(Long)`. |
| `security/AuthenticatedUserFilter.java` | cross-cutting | Identical pattern to student-service's — reads `X-Authenticated-User`, defaults to anonymous, enforces nothing itself. |
| `service/CourseService.java` / `CourseCategoryService.java` / `CourseScheduleService.java` / `CourseFacultyService.java` | business | Same CRUD-with-`ResourceNotFoundException` shape throughout. |
| `application.properties` | configuration | Port `8082`; `CourseDB` connection; consumer group `course-service-group`; topics `enrollment-requested` / `course-validation-result`. |

### 6.4 `enrollment-service` (port 8083) — the saga orchestrator/hub

Package root: `com.studentmgmt.enrollment`. This is the most architecturally significant service — it both serves REST CRUD for enrollments/payments **and** drives the entire Kafka choreography saga.

| File | Layer | Purpose |
|---|---|---|
| `EnrollmentServiceApplication.java` | bootstrap | Entry point. |
| `controller/EnrollmentController.java` | presentation | `/api/enrollments` — `GET` (optional `?studentId=` or `?courseId=` filter), `GET /{id}`, `POST` (**returns `202 Accepted`**, not `201` — the created row is provisional, `PENDING_VALIDATION`, until the saga resolves it), `PUT /{id}`, `DELETE /{id}`. |
| `controller/EnrollmentStatusController.java` | presentation | `/api/enrollment-statuses` — read-only (`GET` all, `GET /{id}`); statuses (`PENDING_VALIDATION`, `CONFIRMED`, `REJECTED`, `COMPLETED`, `CANCELLED`) are seed/reference data, not something clients create. |
| `controller/PaymentController.java` | presentation | `/api/payments` — `GET` (optional `?enrollmentId=`), `GET /{id}`, `POST`, `PUT /{id}/mark-success` (a targeted state-transition endpoint rather than a generic `PUT` full-update). |
| `controller/WhoAmIController.java` | presentation | `GET /api/enrollments/me` — identical pattern. |
| `entity/Enrollment.java` | data | Maps `Enrollments`. `studentId`/`courseId` are **plain `Long`s, not JPA `@ManyToOne`** — deliberately, since the referenced rows live in different microservices' databases; a JPA relationship annotation would imply a same-database foreign key that cannot exist here. `statusId`, `enrollmentDate`, `completionDate`, `rejectionReason`. |
| `entity/EnrollmentStatus.java` | data | Maps `Enrollment_Status`: `statusName` (unique — `PENDING_VALIDATION`/`CONFIRMED`/`REJECTED`/`COMPLETED`/`CANCELLED`), `description`. |
| `entity/EnrollmentValidation.java` | data | Maps `Enrollment_Validation`. **The saga's state-tracking entity.** PK is literally the `enrollmentId` (1:1 child of `Enrollment`, no separate auto-increment id). Tracks `studentValid`/`studentReason`/`studentCheckedAt` and `courseValid`/`courseReason`/`courseCheckedAt`, each `NULL` until that side's Kafka reply arrives. Exposes two convenience predicates: `isResolved()` (both non-null) and `isFullyValid()` (both `TRUE`). |
| `entity/Payment.java` | data | Maps `Payments`: `enrollmentId` (FK, same schema), `amount`, `paymentMethod`, `paymentStatus`, `transactionRef`, `paymentDate`. |
| `event/EnrollmentRequestedEvent.java` | data (messaging) | The event **this service publishes** to kick the saga off: `{enrollmentId, studentId, courseId, requestedAt}`. |
| `event/ValidationResultEvent.java` | data (messaging) | The shape this service *consumes* from both `student.validation.result` and `course.validation.result` (same JSON shape, different topics/source values). |
| `event/EnrollmentOutcomeEvent.java` | data (messaging) | The event this service publishes once the saga resolves: `{enrollmentId, studentId, courseId, status, reason, occurredAt}`, sent to either `enrollment.confirmed` or `enrollment.rejected`. |
| `exception/GlobalExceptionHandler.java` / `ResourceNotFoundException.java` | cross-cutting | Same pattern as the other services. |
| `kafka/EnrollmentRequestedProducer.java` | messaging | Publishes `EnrollmentRequestedEvent` to `enrollment.requested`, keyed by `enrollmentId`. Called once, from `EnrollmentService.create()`. |
| `kafka/StudentValidationResultListener.java` | messaging | `@KafkaListener(topics = student.validation.result)` → deserializes → calls `EnrollmentSagaService.applyStudentValidationResult(enrollmentId, valid, reason)`. |
| `kafka/CourseValidationResultListener.java` | messaging | Same shape, for `course.validation.result` → `applyCourseValidationResult(...)`. |
| `kafka/EnrollmentOutcomeProducer.java` | messaging | Exposes `publishConfirmed(event)` / `publishRejected(event)`, both routing through one private `publish(topic, event)` method — publishes to `enrollment.confirmed` or `enrollment.rejected` respectively. |
| `repository/EnrollmentRepository.java` | persistence | Adds `findByStudentId(Long)`, `findByCourseId(Long)`. |
| `repository/EnrollmentStatusRepository.java` | persistence | Adds `findByStatusName(String)` — used to look up the id for `"PENDING_VALIDATION"`, `"CONFIRMED"`, `"REJECTED"` by name instead of hardcoding numeric ids. |
| `repository/EnrollmentValidationRepository.java` | persistence | The one repository in the whole project with **hand-written bulk `@Modifying @Query` JPQL updates** (`updateStudentResult`, `updateCourseResult`) instead of relying on `save()`. The extended in-code comment explains why: two Kafka listener threads (student-result and course-result) can arrive at nearly the same instant; a naive `findById().setX().save()` would issue a full-row `UPDATE` including *every* column, so whichever thread's `save()` commits last would silently overwrite the other thread's already-written column back toward stale/null values (a classic **lost update**). A bulk `UPDATE ... SET studentValid = ... WHERE enrollmentId = ...` touches only the three columns named in that specific query, so the two threads can never clobber each other regardless of timing or interleaving. |
| `repository/PaymentRepository.java` | persistence | Adds `findByEnrollmentId(Long)`. |
| `security/AuthenticatedUserFilter.java` | cross-cutting | Identical pattern. |
| `service/EnrollmentService.java` | business | `create()` is the **saga's entry point**: sets `statusId` to `PENDING_VALIDATION`'s id, defaults `enrollmentDate` to today if omitted, saves the `Enrollment`, saves a fresh (both-null) `EnrollmentValidation` row, and publishes `EnrollmentRequestedEvent` — all wrapped in one `@Transactional` method. Also holds ordinary `findAll`/`findById`/`update`/`delete`. |
| `service/EnrollmentSagaService.java` | business (saga logic) | The heart of the saga. `applyStudentValidationResult` / `applyCourseValidationResult` each do the bulk update, re-read the (now possibly-still-partial) `EnrollmentValidation` row, and call `resolveIfComplete()`. `resolveIfComplete()` checks `isResolved()`; if not yet, logs and returns (this is the "first thread to arrive" case — no-op). If resolved, it computes `CONFIRMED`/`REJECTED` via `isFullyValid()`, looks up the matching `EnrollmentStatus` id, updates and saves the `Enrollment`, builds an `EnrollmentOutcomeEvent`, and publishes it via `EnrollmentOutcomeProducer`. `combineReasons()` concatenates the student/course rejection reasons with `"; "` when both failed. |
| `service/EnrollmentStatusService.java` | business | `findAll`, `findById`, and `findByStatusName` (used internally by both `EnrollmentService` and `EnrollmentSagaService` — throws `ResourceNotFoundException` with an explicit "seed row is missing" message if, e.g., someone deleted the `CONFIRMED` row from `Enrollment_Status`). |
| `service/PaymentService.java` | business | Plain CRUD — `create`, `findAll`, `findById`, `markSuccess` (sets `paymentStatus = "Success"`). The in-code comment notes this is deliberately **not** wired to trigger any synchronous or asynchronous notification — a successful payment does not, in this version, publish any Kafka event; only the enrollment outcome (confirmed/rejected) does. |
| `application.properties` | configuration | Port `8083`; `EnrollmentDB` connection; consumer group `enrollment-service-group`; **five** topic properties (this is the only service wired to both produce and consume multiple different topics: `enrollment-requested` produced, `student-validation-result` and `course-validation-result` consumed, `enrollment-confirmed` and `enrollment-rejected` produced). |

### 6.5 `notification-service` (port 8084) — terminal consumer

Package root: `com.studentmgmt.notification`. The simplest service in terms of business logic — it only reacts, it never initiates.

| File | Layer | Purpose |
|---|---|---|
| `NotificationServiceApplication.java` | bootstrap | Entry point. |
| `controller/NotificationController.java` | presentation | `/api/notifications` — `GET` (optional `?recipientId=` or `?enrollmentId=`), `GET /{id}`, `POST`, `PUT /{id}`, `DELETE /{id}`. Exists mainly so notification rows written by the Kafka consumer can be inspected/managed via REST too, and so a client could in principle also write a notification directly (though the real flow never does). |
| `controller/EmailLogController.java` | presentation | `/api/email-logs` — `GET` (optional `?notificationId=`), `GET /{id}`, `POST` (no update/delete — logs are append-only). |
| `controller/SmsLogController.java` | presentation | `/api/sms-logs` — same shape as `EmailLogController`. |
| `controller/WhoAmIController.java` | presentation | `GET /api/notifications/me` — identical pattern. |
| `entity/Notification.java` | data | Maps `Notifications`: `enrollmentId` (nullable — a notification need not always tie back to an enrollment), `recipientId`, `recipientType` (`"STUDENT"`), `eventType` (`ENROLLMENT_CONFIRMED`/`ENROLLMENT_REJECTED`), `channel` (`EMAIL`/`SMS`), `subject`, `message`, `status` (`SENT`/`PENDING`/`FAILED`), `createdAt` (DB-managed), `sentAt`. |
| `entity/EmailLog.java` | data | Maps `Email_Logs`: `notificationId` (FK), `toEmail`, `subject`, `body`, `status`, `sentAt`, `errorMessage`. |
| `entity/SmsLog.java` | data | Maps `SMS_Logs`: `notificationId` (FK), `toPhone`, `message`, `status`, `sentAt`, `errorMessage`. |
| `event/EnrollmentOutcomeEvent.java` | data (messaging) | This service's own copy of the shape published by `enrollment-service` — `{enrollmentId, studentId, courseId, status, reason, occurredAt}`. The `status` field (`"CONFIRMED"`/`"REJECTED"`) is what actually distinguishes the two cases in code, even though they also arrive on two differently-named topics. |
| `exception/GlobalExceptionHandler.java` / `ResourceNotFoundException.java` | cross-cutting | Same pattern as the other three services. |
| `kafka/EnrollmentOutcomeListener.java` | messaging | `@KafkaListener(topics = {enrollment.confirmed, enrollment.rejected})` — a **single listener method subscribed to two topics at once**. Deserializes, delegates to `EnrollmentOutcomeService.handle(event)`. This is the saga's terminal step; nothing downstream reacts to what this service does. |
| `repository/NotificationRepository.java` | persistence | Adds `findByRecipientId(Long)`, `findByEnrollmentId(Long)`. |
| `repository/EmailLogRepository.java` | persistence | Adds `findByNotificationId(Long)`. |
| `repository/SmsLogRepository.java` | persistence | Adds `findByNotificationId(Long)`. |
| `security/AuthenticatedUserFilter.java` | cross-cutting | Identical pattern to the other three services. |
| `service/EnrollmentOutcomeService.java` | business | `handle(event)`: builds a synthetic placeholder email (`"student" + studentId + "@example.com"` — there's no real email address lookup back to `StudentDB`, which this service isn't allowed to query directly anyway), always writes an email `Notification` + `EmailLog` row, and — **only if the outcome was `CONFIRMED`** — additionally writes an SMS `Notification` + `SmsLog` row. Both are hardcoded straight to `status = "SENT"` with no real mail/SMS gateway integration (explicitly out of scope, matching the synchronous/OpenFeign sibling project's same simplification). |
| `service/NotificationService.java` | business | Standard CRUD for `Notification` rows directly via REST (independent of the Kafka-driven path). |
| `service/EmailLogService.java` / `SmsLogService.java` | business | `findAll` (optionally filtered by `notificationId`), `findById`, `create` — no update/delete, matching the controllers. |
| `application.properties` | configuration | Port `8084`; `NotificationDB` connection; consumer group `notification-service-group`; topics `enrollment-confirmed` / `enrollment-rejected` (consumed only — this service produces no Kafka events at all). |

---

## 7. Complete Endpoint Inventory

All paths below are reached by clients through the gateway at `http://localhost:8080`, with the sole exception of `POST /auth/login`, which *is* the gateway endpoint. Every routed path requires header `Authorization: Bearer <jwt>` except `/auth/login` itself.

### 7.1 api-gateway (local, not proxied)

| Method | Path | Auth Required? | Request Body | Response |
|---|---|---|---|---|
| `POST` | `/auth/login` | No | `{username, password}` | `200 {token, tokenType}` or `401` plain-text error |

### 7.2 student-service (routed via `/api/students/**`, `/api/student-addresses/**`, `/api/student-documents/**`, `/api/student-logins/**`)

| Method | Path | Body | Response | Notes |
|---|---|---|---|---|
| `GET` | `/api/students` | — | `200 [Student]` | all students |
| `GET` | `/api/students/{id}` | — | `200 Student` / `404` | |
| `GET` | `/api/students/me` | — | `200 {authenticatedUser}` | reads gateway-injected identity |
| `GET` | `/api/students/{id}/exists` | — | `200 {exists: boolean}` | debug-only |
| `POST` | `/api/students` | `Student` (no id) | `201 Student` | |
| `PUT` | `/api/students/{id}` | `Student` | `200 Student` / `404` | |
| `DELETE` | `/api/students/{id}` | — | `204` / `404` | |
| `GET` | `/api/student-addresses?studentId=` | — | `200 [StudentAddress]` | filter optional |
| `GET` | `/api/student-addresses/{id}` | — | `200 StudentAddress` / `404` | |
| `POST` | `/api/student-addresses` | `StudentAddress` | `201 StudentAddress` | |
| `PUT` | `/api/student-addresses/{id}` | `StudentAddress` | `200 StudentAddress` / `404` | |
| `DELETE` | `/api/student-addresses/{id}` | — | `204` / `404` | |
| `GET` | `/api/student-documents?studentId=` | — | `200 [StudentDocument]` | filter optional |
| `GET` | `/api/student-documents/{id}` | — | `200 StudentDocument` / `404` | |
| `POST` | `/api/student-documents` | `StudentDocument` | `201 StudentDocument` | |
| `DELETE` | `/api/student-documents/{id}` | — | `204` / `404` | no `PUT` |
| `GET` | `/api/student-logins?studentId=` | — | `200 [StudentLogin]` | password hash never serialized |
| `GET` | `/api/student-logins/{id}` | — | `200 StudentLogin` / `404` | |
| `POST` | `/api/student-logins/verify` | `{username, password}` | `200 {valid, studentId, username}` | called by the **gateway only**; always 200 |
| `POST` | `/api/student-logins` | `StudentLogin` | `201 StudentLogin` | |
| `PUT` | `/api/student-logins/{id}` | `StudentLogin` | `200 StudentLogin` / `404` | |
| `DELETE` | `/api/student-logins/{id}` | — | `204` / `404` | |

### 7.3 course-service (routed via `/api/courses/**`, `/api/course-categories/**`, `/api/course-schedules/**`, `/api/course-faculty/**`)

| Method | Path | Body | Response | Notes |
|---|---|---|---|---|
| `GET` | `/api/courses?categoryId=` | — | `200 [Course]` | filter optional |
| `GET` | `/api/courses/{id}` | — | `200 Course` / `404` | |
| `GET` | `/api/courses/me` | — | `200 {authenticatedUser}` | |
| `GET` | `/api/courses/{id}/exists` | — | `200 {exists: boolean}` | debug-only |
| `POST` | `/api/courses` | `Course` | `201 Course` | |
| `PUT` | `/api/courses/{id}` | `Course` | `200 Course` / `404` | |
| `DELETE` | `/api/courses/{id}` | — | `204` / `404` | |
| `GET` | `/api/course-categories` | — | `200 [CourseCategory]` | |
| `GET` | `/api/course-categories/{id}` | — | `200 CourseCategory` / `404` | |
| `POST` | `/api/course-categories` | `CourseCategory` | `201 CourseCategory` | |
| `PUT` | `/api/course-categories/{id}` | `CourseCategory` | `200 CourseCategory` / `404` | |
| `DELETE` | `/api/course-categories/{id}` | — | `204` / `404` | |
| `GET` | `/api/course-schedules?courseId=` | — | `200 [CourseSchedule]` | filter optional |
| `GET` | `/api/course-schedules/{id}` | — | `200 CourseSchedule` / `404` | |
| `POST` | `/api/course-schedules` | `CourseSchedule` | `201 CourseSchedule` | |
| `DELETE` | `/api/course-schedules/{id}` | — | `204` / `404` | no `PUT` |
| `GET` | `/api/course-faculty?courseId=` | — | `200 [CourseFaculty]` | filter optional |
| `GET` | `/api/course-faculty/{id}` | — | `200 CourseFaculty` / `404` | |
| `POST` | `/api/course-faculty` | `CourseFaculty` | `201 CourseFaculty` | |
| `DELETE` | `/api/course-faculty/{id}` | — | `204` / `404` | no `PUT` |

### 7.4 enrollment-service (routed via `/api/enrollments/**`, `/api/enrollment-statuses/**`, `/api/payments/**`)

| Method | Path | Body | Response | Notes |
|---|---|---|---|---|
| `GET` | `/api/enrollments?studentId=&courseId=` | — | `200 [Enrollment]` | at most one filter honored (studentId checked first) |
| `GET` | `/api/enrollments/{id}` | — | `200 Enrollment` / `404` | poll this to observe saga resolution |
| `GET` | `/api/enrollments/me` | — | `200 {authenticatedUser}` | |
| `POST` | `/api/enrollments` | `{studentId, courseId}` | **`202 Accepted` Enrollment** (status `PENDING_VALIDATION`) | triggers the saga; not `201` |
| `PUT` | `/api/enrollments/{id}` | `Enrollment` | `200 Enrollment` / `404` | direct manual override, bypasses saga |
| `DELETE` | `/api/enrollments/{id}` | — | `204` / `404` | |
| `GET` | `/api/enrollment-statuses` | — | `200 [EnrollmentStatus]` | reference data, read-only |
| `GET` | `/api/enrollment-statuses/{id}` | — | `200 EnrollmentStatus` / `404` | |
| `GET` | `/api/payments?enrollmentId=` | — | `200 [Payment]` | filter optional |
| `GET` | `/api/payments/{id}` | — | `200 Payment` / `404` | |
| `POST` | `/api/payments` | `Payment` | `201 Payment` | independent of the saga |
| `PUT` | `/api/payments/{id}/mark-success` | — | `200 Payment` | targeted state transition |

### 7.5 notification-service (routed via `/api/notifications/**`, `/api/email-logs/**`, `/api/sms-logs/**`)

| Method | Path | Body | Response | Notes |
|---|---|---|---|---|
| `GET` | `/api/notifications?recipientId=&enrollmentId=` | — | `200 [Notification]` | at most one filter honored |
| `GET` | `/api/notifications/{id}` | — | `200 Notification` / `404` | |
| `GET` | `/api/notifications/me` | — | `200 {authenticatedUser}` | |
| `POST` | `/api/notifications` | `Notification` | `201 Notification` | manual path; real flow is Kafka-driven |
| `PUT` | `/api/notifications/{id}` | `Notification` | `200 Notification` / `404` | |
| `DELETE` | `/api/notifications/{id}` | — | `204` / `404` | |
| `GET` | `/api/email-logs?notificationId=` | — | `200 [EmailLog]` | filter optional |
| `GET` | `/api/email-logs/{id}` | — | `200 EmailLog` / `404` | |
| `POST` | `/api/email-logs` | `EmailLog` | `201 EmailLog` | no update/delete |
| `GET` | `/api/sms-logs?notificationId=` | — | `200 [SmsLog]` | filter optional |
| `GET` | `/api/sms-logs/{id}` | — | `200 SmsLog` / `404` | |
| `POST` | `/api/sms-logs` | `SmsLog` | `201 SmsLog` | no update/delete |

**Total: 1 auth endpoint + 57 REST endpoints across the four backend services** (21 in student-service, 20 in course-service, 12 in enrollment-service, 12 in notification-service — counts include the `/me` diagnostics and the debug `exists` endpoints).

---

## 8. Endpoint-by-Endpoint Flow Explanations

This section walks through *how a request actually moves through the system*, class by class, for every representative endpoint category. Endpoints that share an identical shape (plain CRUD) are grouped; endpoints with unique behavior (login, enrollment creation, `/me`) get their own full walkthrough.

### 8.1 `POST /auth/login` — the only endpoint that mints a token

1. Client sends `POST http://localhost:8080/auth/login` with `{"username": "aarav.sharma", "password": "hash_9f2b1c0a"}` and no `Authorization` header (none needed yet).
2. Spring Cloud Gateway's routing layer checks this path against the four `Path=` predicates in `application.yml` — **none match** (`/auth/**` isn't one of the routed prefixes), so this request is **not** forwarded anywhere; it's handled by the gateway's own embedded WebFlux dispatcher, which finds `AuthController.login(...)` because that's a plain `@RestController` bean living inside the same Spring context.
3. Because no route matched, the request never enters a `GatewayFilterChain`, so `GatewayAuthFilter` (a `GlobalFilter`, only invoked *within* that chain) never runs for this call — no token is required to hit `/auth/login`, by construction, not because of an explicit path-skip check (though `GatewayAuthFilter` also happens to contain a redundant `path.startsWith("/auth/")` early-return, as defense in depth).
4. `AuthController.login()` calls `studentLoginClient.verify(username, password)`.
5. `StudentLoginClient` issues `POST http://localhost:8081/api/student-logins/verify` (base URL from `services.student.url`) with `{username, password}`, via the reactive `WebClient` — this is a real outbound HTTP call, the only synchronous cross-service call in the whole system.
6. On `student-service`, `StudentLoginController.verify()` calls `StudentLoginService.verifyCredentials(username, password)`, which queries `StudentLoginRepository.findByUsername(username)`, filters for `active == true`, and compares `passwordHash.equals(password)` (plaintext-equals in this demo, not a real hash-and-compare).
7. `student-service` responds `200 OK` with `VerifyCredentialsResponse` — `{valid: true, studentId: 1, username: "aarav.sharma"}` on success, or `{valid: false}` on any failure (unknown user, wrong password, inactive account) — **always HTTP 200**, never a 401, so the gateway's reactive pipeline doesn't have to branch on HTTP status, just on the `valid` field.
8. Back in `AuthController`, the `Mono` chain inspects `result.isValid()`. If false: responds `401` with a plain string body `"Invalid username/password, or account inactive"`. If true: calls `jwtUtil.generateToken(result.getUsername())`.
9. `JwtUtil.generateToken()` builds a JWT with `subject = username`, `issuedAt = now`, `expiration = now + 1 hour`, signed with the gateway's private HMAC secret (`app.jwt.secret`), and compacts it to the three-part `header.payload.signature` string.
10. `AuthController` responds `200 OK` with `LoginResponse {token: "<jwt>", tokenType: "Bearer"}`.
11. The client stores this token and attaches it as `Authorization: Bearer <jwt>` on every subsequent request to any routed path.

### 8.2 Any routed GET/POST/PUT/DELETE to a backend service — the general authenticated-proxy flow

Example: `GET /api/students/1` with `Authorization: Bearer <jwt>`.

1. Client sends the request to `http://localhost:8080/api/students/1`.
2. Spring Cloud Gateway's routing predicate matches `Path=/api/students/**` → route id `student-service`, target `http://localhost:8081`.
3. Because a route matched, the request now flows through a `GatewayFilterChain`, which includes every registered `GlobalFilter` — including `GatewayAuthFilter` (order `-1`, so it runs early, before the actual proxying filter forwards the request).
4. `GatewayAuthFilter.filter()`: path doesn't start with `/auth/`, so it proceeds to check `Authorization`. If missing or not `Bearer `-prefixed → writes `401 {"status":401,"error":"Unauthorized","message":"Missing Authorization: Bearer <token> header"}` directly to the response and **returns without calling `chain.filter(exchange)`** — the request dies here, `student-service` is never contacted.
5. If present, `jwtUtil.isValid(token)` parses and signature/expiry-checks the JWT using the same secret that signed it. If invalid/expired → `401 {"message":"Invalid or expired token"}`, again without forwarding.
6. If valid, `jwtUtil.extractUsername(token)` pulls the `subject` claim, and the filter **mutates the request** to add header `X-Authenticated-User: <username>` before calling `chain.filter(...)` with the mutated exchange.
7. Spring Cloud Gateway's routing filter now actually proxies the (mutated) request to `http://localhost:8081/api/students/1`, preserving the path as-is (no rewrite rule configured).
8. On `student-service`, the request first passes through the servlet filter chain, including `AuthenticatedUserFilter` (a `OncePerRequestFilter`, runs before any `@RestController`). It reads `X-Authenticated-User` off the request and stores it as a request attribute — but does **not** reject the request even if the header is missing; it just falls back to `"anonymous"`.
9. `StudentController.findById(1)` runs, calling `StudentService.findById(1)` → `StudentRepository.findById(1)` (a generated Spring Data JPA query, `SELECT * FROM Students WHERE student_id = 1`). Found → returns the `Student` entity; Spring's Jackson message converter serializes it to JSON. Not found → `StudentService` throws `ResourceNotFoundException`, caught by `GlobalExceptionHandler.handleNotFound()`, converted to a `404` with the standard `{timestamp, status, error, message}` body.
10. The JSON response flows back through the gateway (Spring Cloud Gateway forwards backend responses through unmodified, no filter here rewrites response bodies) to the client.

Every other plain CRUD endpoint in every service (courses, addresses, documents, notifications, logs, payments, statuses) follows this exact 10-step shape — steps 1–8 are always identical (routing → auth filter → header injection → proxy → identity filter); only step 9 differs (which controller/service/repository trio actually executes, and what validation/exception rules apply to that resource).

### 8.3 `POST /api/students`, `POST /api/courses`, etc. — validated creates

Same flow as §8.2 through step 8. At step 9, the controller method is annotated `@Valid @RequestBody`, so Spring runs Jakarta Bean Validation against the incoming JSON *before* the controller body executes — e.g. `Student.email` is `@NotBlank @Email`, `Student.firstName`/`lastName` are `@NotBlank @Size(max=50)`. A validation failure throws `MethodArgumentNotValidException`, caught by `GlobalExceptionHandler.handleValidation()`, which joins every field error into one message string and responds `400`. If validation passes, the service's `create()` method calls `repository.save(entity)` (an `INSERT`, since the entity's id is null) and the controller returns `201 Created` (`@ResponseStatus(HttpStatus.CREATED)`) with the persisted entity, now including its generated id and any DB-managed timestamp columns.

### 8.4 `GET /api/students/{id}/exists`, `GET /api/courses/{id}/exists` — the debug-only existence checks

Flow identical to §8.2 through step 8. At step 9, `StudentService.existsById(id)` / `CourseService.existsById(id)` call `repository.existsById(id)` (a lightweight `SELECT COUNT(*)`-style query, not a full row fetch), and the controller wraps the boolean in `Map.of("exists", ...)`. The code comments on both controllers are explicit that these exist purely for manual inspection/debugging — the actual enrollment saga **never calls these HTTP endpoints**; it checks existence via the asynchronous Kafka path described in §8.6, which is the whole reason these two endpoints feel slightly redundant if you've already read the saga code.

### 8.5 `GET /api/*/me` (WhoAmI, one per backend service)

Flow identical to §8.2 through step 8. At step 9, the controller doesn't touch any repository at all — it reads `request.getAttribute(AuthenticatedUserFilter.ATTRIBUTE_NAME)`, which `AuthenticatedUserFilter` already populated in step 8, and returns `{"authenticatedUser": "<username>"}` (or `"anonymous"` if the gateway's header was somehow absent — which would only happen if this endpoint were hit by bypassing the gateway directly on the service's own port). This endpoint exists specifically to let a human or a test **prove** that the centralized-auth header injection is actually working end-to-end, without needing to add any logging or debugger breakpoints.

### 8.6 `POST /api/enrollments` — the saga-triggering endpoint (full detail; see §10.2 for the complete sequence diagram)

Flow identical to §8.2 through step 8 (routed via `/api/enrollments/**`, gateway validates the token, injects `X-Authenticated-User`, forwards to `enrollment-service:8083`). At step 9:

1. `EnrollmentController.create(enrollment)` — body validated (`@NotNull studentId`, `@NotNull courseId`; `statusId` is deliberately *not* `@NotNull`, since the caller never supplies it) — calls `EnrollmentService.create(enrollment)`.
2. Inside one `@Transactional` method: looks up the `PENDING_VALIDATION` status id via `EnrollmentStatusService.findByStatusName(...)`, defaults `enrollmentDate` to today if the caller didn't supply one, and calls `enrollmentRepository.save(enrollment)` — this `INSERT`s into `Enrollments` and generates `enrollmentId`.
3. Immediately saves a fresh `EnrollmentValidation(enrollmentId)` row (both validation columns `NULL`).
4. Calls `enrollmentRequestedProducer.publish(new EnrollmentRequestedEvent(enrollmentId, studentId, courseId, now))`, which serializes to JSON and sends to Kafka topic `enrollment.requested`, keyed by `enrollmentId`.
5. The `@Transactional` method returns; the transaction commits (both the `Enrollments` row and the `Enrollment_Validation` row are now durable). Note: the Kafka publish call itself is **not** part of the JDBC transaction (there is no outbox pattern or JTA here) — it's a best-effort send that happens to be issued from within the same method, which is a simplification worth being aware of (see §13).
6. `EnrollmentController` returns `202 Accepted` with the `Enrollment` object as it exists right now — `status = PENDING_VALIDATION`. The HTTP request is now **complete**; the client has no open connection waiting on the saga.
7. Independently, `student-service`'s `EnrollmentRequestedListener` and `course-service`'s `EnrollmentRequestedListener` (in different consumer groups, so Kafka delivers a copy of the message to each) each receive `enrollment.requested` and reply on their own result topic (see §10.2 for full detail).
8. Independently, `enrollment-service`'s `StudentValidationResultListener` / `CourseValidationResultListener` receive those replies, and `EnrollmentSagaService` resolves the saga once both have arrived, updating `Enrollments.status_id` to `CONFIRMED` or `REJECTED` and publishing the matching outcome event.
9. The client discovers the outcome by **polling** `GET /api/enrollments/{id}` (§8.2's plain-read flow) until `statusId` stops being `PENDING_VALIDATION`'s id — there is no webhook/callback/long-poll mechanism back to the original caller; this is a deliberate simplification of the "how does the client learn the async result" problem.

### 8.7 `PUT /api/payments/{id}/mark-success`

Flow identical to §8.2 through step 8 (routed via `/api/payments/**`). At step 9, `PaymentController.markSuccess(id)` calls `PaymentService.markSuccess(id)`, which loads the `Payment` (404 if missing), sets `paymentStatus = "Success"`, and saves — a **partial update via a dedicated endpoint** rather than requiring the client to `PUT` the entire `Payment` object back. Nothing downstream reacts to this — no Kafka event is published, as called out explicitly in `PaymentService`'s class comment; this is intentionally a leaf/dead-end operation in the current design.

### 8.8 Kafka-triggered "endpoints" (not HTTP, but functionally equivalent entry points)

These aren't REST endpoints, but they are the **messaging-layer equivalent** of an endpoint — each is an entry point that starts a unit of work in response to an external signal, just delivered via a Kafka topic instead of an HTTP verb+path:

| "Endpoint" (Kafka topic + consumer) | Triggering Producer | What Runs |
|---|---|---|
| `enrollment.requested` → `student-service.EnrollmentRequestedListener` | `enrollment-service` | `studentRepository.existsById()`, publish to `student.validation.result` |
| `enrollment.requested` → `course-service.EnrollmentRequestedListener` | `enrollment-service` | `courseRepository.existsById()`, publish to `course.validation.result` |
| `student.validation.result` → `enrollment-service.StudentValidationResultListener` | `student-service` | `EnrollmentSagaService.applyStudentValidationResult()` |
| `course.validation.result` → `enrollment-service.CourseValidationResultListener` | `course-service` | `EnrollmentSagaService.applyCourseValidationResult()` |
| `enrollment.confirmed` / `enrollment.rejected` → `notification-service.EnrollmentOutcomeListener` | `enrollment-service` | `EnrollmentOutcomeService.handle()` — writes notification/email/SMS rows |

---

## 9. Kafka Topics Reference

| Topic | Producer(s) | Consumer(s) | Payload Shape | Purpose |
|---|---|---|---|---|
| `enrollment.requested` | enrollment-service | student-service, course-service | `{enrollmentId, studentId, courseId, requestedAt}` | Fans out the saga trigger to both validators |
| `student.validation.result` | student-service | enrollment-service | `{enrollmentId, valid, reason, source="student-service", checkedAt}` | Student-side validation reply |
| `course.validation.result` | course-service | enrollment-service | `{enrollmentId, valid, reason, source="course-service", checkedAt}` | Course-side validation reply |
| `enrollment.confirmed` | enrollment-service | notification-service | `{enrollmentId, studentId, courseId, status="CONFIRMED", reason=null, occurredAt}` | Saga succeeded |
| `enrollment.rejected` | enrollment-service | notification-service | `{enrollmentId, studentId, courseId, status="REJECTED", reason, occurredAt}` | Saga failed validation |

All messages are **String-keyed by `enrollmentId`** and String-valued JSON (via Jackson `ObjectMapper`, not Avro/Schema Registry — no schema enforcement beyond "the consumer's Java class happens to have matching field names"). Keying by `enrollmentId` guarantees Kafka routes every message about the same enrollment to the same partition, which preserves per-enrollment ordering even though the topic overall may have multiple partitions. Each service's consumer group id (`student-service-group`, `course-service-group`, `enrollment-service-group`, `notification-service-group`) is distinct, which is precisely what allows `enrollment.requested` to be delivered to *both* `student-service` and `course-service` independently — Kafka delivers one copy of each message per distinct consumer group, not per consumer instance.

---

## 10. End-to-End System Flows

### 10.1 Full Authentication Lifecycle (Login → Authenticated Call → Rejection Case)

```
CLIENT                 API-GATEWAY (8080)              STUDENT-SERVICE (8081)
  │                          │                                  │
  │  POST /auth/login        │                                  │
  │  {username,password}     │                                  │
  ├─────────────────────────▶│                                  │
  │                          │  no route matches /auth/**        │
  │                          │  → AuthController (local)         │
  │                          │  POST /api/student-logins/verify  │
  │                          ├───────────────────────────────────▶│
  │                          │                                  │ StudentLoginService
  │                          │                                  │ .verifyCredentials()
  │                          │  200 {valid:true, studentId, ..} │
  │                          │◀───────────────────────────────────┤
  │                          │  JwtUtil.generateToken(username)  │
  │  200 {token, tokenType}  │                                  │
  │◀─────────────────────────┤                                  │
  │                          │                                  │
  │  GET /api/students/1     │                                  │
  │  Authorization: Bearer T │                                  │
  ├─────────────────────────▶│                                  │
  │                          │  route matches /api/students/**   │
  │                          │  GatewayAuthFilter:                │
  │                          │    JwtUtil.isValid(T) → true       │
  │                          │    inject X-Authenticated-User     │
  │                          │  proxy GET /api/students/1         │
  │                          ├───────────────────────────────────▶│
  │                          │                                  │ AuthenticatedUserFilter
  │                          │                                  │ reads X-Authenticated-User
  │                          │                                  │ StudentController.findById(1)
  │                          │  200 Student{...}                │
  │                          │◀───────────────────────────────────┤
  │  200 Student{...}        │                                  │
  │◀─────────────────────────┤                                  │
  │                          │                                  │
  │  GET /api/students/1     │                                  │
  │  (no Authorization hdr)  │                                  │
  ├─────────────────────────▶│                                  │
  │                          │  route matches, GatewayAuthFilter │
  │                          │  header missing → reject locally  │
  │  401 {"message":"Missing │  (student-service NEVER called)   │
  │   Authorization: Bearer  │                                  │
  │   <token> header"}       │                                  │
  │◀─────────────────────────┤                                  │
```

### 10.2 Full Enrollment Saga (Success Case: Student and Course Both Exist)

```
CLIENT      GATEWAY     ENROLLMENT-SVC          KAFKA                STUDENT-SVC   COURSE-SVC   NOTIFICATION-SVC
  │           │              │                    │                       │            │              │
  │POST       │              │                    │                       │            │              │
  │/api/      │              │                    │                       │            │              │
  │enrollments├─────────────▶│                    │                       │            │              │
  │           │(auth checked,│                    │                       │            │              │
  │           │ forwarded)   │                    │                       │            │              │
  │           │              │ INSERT Enrollments │                       │            │              │
  │           │              │  (PENDING_VALIDATION)                      │            │              │
  │           │              │ INSERT Enrollment_Validation (nulls)       │            │              │
  │           │              │ publish            │                       │            │              │
  │           │              │ enrollment.requested                       │            │              │
  │           │              ├───────────────────▶│                       │            │              │
  │  202      │              │                    │                       │            │              │
  │ Accepted  │◀─────────────┤                    │                       │            │              │
  │◀──────────┤              │                    │  fan-out (2 consumer groups)        │              │
  │(PENDING_  │              │                    ├──────────────────────▶│            │              │
  │VALIDATION)│              │                    ├───────────────────────────────────▶│              │
  │           │              │                    │                       │existsById()│existsById()  │
  │           │              │                    │                       │  = true    │  = true      │
  │           │              │                    │◀──────────────────────┤            │              │
  │           │              │                    │ student.validation.result           │              │
  │           │              │                    │◀───────────────────────────────────┤              │
  │           │              │                    │ course.validation.result            │              │
  │           │              │  student result    │                       │            │              │
  │           │              │◀───────────────────┤                       │            │              │
  │           │              │ bulk UPDATE          │                     │            │              │
  │           │              │  student_valid=true │                     │            │              │
  │           │              │ isResolved()=false  │                     │            │              │
  │           │              │  (course still null)│                     │            │              │
  │           │              │  course result      │                     │            │              │
  │           │              │◀───────────────────┤                       │            │              │
  │           │              │ bulk UPDATE          │                     │            │              │
  │           │              │  course_valid=true  │                     │            │              │
  │           │              │ isResolved()=true    │                     │            │              │
  │           │              │ isFullyValid()=true  │                     │            │              │
  │           │              │ UPDATE Enrollments   │                     │            │              │
  │           │              │  status=CONFIRMED    │                     │            │              │
  │           │              │ publish              │                     │            │              │
  │           │              │ enrollment.confirmed │                     │            │              │
  │           │              ├────────────────────▶│                     │            │              │
  │           │              │                     │                     │            │              │
  │           │              │                     │  enrollment.confirmed│            │              │
  │           │              │                     ├─────────────────────────────────────────────────▶│
  │           │              │                     │                     │            │  handle():     │
  │           │              │                     │                     │            │  INSERT        │
  │           │              │                     │                     │            │  Notification  │
  │           │              │                     │                     │            │  (EMAIL, SENT) │
  │           │              │                     │                     │            │  INSERT        │
  │           │              │                     │                     │            │  Notification  │
  │           │              │                     │                     │            │  (SMS, SENT)   │
  │           │              │                     │                     │            │                │
  │ GET /api/enrollments/{id} (client polls)                              │            │                │
  ├──────────────────────────▶│                    │                     │            │                │
  │200 Enrollment{status=CONFIRMED}                 │                     │            │                │
  │◀──────────────────────────┤                    │                     │            │                │
```

**Failure-case variant:** if either `existsById()` check comes back `false` (e.g. `courseId=9999` doesn't exist in `CourseDB`), that service still publishes to its result topic, just with `valid=false` and a `reason` string like `"Course 9999 does not exist in CourseDB"`. `EnrollmentSagaService.resolveIfComplete()` still waits for **both** replies before acting (it never resolves early just because one side already failed — this is a deliberate simplicity trade-off, not an optimization for fast-fail), then computes `isFullyValid() = false`, sets `Enrollments.status_id = REJECTED`, sets `rejectionReason` to the combined reason string(s) from whichever side(s) failed, and publishes to `enrollment.rejected` instead of `enrollment.confirmed`. `notification-service` still fires — it writes only the rejection **email** (no SMS), with the subject "Enrollment Rejected" and a message that includes the concrete reason.

### 10.3 Direct-Access Bypass (What Happens If a Client Skips the Gateway)

Because every backend service also has its own open port (8081–8084) and no Spring Security filter chain of its own that requires authentication, nothing stops a client with network access from calling `http://localhost:8081/api/students/1` directly, skipping `api-gateway:8080` entirely. In that case:

1. `AuthenticatedUserFilter` reads `X-Authenticated-User` — it's absent (nothing injected it), so it defaults to `"anonymous"`.
2. `StudentController.findById(1)` runs exactly as it would for an authenticated caller — the request succeeds, returning the student's data.
3. `GET /api/students/me` would report `{"authenticatedUser": "anonymous"}`, which is the only externally visible symptom that the request bypassed the gateway.

This is called out explicitly in the code comments (`AuthenticatedUserFilter`: "this service enforces nothing itself, the gateway is the only checkpoint") and is a real architectural trade-off discussed further in §11 and §13 — in a production deployment, this would normally be closed off with network-level isolation (backend services only reachable from the gateway's subnet, not from the public internet).

---

## 11. Centralized Authentication — Deep Mechanics

**The core idea in one sentence:** a JWT is issued and verified in exactly one place (`api-gateway`), and every other service downstream trusts a plain HTTP header instead of ever parsing a token itself.

**Why this differs from typical "shared JWT secret" designs:** many microservice systems distribute the *same* signing secret to every service, and each service independently validates incoming JWTs using that shared secret — meaning the secret must be provisioned to N services, rotated in N places, and any one of those N services becoming compromised leaks a secret that can forge tokens accepted by all of them. This project's sibling project (`SPRINGB-student-mgmt-async-CQRS-pattern-kafka`, a neighboring folder on disk) actually uses that shared-secret model. This project instead keeps the secret in exactly one process (`api-gateway`) and has the other four services trust that process's say-so via a header, which:

- Reduces the secret's blast radius to a single service.
- Means backend services have **zero JWT-parsing code or dependency** (no `jjwt` library in their `pom.xml`s at all — only `api-gateway` depends on it).
- Trades that security concentration for a **new trust assumption**: every backend service must be deployed such that it can *only* be reached through the gateway (network policy, firewall, service mesh, etc.), because if it can be reached directly, `X-Authenticated-User` can simply be forged by any caller who skips the gateway (see §10.3) — the header carries no cryptographic proof of its own once it leaves the gateway process.

**Trade-off, stated plainly:** this design is simpler to implement and reason about (one secret, one validation codepath, four "dumb" consumers of an already-validated identity) but it pushes a network-security requirement ("backend ports must be unreachable from outside the gateway") onto the deployment/infrastructure layer instead of enforcing it in code. The demo setup used for local development (everything on `localhost`, ports open) does not actually enforce that requirement, which is why §10.3's bypass is possible today, exactly as documented in the code's own comments.

---

## 12. Prerequisites — What Must Be Ready Before You Start

Before running any `mvn` or `docker` command, confirm every item below. Missing any one of these is the cause of nearly every "it won't start" problem with this project.

### 12.1 Required Software (Tooling)

| Tool | Why It's Needed | Minimum Version | Verify With |
|---|---|---|---|
| **JDK (Java Development Kit)** | All five modules target `java.version=21` in the parent `pom.xml`; the code will not compile on an older JDK | Java 21 | `java -version` |
| **Apache Maven** | Builds the multi-module reactor (`mvn clean install`) and runs each service (`mvn spring-boot:run`) | 3.9+ | `mvn -version` |
| **Docker + Docker Compose** | Runs the Kafka broker defined in `docker-compose.yml` (`apache/kafka:3.7.0`, KRaft mode) | Docker 24+, Compose v2 | `docker --version` and `docker compose version` |
| **MySQL Server** | Every backend service connects to a real MySQL instance on `localhost:3306` by default — **MySQL itself is not containerized in this project**, unlike Kafka | MySQL 8.x (matches `mysql-connector-j`) | `mysql --version` and `mysql -u root -p -e "SELECT VERSION();"` |
| **A REST client** | To call the API once it's up | Postman, Insomnia, or `curl` | — |

### 12.2 Required Configuration/Access

- **MySQL credentials** matching (or overriding) the defaults baked into every service's `application.properties`: username `abhig`, password `Pass@123`. If your local MySQL uses different credentials, you must override them via the `DB_USERNAME` and `DB_PASSWORD` environment variables for **every** backend service — they all read the same variable names.
- **`lower_case_table_names` in MySQL should be `0` (case-sensitive identifiers)** — every `application.properties` sets `spring.jpa.hibernate.naming.physical-strategy=...PhysicalNamingStrategyStandardImpl` specifically so Hibernate uses `@Table`/`@Column` names verbatim (e.g. `Students`, not `students`); this only lines up correctly with the SQL scripts' exact-case table names if MySQL itself is configured case-sensitively (the default on Linux, but not on Windows/macOS by default — worth checking with `SHOW VARIABLES LIKE 'lower_case_table_names';` if table-not-found errors appear).
- **Network access to `localhost` on the ports below** — nothing here needs internet access; everything runs on `localhost` by default.

### 12.3 Ports That Must Be Free

| Port | Used By | Check Command (Linux/macOS) |
|---|---|---|
| `3306` | MySQL server | `lsof -i :3306` or `sudo ss -ltnp \| grep 3306` |
| `9095` | Kafka broker (EXTERNAL listener — deliberately non-default to avoid clashing with an unrelated project on `9092` or a sibling Kafka project on `9094`) | `lsof -i :9095` |
| `8080` | api-gateway | `lsof -i :8080` |
| `8081` | student-service | `lsof -i :8081` |
| `8082` | course-service | `lsof -i :8082` |
| `8083` | enrollment-service | `lsof -i :8083` |
| `8084` | notification-service | `lsof -i :8084` |

If any port is already bound by something else, either stop that process or override the conflicting service's port/URL via its environment variables (every service's `application.properties`/`application.yml` reads `server.port` indirectly through Spring Boot's standard `SERVER_PORT` env var, and the gateway's four backend targets are separately overridable via `SERVICE_STUDENT_URL`, `SERVICE_COURSE_URL`, `SERVICE_ENROLLMENT_URL`, `SERVICE_NOTIFICATION_URL`).

### 12.4 Project Files That Must Be Present

- [ ] Root `pom.xml` (the five-module reactor)
- [ ] `docker-compose.yml` (the Kafka broker definition)
- [ ] `/sql/01_student_db.sql`, `02_course_db.sql`, `03_enrollment_db.sql`, `04_notification_db.sql`
- [ ] All five module directories with their `src/main/java` trees intact: `api-gateway`, `student-service`, `course-service`, `enrollment-service`, `notification-service`

### 12.5 Pre-Flight Checklist (tick every box before proceeding to §13)

- [ ] `java -version` reports Java 21
- [ ] `mvn -version` succeeds and shows a Maven 3.9+ / Java 21 pairing
- [ ] `docker --version` and `docker compose version` both succeed
- [ ] MySQL server is **installed and already running** (`sudo systemctl status mysql` on Linux, or equivalent) — Docker Compose in this project does **not** start MySQL for you
- [ ] You can log into MySQL with the credentials you intend to use: `mysql -u abhig -p`
- [ ] Ports `3306`, `9095`, `8080`–`8084` are all free (§12.3)
- [ ] You are in the project's root directory (the one containing `pom.xml` and `docker-compose.yml`)

Only once every box above is checked should you move on to §13.

---

## 13. Running the System — Step-by-Step Startup

### Step 1 — Start Kafka

```bash
docker compose up -d
```

This brings up the single KRaft-mode broker container (`async-gateway-student-mgmt-kafka`) and exposes it on `localhost:9095`. **Verify it's actually healthy** before moving on — the compose file defines a healthcheck, so:

```bash
docker compose ps
# STATUS column should read "healthy", not "starting" or "unhealthy"
```

If it's still `starting` after ~30 seconds, tail the logs: `docker compose logs -f kafka`.

### Step 2 — Provision the four MySQL databases

Run all four seed scripts, **in numeric order** (the enrollment and notification scripts reference student/course sample data implicitly through matching ids, though there's no cross-schema foreign key enforcing it):

```bash
mysql -u abhig -p < sql/01_student_db.sql
mysql -u abhig -p < sql/02_course_db.sql
mysql -u abhig -p < sql/03_enrollment_db.sql
mysql -u abhig -p < sql/04_notification_db.sql
```

Each script starts with `DROP DATABASE IF EXISTS ...`, so they're safe to re-run any time you want a clean slate. **Verify** all four databases exist and are populated:

```bash
mysql -u abhig -p -e "SHOW DATABASES LIKE '%DB%';"
mysql -u abhig -p -e "SELECT COUNT(*) FROM StudentDB.Students;"   # expect 5
```

### Step 3 — Build all five modules

From the project root (where the reactor `pom.xml` lives):

```bash
mvn clean install
```

This compiles `student-service`, `course-service`, `notification-service`, `enrollment-service`, and `api-gateway` in that dependency order (as declared in `<modules>`), and runs each module's tests. Use `mvn clean install -DskipTests` if you want to skip tests for a faster first run. **Verify** the build ended with `BUILD SUCCESS` for all five modules before continuing — starting services against a half-built reactor is the most common source of confusing `ClassNotFoundException`/`NoSuchBeanDefinitionException` errors.

### Step 4 — Start the four backend services (any order, each in its own terminal)

Kafka's `auto.create.topics.enable=true` means no service needs another to have already created a topic — they can start in any order relative to each other:

```bash
cd student-service      && mvn spring-boot:run    # port 8081
cd course-service       && mvn spring-boot:run    # port 8082
cd enrollment-service   && mvn spring-boot:run    # port 8083
cd notification-service && mvn spring-boot:run    # port 8084
```

**Verify each one** by watching its console log for the standard Spring Boot banner line, e.g.:

```
Started StudentServiceApplication in 3.412 seconds (process running for 3.812)
```

and confirm its port is actually listening:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8081/api/students   # expect 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8082/api/courses    # expect 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8083/api/enrollments # expect 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8084/api/notifications # expect 200
```

(These are direct hits to each service's own port, bypassing the gateway on purpose, just to confirm each service itself booted and can reach its database — see §10.3 for why this works with no auth header at all.)

### Step 5 — Start the API Gateway last

```bash
cd api-gateway && mvn spring-boot:run   # port 8080
```

Starting the gateway last (after `student-service` is confirmed up) isn't strictly required for the process to boot — the gateway will start regardless — but it **is** required for the login handshake to succeed on the very first request, since `AuthController`'s `POST /auth/login` calls `student-service` synchronously the moment it's hit. **Verify**:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/auth/login \
  -X POST -H "Content-Type: application/json" -d '{"username":"x","password":"y"}'
# expect 401 (invalid creds) rather than a connection error — a 401 here proves
# the gateway is up AND successfully reached student-service to check credentials
```

### Step 6 — Exercise the full system end to end

```bash
# 1. Log in with a seeded account (see 01_student_db.sql sample data)
curl -s http://localhost:8080/auth/login \
  -X POST -H "Content-Type: application/json" \
  -d '{"username":"aarav.sharma","password":"hash_9f2b1c0a"}'
# → {"token":"<jwt>","tokenType":"Bearer"}

TOKEN="<paste the token here>"

# 2. Call a routed, authenticated endpoint
curl -s http://localhost:8080/api/students/1 -H "Authorization: Bearer $TOKEN"

# 3. Trigger the enrollment saga
curl -s http://localhost:8080/api/enrollments \
  -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"studentId":1,"courseId":3}'
# → 202 Accepted, status PENDING_VALIDATION

# 4. Poll until the saga resolves (usually well under a second)
curl -s http://localhost:8080/api/enrollments/<id> -H "Authorization: Bearer $TOKEN"
# → status should flip to CONFIRMED (or REJECTED if ids don't exist)

# 5. Confirm the notification side-effect
curl -s "http://localhost:8080/api/notifications?enrollmentId=<id>" -H "Authorization: Bearer $TOKEN"
```

Every service's connection details (`DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `KAFKA_BOOTSTRAP_SERVERS`, and — for the gateway — `SERVICE_STUDENT_URL` / `SERVICE_COURSE_URL` / `SERVICE_ENROLLMENT_URL` / `SERVICE_NOTIFICATION_URL` / `JWT_SECRET`) are all externalized as environment variables with local-friendly defaults, so the exact same artifacts can be pointed at different hosts/ports (e.g., in a Docker Compose or Kubernetes deployment where each service runs in its own container) without any code change.

---

## 14. Stopping the System & Common Startup Problems

### 14.1 Shutdown order

Stop in the reverse order you started: `api-gateway` first (`Ctrl+C` in its terminal), then the four backend services in any order, then `docker compose down` to stop Kafka (add `-v` to also delete the broker's data volume for a totally clean next run). MySQL is not managed by this project's tooling, so leave it running or stop it independently.

### 14.2 Common problems and their cause

| Symptom | Likely Cause | Fix |
|---|---|---|
| A service fails at startup with a MySQL connection error | MySQL isn't running, or the database named in `spring.datasource.url` doesn't exist yet | Confirm MySQL is running and Step 2's SQL scripts were run for that service's database |
| `Table 'StudentDB.students' doesn't exist` (lowercase) but the table clearly exists as `Students` | `lower_case_table_names` is set to a value that lowercases identifiers on your MySQL install, conflicting with the `PhysicalNamingStrategyStandardImpl` case-sensitive mapping | Check `SHOW VARIABLES LIKE 'lower_case_table_names';`; on a fresh MySQL install this must generally be set at server initialization time, not changed later |
| `api-gateway`'s `/auth/login` call hangs or times out | `student-service` isn't up yet, or `SERVICE_STUDENT_URL` doesn't match where it's actually running | Start `student-service` first and confirm it via `curl localhost:8081/api/students` before starting the gateway |
| `401 Missing Authorization: Bearer <token> header` on every `/api/**` call | Forgot to include the `Authorization` header, or is missing the `Bearer ` prefix | Re-check the exact header format; see §8.2 |
| `401 Invalid or expired token` | Token is older than 1 hour (`app.jwt.expiration-ms=3600000`), or the gateway was restarted with a different `JWT_SECRET` after the token was issued | Log in again to get a fresh token |
| An enrollment stays `PENDING_VALIDATION` forever | Kafka isn't reachable by one of the services (check each service's `KAFKA_BOOTSTRAP_SERVERS` points at `localhost:9095`), or that service simply isn't running | Confirm `docker compose ps` shows Kafka healthy, and that `student-service`/`course-service` are both up and logging `Received enrollment.requested` |
| Port already in use (`Address already in use` on startup) | Another process (possibly a previous run that didn't shut down cleanly) is holding the port | Use the `lsof -i :<port>` commands from §12.3 to find and stop it, or override the port via `SERVER_PORT` |

---

## 15. Design Trade-offs and Why They Were Made

| Decision | Trade-off Accepted | Why It's Reasonable Here |
|---|---|---|
| No two-phase-commit / distributed transaction across services | Enrollment briefly exists in `PENDING_VALIDATION` before the saga resolves; there's a window where the row is "not yet decided" | Matches real distributed-systems practice; 2PC would require all four services to be simultaneously available and would hold locks, hurting availability |
| Saga has no compensating transactions | Would be insufficient if a participant's step *wrote* durable state that later needed undoing | Correct here specifically because `student-service`/`course-service` only *read* to answer validation — nothing to compensate |
| Kafka publish inside the same method as the DB write, but not in the same transaction (no outbox pattern) | If the process crashes between the DB commit and the Kafka send, an `Enrollment` could get stuck in `PENDING_VALIDATION` forever with no `enrollment.requested` ever sent | Acceptable for a teaching/demo system; a production system would typically add a transactional outbox table + a separate relay process |
| Backend services trust `X-Authenticated-User` with no cryptographic proof | Any caller who reaches a backend service's port directly can forge any identity | Acceptable given the deployment assumption "backend services are unreachable except through the gateway" — genuinely enforced only by network topology, not code, in this demo |
| Password comparison is plaintext `.equals()`, not `BCryptPasswordEncoder.matches()` | Not remotely production-safe | Explicitly commented in the code as a demo simplification |
| No shared JAR for cross-service event/DTO contracts — every service hand-copies the shapes it needs | Risk of the copies silently drifting out of sync over time (a typo in a field name on one side wouldn't be caught at compile time) | Preserves independent deployability — the alternative (a shared library) would require lock-step redeployment of every service whenever the shared library changes |
| `enrollment.requested` fans out to two independent consumer groups instead of enrollment-service directly calling two services | Slightly harder to trace by reading one file (logic is spread across three services) | This *is* the Saga/choreography pattern — the explicit goal is decoupling, and the trade-off (harder to trace) is the textbook cost of choreography vs. orchestration |
| `EnrollmentValidation` updates use hand-written bulk JPQL instead of default `save()` | More code, one repository method looks different from every other repository in the project | Necessary — a naive load-modify-save under concurrent Kafka listener threads is a real lost-update bug, not a hypothetical one |

---

## 16. Glossary

- **Choreography (saga style):** cross-service coordination where each participant reacts to events independently, with no central coordinator explicitly sequencing the steps.
- **Consumer group (Kafka):** a named set of consumers that share the work of reading a topic's partitions; two different consumer groups each receive an independent full copy of every message.
- **DTO (Data Transfer Object):** a plain class shaping a request/response payload that isn't a direct database entity (e.g. `LoginRequest`, `VerifyCredentialsResponse`).
- **GlobalFilter (Spring Cloud Gateway):** a filter that runs for every request that matches some route, regardless of which route — the mechanism `GatewayAuthFilter` uses to enforce auth on all four backend routes from one class.
- **Idempotent (SQL script):** safe to re-run; here, achieved via `DROP DATABASE IF EXISTS` before every `CREATE DATABASE`.
- **JWT (JSON Web Token):** a compact, signed token (`header.payload.signature`) carrying claims (here: `subject`=username, `issuedAt`, `expiration`) that a server can verify without a database lookup, as long as it holds the signing key.
- **KRaft:** Kafka's built-in consensus protocol (Kafka Raft), replacing the historical dependency on a separate Zookeeper cluster — used here via `KAFKA_PROCESS_ROLES: broker,controller` on a single node.
- **Lost update:** a concurrency bug where two concurrent writers each read a row, modify different parts of it in memory, and save the whole row back — the second save silently discards the first writer's change to the parts it didn't touch. Avoided in `EnrollmentValidationRepository` via targeted bulk updates.
- **OncePerRequestFilter:** a Spring servlet filter base class guaranteed to run exactly once per request, used by every backend service's `AuthenticatedUserFilter`.
- **Path predicate (Spring Cloud Gateway):** the rule (`Path=/api/students/**`) that decides which incoming requests get routed to which backend URI.
- **Reactive / WebFlux:** Spring's non-blocking web stack (`Mono`/`Flux`), used only by `api-gateway`, as opposed to the traditional blocking Spring MVC stack (servlet-based) used by all four backend services.
- **Saga:** a pattern for maintaining data consistency across multiple services without a single ACID transaction, by breaking the operation into local transactions plus (when needed) compensating actions.

---

## 17. Absolute Beginner's Guide — The Complete Flow From Zero

Everything above this section assumes you already know what a "controller," a "bean," or an "annotation" is. This section assumes **none** of that. It starts from the moment you type a command in a terminal and ends with a JSON response appearing on your screen, explaining every single hop in between — including the parts that have nothing to do with this project specifically and are just "how Java/Spring/the internet work."

If you only read one section of this entire document to understand *how this application actually runs*, read this one.

### 17.1 Vocabulary Primer

Read this table once before continuing — every term here gets used repeatedly in §17.2–§17.6.

| Term | Plain-English Meaning |
|---|---|
| **JVM (Java Virtual Machine)** | A program that runs Java code. You don't run a `.java` file directly — Java code is compiled into `.class` files (a format the JVM understands), and the JVM executes those. Every one of the five services in this project runs as its **own separate JVM process** (its own independent running program, with its own memory, its own threads) — they are not five parts of one program, they are five entirely separate programs that happen to talk to each other over the network. |
| **`.class` file / compiling** | Human-writable Java source code (`.java` files, what you see when you open a file like `StudentController.java`) is translated by the compiler into `.class` files (bytecode) — a step that happens automatically when you run `mvn` commands. The JVM never reads `.java` files directly, only `.class` files. |
| **`main` method** | Every runnable Java program needs exactly one method shaped like `public static void main(String[] args)`. This is the **entry point** — the very first line of your own code that the JVM executes when the program starts. Everything else that happens was, directly or indirectly, called from this one method. |
| **Annotation (the `@Something` syntax)** | A label you attach to a class or method that doesn't run any code by itself, but tells a framework (here, Spring) "treat this specially." E.g. `@RestController` doesn't do anything on its own — it's a flag that Spring's startup process looks for and reacts to. Think of it as a sticky note on a class, not an instruction inside the class. |
| **Bean** | Spring's word for "an object that Spring created and manages for you," as opposed to an object you created yourself with `new SomeClass()`. Almost every class in this project marked `@RestController`, `@Service`, `@Component`, or `@Configuration` becomes exactly one bean, created once, when the application starts. |
| **Dependency Injection (DI)** | Instead of a class creating the other objects it needs by hand (`new StudentRepository()`), it just declares "I need one of these" (usually via a constructor parameter), and Spring automatically hands it an already-created bean. You will see this everywhere in this codebase as constructors that take interfaces/other classes as parameters with no matching `new` anywhere in the file. |
| **Servlet / Embedded server (Tomcat)** | A "servlet container" is a program that knows how to accept raw HTTP network connections, parse them into request objects, and hand them to your code. Rather than installing a separate web server, every Spring Boot backend service in this project has one **built directly into it** ("embedded Tomcat") — running `mvn spring-boot:run` starts your Java program *and* a miniature web server inside the same process, listening on one port. |
| **Filter** | A piece of code guaranteed to run on *every* incoming request, before it reaches your actual business logic (a controller), and optionally again on the way out. Used for cross-cutting jobs that apply to almost everything — security checks, logging. This project has exactly one custom filter per backend service: `AuthenticatedUserFilter`. |
| **DispatcherServlet** | Spring MVC's own single, built-in servlet that every single HTTP request to a Spring Boot web app passes through first. Its only job is: look at the request's method + path, figure out which one of your `@RestController` methods matches, call it, and turn whatever that method returns into an HTTP response. You never write a `DispatcherServlet` yourself — Spring Boot wires it up automatically the moment it sees `spring-boot-starter-web` on the classpath. |
| **Controller** | A class annotated `@RestController` — the class Spring calls directly once it has decided (via `DispatcherServlet`) which method should handle a given request. In this project: `StudentController`, `CourseController`, `EnrollmentController`, etc. |
| **Service** | A plain class annotated `@Service`, called by a controller, that holds the actual business rule/decision logic. Controllers in this project are deliberately "thin" — they never contain logic themselves, they immediately hand off to a `Service`. |
| **Repository / JPA / Hibernate / ORM** | A `Repository` is an interface (e.g. `StudentRepository`) that represents "a way to read/write one type of database table." **JPA** (Jakarta Persistence API) is the standard Java API for this; **Hibernate** is the actual library doing the work underneath; both together are called an **ORM** (Object-Relational Mapper) because their whole job is translating between Java objects (like a `Student` object) and relational database rows (a row in the `Students` table) — automatically, without you writing SQL by hand for the common cases. |
| **Entity** | A plain Java class annotated `@Entity` (e.g. `Student.java`) that represents exactly one row of exactly one database table — one field per column. |
| **SQL** | The query language relational databases (MySQL, here) actually understand — e.g. `SELECT * FROM Students WHERE student_id = 1`. You almost never see this text directly in this codebase because Hibernate generates it for you from repository method calls. |
| **JSON** | The plain-text data format (`{"key": "value"}`) used for every request/response body in this API. Java objects are automatically converted to/from JSON by a library called **Jackson**, wired in automatically by Spring Boot — you never call it explicitly. |
| **HTTP request/response** | The actual text messages that flow over the network — a request has a method (`GET`/`POST`/etc.), a path (`/api/students/1`), headers (key-value metadata like `Authorization`), and optionally a body; a response has a status code (`200`, `404`, etc.), headers, and optionally a body. |
| **Port** | A number (0–65535) identifying *which* program on a machine a network connection is meant for, since one machine can run many programs at once. `localhost:8081` means "the program listening on port 8081, on this same machine." |
| **TCP connection / socket** | The low-level, always-on-first "pipe" that HTTP is sent over. Before any HTTP text can be exchanged, the client and server perform a "handshake" to open this pipe. |
| **Message broker (Kafka) / topic / consumer group / producer / consumer** | Kafka is a separate program (not part of any Spring Boot service) that services use to send each other messages without calling each other directly. A **topic** (e.g. `enrollment.requested`) is a named channel. A **producer** is code that sends a message to a topic (`KafkaTemplate.send(...)`). A **consumer** is code that has subscribed to read messages from a topic (`@KafkaListener`). A **consumer group** is a label identifying *which* set of consumers should each get their own independent copy of every message — this is why both `student-service` and `course-service` each receive every `enrollment.requested` message: they're in two different consumer groups. |

### 17.2 Part A — What Happens the Instant You Start ONE Service

We'll trace `student-service` in full detail (it's the simplest complete example — plain Spring MVC, one database, one Kafka listener, no reactive code). Every other backend service follows this exact same sequence with different class names; `api-gateway` follows an almost-identical sequence with two differences called out at the end.

**Step 1 — You run the command.**
```bash
cd student-service && mvn spring-boot:run
```
Maven (a build tool — think of it as the thing that turns your source files into a runnable program and then runs it) compiles every `.java` file under `student-service/src/main/java` into `.class` files, packages them together with all the required libraries (Spring, Hibernate, the MySQL driver, the Kafka client, etc.), and then starts a brand-new operating-system process running the JVM.

**Step 2 — The JVM looks for the entry point.**
The JVM was told (by Spring Boot's Maven plugin) that the "main class" is `com.studentmgmt.student.StudentServiceApplication`. It loads that class and calls its `main` method — this is the literal first line of *this project's own code* that ever executes:
```java
public static void main(String[] args) {
    SpringApplication.run(StudentServiceApplication.class, args);
}
```
Everything from here onward is a direct or indirect consequence of this one line.

**Step 3 — `SpringApplication.run(...)` boots the "Spring Application Context."**
This call (code you didn't write — it belongs to the Spring Framework itself) creates a large in-memory container object, the **Application Context**, whose entire job for the rest of the program's life is to hold every bean (§17.1) the application needs and know how they're wired together.

**Step 4 — Spring Boot auto-configuration inspects what libraries are present.**
Spring Boot looks at what's on the classpath (the list of libraries this project depends on, declared in `student-service`'s `pom.xml`) and, for each one it recognizes, automatically configures the matching infrastructure — with no manual setup code required anywhere in this project:
- Sees `spring-boot-starter-web` → decides to configure an **embedded Tomcat server** and Spring MVC's `DispatcherServlet`.
- Sees `spring-boot-starter-data-jpa` + `mysql-connector-j` → configures a **`DataSource`** (a connection pool to a database) using the exact URL/username/password from `application.properties` (`jdbc:mysql://localhost:3306/StudentDB`, `abhig`/`Pass@123` by default), and a Hibernate `EntityManagerFactory` on top of it.
- Sees `spring-kafka` → configures a Kafka `ProducerFactory` and `ConsumerFactory` pointed at `spring.kafka.bootstrap-servers` (`localhost:9095` by default).
- Sees Jackson (comes bundled with `spring-boot-starter-web`) → configures the JSON converter used to turn Java objects into HTTP response bodies and back.

**Step 5 — Component scanning finds your classes.**
Spring walks through every package under `com.studentmgmt.student` (because that's the package containing `@SpringBootApplication`-annotated `StudentServiceApplication`, and Spring Boot scans that package and everything beneath it by default) looking for annotated classes. For every class it finds marked `@RestController`, `@Service`, `@Component`, or `@Configuration`, it creates exactly **one instance** of that class (a bean) and stores it in the Application Context. In this service, that means one instance each of: `StudentController`, `StudentAddressController`, `StudentDocumentController`, `StudentLoginController`, `WhoAmIController`, `StudentService`, `StudentAddressService`, `StudentDocumentService`, `StudentLoginService`, `AuthenticatedUserFilter`, `EnrollmentRequestedListener`, `ValidationResultProducer`, `GlobalExceptionHandler`.

**Step 6 — Dependency injection wires the beans together.**
Take `StudentController`:
```java
public StudentController(StudentService studentService) {
    this.studentService = studentService;
}
```
When Spring creates the `StudentController` bean, it sees the constructor needs a `StudentService`. It looks in the Application Context, finds the `StudentService` bean it *already created* in Step 5, and passes it in automatically. You will never find a line anywhere in this codebase that says `new StudentService()` — Spring does that job, once, at startup, for every bean.

**Step 7 — Spring Data JPA generates a real implementation for every repository interface.**
`StudentRepository` in the source code is *only* an interface:
```java
public interface StudentRepository extends JpaRepository<Student, Long> {
}
```
There is no `.java` file anywhere containing the actual logic behind `findAll()`, `save()`, `findById()`. At startup, Spring Data JPA generates a real class implementing this interface **on the fly, in memory** (a "dynamic proxy") that knows how to turn each method call into the correct SQL statement, using the `@Entity`/`@Table`/`@Column` annotations on `Student.java` to know which table and columns to target.

**Step 8 — The database connection pool actually opens connections.**
The `DataSource` configured in Step 4 now genuinely tries to connect to MySQL at `localhost:3306`, log in with `abhig`/`Pass@123`, and select the `StudentDB` database. **This is the single most common point of startup failure** — if MySQL isn't running, or `StudentDB` doesn't exist yet (because the SQL scripts from the earlier discussion were never run), the application fails right here with a loud stack trace, before Step 10 ever happens.

**Step 9 — The Kafka listener container starts and begins waiting in the background.**
`EnrollmentRequestedListener.onEnrollmentRequested(...)` is annotated `@KafkaListener(topics = "enrollment.requested")`. Spring Kafka opens a real network connection to the Kafka broker at `localhost:9095`, registers this service (under consumer group `student-service-group`) as interested in the `enrollment.requested` topic, and spins up a **background thread** that sits idle, doing nothing, until a message actually arrives on that topic — at which point, and only then, it calls `onEnrollmentRequested(...)` automatically. This thread runs for the entire lifetime of the application, completely independently of any HTTP traffic.

**Step 10 — Embedded Tomcat starts and opens the port.**
Tomcat (configured automatically in Step 4) now binds to port `8081` (from `server.port=8081` in `application.properties`) and starts listening for incoming TCP connections. Before this instant, nothing sent to `localhost:8081` would even get a "connection refused" response answered by *this* program — the operating system wouldn't hand the connection attempt to anyone.

**Step 11 — Spring Boot logs "Started" and the main thread's job is effectively done.**
You'll see a line like:
```
Started StudentServiceApplication in 3.412 seconds (process running for 3.812)
```
The original `main` method has technically returned, but the JVM process **does not exit**, because Tomcat's listener thread and the Kafka consumer thread from Steps 9–10 are still running in the background, keeping the process alive. The application is now fully "up" — waiting for either an HTTP request to arrive on port 8081, or a Kafka message to arrive on `enrollment.requested`.

**The same sequence, independently, for the other three backend services** (`course-service` on 8082, `enrollment-service` on 8083, `notification-service` on 8084) — each is its own separate JVM process, going through Steps 1–11 on its own, completely unaware of the others' existence except through the shared MySQL server and the shared Kafka broker.

**How `api-gateway`'s startup differs:** it uses `spring-boot-starter-webflux` instead of `spring-boot-starter-web`, so Step 4 configures an embedded **Netty** server (a different, non-blocking web server) instead of Tomcat, and there is no `DispatcherServlet`/servlet-filter-chain concept at all — Spring Cloud Gateway builds its own reactive routing pipeline instead (this is where `GatewayAuthFilter`, a `GlobalFilter`, gets registered as a bean during Step 5–6, the same dependency-injection machinery, just a different kind of filter interface). There's no database and no Kafka listener for the gateway, so Steps 7–9 don't apply to it at all — it only needs Step 10 (Netty opens port 8080) to be ready.

### 17.3 Part B — What Happens on the Network Before Any Java Code Runs

Before a single line of this project's Java code executes for a given request, the following has to happen — this part has nothing to do with Spring or this codebase specifically, it's just "how any client/server HTTP call works":

1. **You (or Postman, or `curl`) construct an HTTP request** as plain text in memory: a method (`GET`), a path (`/api/students/1`), a set of headers (`Authorization: Bearer <token>`, `Content-Type: application/json`), and optionally a body.
2. **The hostname is resolved.** `localhost` is a special reserved name that always resolves to `127.0.0.1` — "this same machine" — no real DNS lookup happens; the operating system short-circuits it.
3. **A TCP connection ("socket") is opened** to `127.0.0.1` on the target port (`8080` for anything going to the gateway). This is a separate step from sending the actual HTTP text — think of it as "dialing the phone number" before you start talking. It involves a three-step handshake (SYN, SYN-ACK, ACK) between the client's networking stack and the operating system on the machine running the target program.
4. **The operating system delivers the connection to whichever program is listening on that port** — in our case, that's the `api-gateway` JVM process, specifically its embedded Netty server, because Step 10 of §17.2 already bound it to port 8080.
5. **The raw HTTP request bytes are sent over that now-open connection** and are read by Netty's networking code, which parses the raw bytes back into a structured "HTTP request" object (method, path, headers, body) that Spring's code can actually work with.

Only *after* all five of these steps finish does the very first piece of this project's own code get a chance to look at the request — that hand-off point is where §17.4 picks up.

### 17.4 Part C — Full Trace: A Simple GET Request, Entry Point to Response

Concrete example: `GET http://localhost:8080/api/students/1` with header `Authorization: Bearer <valid-jwt>`.

**At a glance — 23 hops across 4 layers:**

```
 CLIENT           GATEWAY (Netty)                 BACKEND (Tomcat)              DATABASE
   │                     │                               │                          │
   ├── 1-2 send req ────▶│                               │                          │
   │                     ├── 3-4 route match             │                          │
   │                     ├── 5   JWT auth filter         │                          │
   │                     ├── 6   proxy hop ──────────────▶│                          │
   │                     │                               ├── 7-8  servlet filter    │
   │                     │                               ├── 9-11 dispatch/controller│
   │                     │                               ├── 12-13 service/repo ───▶│
   │                     │                               │◀── 14  row data ─────────┤
   │                     │                               ├── 15-20 build response   │
   │                     │◀── 21  response ──────────────┤                          │
   │◀── 22-23 response ──┤                               │                          │
```

#### Phase 1 — Client to Gateway (Steps 1–4)

**Step 1 — The request is built.** curl/Postman builds the HTTP request text (§17.3 Steps 1–3).

**Step 2 — The bytes arrive.** TCP connects to `127.0.0.1:8080`; the request bytes arrive at `api-gateway`'s Netty server.

**Step 3 — Netty parses the request.** Netty parses the bytes into a request object and hands it to Spring Cloud Gateway's routing engine.

**Step 4 — A route is matched.** The routing engine checks the request's path against every route's `Path=` predicate (§5.2): `/api/students/1` matches `Path=/api/students/**,...` → route id `student-service` is selected, with target URI `http://localhost:8081`.

#### Phase 2 — Gateway Authentication Filter (Step 5)

**Step 5 — `GatewayAuthFilter` runs first.** Because a route matched, the request enters a `GatewayFilterChain`, which runs every registered `GlobalFilter` in order — `GatewayAuthFilter` (order = `-1`) runs FIRST:

- **5a.** Reads the `Authorization` header.
- **5b.** Header starts with `"Bearer "` → extracts the token string.
- **5c.** `JwtUtil.isValid(token)` parses the JWT's three parts (header.payload.signature), recomputes the signature using the gateway's own secret key, and compares it to the signature actually on the token. Match + not expired → valid.
- **5d.** `JwtUtil.extractUsername(token)` reads the `subject` field out of the token's payload.
- **5e.** The ORIGINAL request is copied with one new header added: `X-Authenticated-User: aarav.sharma`.
- **5f.** `chain.filter(mutatedExchange)` is called — "continue processing, here is the (slightly modified) request to continue with."

#### Phase 3 — Gateway to Backend Hop (Step 6)

**Step 6 — The gateway proxies the request.** Spring Cloud Gateway's own built-in proxying logic (no custom code — this is framework machinery) now opens a BRAND NEW, SEPARATE TCP connection, this time to `localhost:8081`, and re-sends the request (same method `GET`, same path `/api/students/1`, same headers PLUS the new `X-Authenticated-User` header, no body) — this is a second, independent trip through §17.3's 5 network steps, just entirely on the local loopback interface instead of the public internet.

#### Phase 4 — Backend Receives and Filters (Steps 7–8)

**Step 7 — Tomcat accepts the connection.** `student-service`'s embedded Tomcat (listening since Step 10 of §17.2) accepts the connection and parses the HTTP request.

**Step 8 — `AuthenticatedUserFilter` runs before any controller.** Tomcat's servlet container runs the filter chain first — `AuthenticatedUserFilter.doFilterInternal()` runs:

- **8a.** Reads the `X-Authenticated-User` header → `"aarav.sharma"`.
- **8b.** Stores it as a request attribute (a piece of data attached to this one request, retrievable later by any code that has a handle on the same request object).
- **8c.** Calls `filterChain.doFilter(request, response)` — "continue, nothing to block here."

#### Phase 5 — Spring MVC Dispatch (Steps 9–11)

**Step 9 — `DispatcherServlet` resolves the target method.** Control now reaches Spring MVC's `DispatcherServlet` — the single servlet every request in this service passes through. Its job: figure out which `@RestController` method should handle `GET /api/students/1`.

- **9a.** It consults its internal map of "method + path pattern → controller method," built at startup from every `@RequestMapping`/`@GetMapping`/etc. annotation it found during component scanning (§17.2 Step 5).
- **9b.** `/api/students/1` matches `@RequestMapping("/api/students")` + `@GetMapping("/{id}")` on `StudentController.findById(Long id)` — and `"1"` is captured as the `{id}` path variable.
- **9c.** Spring converts the string `"1"` into the Java type the method actually declares (`Long`).

**Step 10 — The controller method is invoked.** `DispatcherServlet` invokes `studentController.findById(1L)` — `studentController` here is the SAME bean instance created once at startup (§17.2 Step 5), reused for every request, not a new object per request.

**Step 11 — The controller delegates to the service.** Inside `StudentController.findById()`, the ONE line of business-adjacent code runs:
```java
return studentService.findById(id);
```
`studentService` is the bean that was dependency-injected into this controller's constructor at startup (§17.2 Step 6).

#### Phase 6 — Service, Repository, and Database (Steps 12–16)

**Step 12 — The service delegates to the repository.** Inside `StudentService.findById(1L)`:
```java
return studentRepository.findById(1L).orElseThrow(() -> new ResourceNotFoundException(...));
```

**Step 13 — The repository proxy builds and runs SQL.** `studentRepository.findById(1L)` runs — remember, `StudentRepository` has no hand-written implementation; this call executes inside the dynamic proxy Spring Data JPA generated at startup (§17.2 Step 7). That generated code:

- **13a.** Builds the SQL statement: `SELECT * FROM Students WHERE student_id = ?`.
- **13b.** Borrows an already-open connection from the connection pool (opened at startup, §17.2 Step 8).
- **13c.** Sends the SQL to MySQL over that connection.

**Step 14 — MySQL executes the query.** MySQL executes the query against the real, on-disk `Students` table, and sends back the matching row's raw column values over the same connection.

**Step 15 — Hibernate builds the Java object.** Hibernate reads those raw values and constructs a real Java `Student` object, setting each field (`studentId`, `firstName`, `lastName`, `email`, ...) based on the `@Column` mappings in `Student.java` — this translation step (raw DB row → Java object) is the entire point of an ORM (§17.1).

**Step 16 — The object returns up the call stack.** That `Student` object is wrapped in an `Optional<Student>` (Java's "this might or might not have a value" container) and returned up: repository proxy → `StudentService` (`.orElseThrow` — since a value IS present here, this just unwraps it) → `StudentController`.

#### Phase 7 — Response Assembly (Steps 17–20)

**Step 17 — The controller returns.** `StudentController.findById()` returns the `Student` object as its method's return value.

**Step 18 — Jackson takes over.** `DispatcherServlet` sees the method returned a plain object (not a special "please render this HTML page" instruction — this is a `@RestController`, so everything returned is meant to become the raw response body) and hands it to Jackson, the JSON-conversion library configured automatically at startup (§17.2 Step 4).

**Step 19 — JSON is produced.** Jackson walks the `Student` object's fields via reflection and produces JSON text:
```json
{"studentId":1,"firstName":"Aarav","lastName":"Sharma","email":"aarav.sharma@example.com", ...}
```
(Note: if this were a `StudentLogin` object instead, the `passwordHash` field would be silently skipped here, because it's annotated `@JsonIgnore` in the entity class — this is where that annotation actually takes effect.)

**Step 20 — The HTTP response is set.** `DispatcherServlet` sets the HTTP response: status `200 OK` (the default when a controller method returns normally with no thrown exception and no explicit `@ResponseStatus`), `Content-Type: application/json`, body = the JSON text from Step 19.

#### Phase 8 — Response Returns to the Client (Steps 21–23)

**Step 21 — Tomcat replies to the gateway.** Tomcat sends this response back over the SAME TCP connection that carried the original request in Step 7 — back to the gateway's Netty client.

**Step 22 — The gateway forwards the response.** Spring Cloud Gateway's proxying logic receives this response and forwards it, essentially byte-for-byte, back over the ORIGINAL client connection from Step 2 — status code, headers, and body all preserved.

**Step 23 — The client sees the result.** curl/Postman receives the response and displays it to you.

> **The pattern to remember:** that's 23 hops, and it's what happens **every single time**, for every plain `GET`, for every backend service — only the controller/service/repository/entity class names change.

### 17.5 Part D — Full Trace: A POST That Writes Data and Wakes Up Kafka

Everything in §17.4 Steps 1–10 happens identically for `POST http://localhost:8080/api/enrollments` with body `{"studentId":1,"courseId":3}` (routed instead to `enrollment-service:8083`, matched by `EnrollmentController.create(...)` instead). From the point the controller method is actually invoked, the story adds these new pieces.

**At a glance — one request, three background reactions:**

```
POST /api/enrollments ──▶ enrollment-service ──▶ 202 Accepted ──▶ client       (Steps 1-18, done)
                                │
                                ▼  publishes enrollment.requested
                    ┌───────────┴───────────┐
                    ▼                       ▼
            student-service          course-service                (Steps 19-20, run in parallel)
                    │                       │
                    ▼                       ▼
        student.validation.result   course.validation.result
                    └───────────┬───────────┘
                                ▼
                     enrollment-service saga                       (Step 21 — waits for both)
                                │
                                ▼  publishes enrollment.confirmed
                      notification-service                          (Step 22)
                                │
                                ▼
                    EMAIL + SMS rows written
```

#### D.1 — Synchronous Phase: Save and Respond (Steps 11–18)

This part behaves exactly like a normal request/response — the client is still connected and waiting.

**Step 11 — The request body becomes a Java object.** `DispatcherServlet` needs to hand the controller method a fully-built `Enrollment` object, not just a path variable this time — the method is:
```java
@PostMapping
public Enrollment create(@Valid @RequestBody Enrollment enrollment) { ... }
```
`@RequestBody` tells Spring: take the raw JSON in the request body and deserialize it into an `Enrollment` object (the reverse of Jackson's Step 19 in §17.4) — `{"studentId":1,"courseId":3}` becomes a real `Enrollment` object with those two fields set and everything else `null`.

**Step 12 — The object is validated before the controller runs.** `@Valid` tells Spring to run Jakarta Bean Validation against that object BEFORE the controller method body executes — checking every `@NotNull`/`@NotBlank`/etc. annotation on `Enrollment.java`. `studentId` and `courseId` are both present → validation passes.

> If either field were missing, the controller method would never even run — Spring would short-circuit straight to `GlobalExceptionHandler.handleValidation()` and respond `400`, and none of the steps below would happen.

**Step 13 — The controller delegates to the service.** `EnrollmentController.create(enrollment)` calls `enrollmentService.create(enrollment)`.

**Step 14 — One transactional block writes two rows.** Inside `EnrollmentService.create()`, wrapped in one `@Transactional` boundary (meaning: the database writes inside this method either ALL succeed together or all get rolled back together if something throws):

- **14a.** Looks up the numeric id for status `PENDING_VALIDATION` (a `SELECT`, via `EnrollmentStatusService` → `EnrollmentStatusRepository`).
- **14b.** Sets `enrollment.statusId` to that value, defaults `enrollmentDate` to today.
- **14c.** `enrollmentRepository.save(enrollment)` — since this object has no id yet, JPA/Hibernate knows this must be an `INSERT`, not an `UPDATE`, and generates `INSERT INTO Enrollments (student_id, course_id, status_id, enrollment_date) VALUES (...)`. MySQL executes it and returns the newly auto-generated `enrollment_id` (say, `37`), which Hibernate writes back into the Java object's `enrollmentId` field automatically.
- **14d.** A second `INSERT` creates the matching `Enrollment_Validation` row (id `37`, both validation columns `NULL`).

**Step 15 — The saga kicks off with a Kafka publish.** `enrollmentRequestedProducer.publish(new EnrollmentRequestedEvent(37, 1, 3, now))` runs:

- **15a.** Jackson converts this small event object into JSON text.
- **15b.** `KafkaTemplate` opens (or reuses) a connection to the Kafka broker at `localhost:9095`.
- **15c.** Sends a message to topic `enrollment.requested`, using `"37"` as the message's key.
- **15d.** The Kafka broker (a completely separate program, not part of any Spring Boot service) receives this message and appends it to that topic's on-disk log file — this append is itself durable/persisted the moment Kafka acknowledges it.

**Step 16 — The transaction commits.** The `@Transactional` method returns; the two database `INSERT`s from Step 14 are committed for real.

**Step 17 — The client gets its response.** `EnrollmentController` returns the `Enrollment` object; because this specific method is annotated `@ResponseStatus(HttpStatus.ACCEPTED)`, the HTTP response status is `202`, not the default `200`/`201` — Jackson serializes the object exactly as in §17.4 Step 19, and the response travels back through Tomcat → gateway → client exactly as in §17.4 Steps 21–23.

> **Step 18 — The HTTP request is now fully complete.** The client has its `202` response and has moved on. Everything below happens completely independently, on background threads, in TWO OTHER JVM PROCESSES that have been sitting idle since their own startup (§17.2 Step 9) with nothing to do until now.

#### D.2 — Asynchronous Phase: The Kafka Saga (Steps 19–22)

**Step 19 — `student-service` validates the student.** Its Kafka consumer thread (idle since its own startup) wakes up the instant the message from Step 15c lands on the topic it's subscribed to. Spring Kafka automatically calls `EnrollmentRequestedListener.onEnrollmentRequested(messageJson)` on a background thread — nobody in this project's code explicitly "calls" this method; the Kafka client library does, because of the `@KafkaListener` annotation:

- **19a.** Jackson deserializes the JSON back into an `EnrollmentRequestedEvent` object.
- **19b.** `studentRepository.existsById(1L)` — another generated SQL query, this time against `StudentDB`, on a completely different physical database from `EnrollmentDB`.
- **19c.** Builds a `ValidationResultEvent(37, true, "Student 1 exists", "student-service", now)`.
- **19d.** Publishes it to topic `student.validation.result` — same publish mechanism as Step 15.

**Step 20 — `course-service` validates the course, at the same time.** SIMULTANEOUSLY (a separate JVM process, a separate thread, no coordination between the two): `course-service`'s Kafka consumer thread also wakes up from the SAME message published in Step 15. This is possible because `student-service` and `course-service` are registered under two DIFFERENT Kafka consumer group ids, so Kafka delivers an independent copy of the message to each group — `EnrollmentRequestedListener.onEnrollmentRequested(messageJson)` runs again, but this is `course-service`'s own class (same class name, different package):

- **20a.** `courseRepository.existsById(3L)` against `CourseDB`.
- **20b.** Publishes `ValidationResultEvent(37, true, "Course 3 exists", "course-service", now)` to topic `course.validation.result`.

**Step 21 — `enrollment-service` resolves the saga once both results arrive.** Back in `enrollment-service`, its OWN two Kafka consumer threads (idle since ITS startup) each wake up independently, whenever their respective message actually arrives — the order between these two is NOT guaranteed, either could genuinely happen first:

| Listener | Reads topic | Calls |
|---|---|---|
| `StudentValidationResultListener` | `student.validation.result` | `EnrollmentSagaService.applyStudentValidationResult(37, true, "Student 1 exists")` |
| `CourseValidationResultListener` | `course.validation.result` | `EnrollmentSagaService.applyCourseValidationResult(37, true, "Course 3 exists")` |

Both listeners run the same targeted-`UPDATE`-then-check pattern against the `Enrollment_Validation` row for id `37`, but only one of them actually resolves the saga:

- **Whichever runs FIRST** does a targeted SQL `UPDATE` setting only its own column (`student_valid` or `course_valid`), re-reads the row, sees the OTHER column is still `NULL`, logs "still waiting," and does nothing further.
- **Whichever runs SECOND** does its own targeted `UPDATE`, re-reads the row, sees BOTH columns are now non-null, and resolves the saga:
  - **21a.** Computes `CONFIRMED` (both `true`).
  - **21b.** Looks up the numeric id for status `CONFIRMED`.
  - **21c.** `UPDATE Enrollments SET status_id = <confirmed-id> WHERE enrollment_id = 37`.
  - **21d.** Builds an `EnrollmentOutcomeEvent(37, 1, 3, "CONFIRMED", null, now)`.
  - **21e.** Publishes it to topic `enrollment.confirmed`.

**Step 22 — `notification-service` sends the notifications.** Its Kafka consumer thread (idle since ITS startup, subscribed to BOTH `enrollment.confirmed` and `enrollment.rejected` via one `@KafkaListener`) wakes up: `EnrollmentOutcomeListener.onEnrollmentOutcome(...)` → `EnrollmentOutcomeService.handle(event)`:

- **22a.** `INSERT INTO Notifications (... channel='EMAIL', status='SENT' ...)` against `NotificationDB`.
- **22b.** `INSERT INTO Email_Logs (...)`.
- **22c.** Because status was `CONFIRMED`: also `INSERT INTO Notifications (... channel='SMS' ...)` and `INSERT INTO SMS_Logs (...)`.

Nothing publishes anything further from here — this is the last stop; the saga is finished.

#### D.3 — Confirming It Happened (Step 23)

**Step 23 — You check the result yourself.** Meanwhile, back on your terminal/Postman, you (the human) separately send:
```
GET http://localhost:8080/api/enrollments/37
```
which runs the ENTIRE 23-step GET trace from §17.4 all over again (auth filter, `DispatcherServlet`, controller, service, repository, SQL `SELECT`), and this time the row's `status_id` resolves to `CONFIRMED` — proving to you, after the fact, that Steps 19–22 above actually happened, entirely invisibly, in the background, across three other processes, while your original `POST` had already finished and returned `202` many milliseconds (or, in a slow environment, seconds) earlier.

> **The one sentence that summarizes the whole point of Part D:** a single client `POST` triggers one HTTP request/response cycle (Steps 1–17) that finishes almost instantly, and *separately* kicks off a chain reaction across three independent background processes (Steps 19–22) that the original caller never waits for and never gets a direct answer from — the only way to find out what happened is to ask again later (Step 23), which is exactly why `POST /api/enrollments` returns `202 Accepted` ("I've started this, but I can't tell you the outcome yet") instead of `201 Created` ("this is fully done, here's the final result").

### 17.6 One-Page Cheat Sheet

**Starting a service (repeats once per JVM process, 5 times total):**
```
mvn spring-boot:run
  → JVM starts → finds main() → SpringApplication.run()
    → auto-configuration reads pom.xml dependencies (web? data-jpa? kafka?)
    → component scan creates one bean per @RestController/@Service/@Component
    → dependency injection wires beans' constructors together
    → JPA generates real code behind every Repository interface
    → DataSource opens a real connection pool to MySQL
    → Kafka consumer threads open connections and go idle, waiting for messages
    → embedded server (Tomcat, or Netty for the gateway) opens its port
    → "Started XApplication..." logged → process stays alive on background threads
```

**Any request hitting the system (repeats once per HTTP call):**
```
client builds HTTP request → TCP connects to gateway:8080 → Netty parses it
  → route predicate matches path → GatewayAuthFilter checks JWT, injects X-Authenticated-User
    (or rejects with 401 right here, backend never contacted)
  → NEW TCP connection to the target backend service's port
    → Tomcat parses it → AuthenticatedUserFilter reads the injected header
      → DispatcherServlet matches path+method to one @RestController method
        → controller calls service → service calls repository
          → repository (generated by JPA) builds SQL → MySQL executes it → row(s) come back
          → Hibernate turns row(s) back into Java object(s)
        → service returns object to controller
      → controller returns object → Jackson turns it into JSON
    → Tomcat sends HTTP response back down the same connection
  → gateway forwards that response back to the original client, unchanged
client receives JSON
```

**If the request was a `POST /api/enrollments` specifically, ALSO happening in the background, in other processes, after the response above has already gone out:**
```
enrollment-service published "enrollment.requested" during its own request-handling flow above
  → student-service's idle Kafka thread wakes up → checks StudentDB → publishes its own reply
  → course-service's idle Kafka thread wakes up (independently) → checks CourseDB → publishes its reply
    → enrollment-service's idle Kafka threads wake up for each reply
      → once BOTH replies have arrived → updates Enrollments row → publishes outcome event
        → notification-service's idle Kafka thread wakes up → writes Notification/EmailLog/SmsLog rows
client finds out what happened only by polling GET /api/enrollments/{id} again, later
```
