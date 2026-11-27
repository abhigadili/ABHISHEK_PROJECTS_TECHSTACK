# SPRINGB-SMgmt-async-api-gateway-pattern-kafka-Centralized-Auth
## Complete Project Walkthrough — Where to Start, File-by-File Flow, and Authentication Deep-Dive

Project path: `Documents/Java_Projects/SPRINGB-SMgmt-async-api-gateway-pattern-kafka-Centralized-Auth`

This document is a **navigation guide**. Two other guides already live in this project's root
folder and go deep on specific topics — this one is different: it tells you **which file to open
first, second, third**, in the order a real request actually travels through the code, and then
gives a full line-by-line explanation of how a login token issued by the Gateway ends up
authenticating a call on a completely separate microservice.

| Existing document | What it covers |
|---|---|
| `202607021559_async_api_gateway_kafka_student_mgmt_guide.md` | Base architecture: 5 modules, the Kafka enrollment saga, a real concurrency bug and its fix |
| `202607021723_centralized_gateway_auth_guide.md` | Why authentication was centralized at the gateway instead of duplicated in every service |
| **This document** | **A guided file-by-file tour + the complete authentication mechanics** |

---

## 1. The 30-Second Mental Model

```
                              ┌─────────────────────────────┐
        every client  ──────▶ │        api-gateway (8080)    │  ◀── the ONLY door in.
        (browser/Postman)     │  Spring Cloud Gateway         │      Issues tokens.
                              │  Validates tokens.            │      Validates tokens.
                              └───────────┬───────────────────┘
                     routes by URL path, adds X-Authenticated-User header
        ┌───────────────────┬────────────────────┬───────────────────────┐
        ▼                   ▼                    ▼                       ▼
┌────────────────┐ ┌────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐
│ student-service │ │ course-service │ │  enrollment-service    │ │ notification-service   │
│   :8081          │ │   :8082         │ │    :8083                │ │    :8084                │
│   StudentDB      │ │   CourseDB      │ │    EnrollmentDB         │ │    NotificationDB       │
└────────┬─────────┘ └────────┬────────┘ └───────────┬────────────┘ └────────────▲────────────┘
         │                    │                       │  publishes                │
         │                    │           enrollment.requested                    │
         │◀───────────────────┴───────────────────────┘                          │
         │ publishes student.validation.result                                    │
         │                    │ publishes course.validation.result                │
         └────────────────────┴──────────────────────▶ enrollment-service ────────┘
                                                        (saga decides CONFIRMED/REJECTED,
                                                         publishes enrollment.confirmed/rejected)
```

Two things are layered on top of each other and it helps to keep them mentally separate:

1. **Synchronous, gateway-fronted CRUD** — a client calls the gateway, the gateway forwards to
   exactly one backend service, that service answers directly. This is how almost every `GET`,
   `POST`, `PUT`, `DELETE` in the system works, and it's also how **authentication** works
   (Section 5).
2. **Asynchronous, Kafka-driven saga** — triggered only by `POST /api/enrollments`. Three of the
   four backend services talk to *each other* through Kafka topics, with no gateway and no HTTP
   involved at all once the initial request lands (Section 4).

---

## 2. Where to Start (Running the System)

You cannot "start" this project by opening one file — it's five separate Spring Boot
applications plus a database plus a Kafka broker. Here is the exact order things must come up in,
and **why** that order matters.

| Step | What | Why this order |
|---|---|---|
| 1 | **MySQL** running on `127.0.0.1:3306` | Every backend service fails to start without its database reachable (`spring.jpa`/datasource is not optional). |
| 2 | Run the 4 scripts in `sql/` (`01_student_db.sql` → `04_notification_db.sql`) | Each script does `DROP DATABASE IF EXISTS` + `CREATE DATABASE` + seed data — this is what creates `StudentDB`, `CourseDB`, `EnrollmentDB`, `NotificationDB` before any service touches them. |
| 3 | `docker compose up -d` (starts Kafka, KRaft mode, no Zookeeper, on `localhost:9095`) | The four backend services register Kafka consumers/producers **on startup**; if the broker isn't reachable yet you get connection-refused warnings (harmless if Kafka comes up within a few seconds, but cleaner to start it first). |
| 4 | Start the four backend services, any order: `student-service` (8081), `course-service` (8082), `enrollment-service` (8083), `notification-service` (8084) | They don't call each other over HTTP at all — only through Kafka topics — so their relative start order among themselves doesn't matter. |
| 5 | Start `api-gateway` (8080) **last** | Its own `/auth/login` endpoint calls `student-service` directly over HTTP (`services.student.url`, default `http://localhost:8081`) — if student-service isn't up yet, login calls fail with a connection error. Its 4 routes also point at the other three backend ports. |
| 6 | Give everything ~10–15 seconds | The gateway boots a reactive Netty server, which is the slowest of the five. |

From this point on, **a client only ever talks to port 8080.** Ports 8081–8084 exist on the
network but should be treated as internal-only in a real deployment (see Section 5.7 for exactly
what happens if you call them directly).

---

## 3. The Recommended File-Reading Order

Reading five Spring Boot modules top-to-bottom in folder order tells you almost nothing about how
they cooperate. Instead, read them **in the order a request actually visits them.** Below are two
guided tours: Tour A follows a login + authenticated CRUD call; Tour B follows an enrollment
through the Kafka saga. Together they touch essentially every file in the codebase that matters.

### Tour A — "A client logs in, then calls a protected endpoint"

```
FILE 1  ─▶  FILE 2  ─▶  FILE 3  ─▶  FILE 4  ─▶  FILE 5  ─▶  FILE 6  ─▶  FILE 7  ─▶  FILE 8
```

| # | File | What happens here | Why it's next |
|---|---|---|---|
| **1** | `api-gateway/src/main/resources/application.yml` | Defines port `8080`, the 4 route predicates, and — critically — `app.jwt.secret` and `app.jwt.expiration-ms`. This is configuration, not code, but it's the single source of truth for routing and the JWT secret, so read it first. | Once you know the routes exist, you want to see what decides whether a request is even allowed to use them. |
| **2** | `api-gateway/.../controller/AuthController.java` | `POST /auth/login`. Receives `{username, password}`. This is a **plain local controller**, not a proxied route — it never touches the gateway's routing/filter machinery at all. | It calls out to something — follow that next. |
| **3** | `api-gateway/.../client/StudentLoginClient.java` + `api-gateway/.../config/WebClientConfig.java` | The one deliberate cross-service HTTP call in the whole system. A reactive `WebClient` calls `POST http://localhost:8081/api/student-logins/verify`. | The real credential check happens on the other end of this call — jump to student-service. |
| **4** | `student-service/.../controller/StudentLoginController.java` → `service/StudentLoginService.java` | `verifyCredentials(username, password)` looks up `Student_Login` by username, checks `active = true`, compares `password_hash` with a plain `.equals()` (a documented simplification, not real hashing). Always returns HTTP 200 with `{valid, studentId, username}` — never a 401. | Control returns to the gateway with a yes/no answer — go back to `AuthController`. |
| **5** | `api-gateway/.../controller/AuthController.java` (again) | If `valid == true`, calls `JwtUtil.generateToken(username)` and returns `{token, tokenType:"Bearer"}` to the client. | Now you have a token — see how it's built. |
| **6** | `api-gateway/.../security/JwtUtil.java` | HMAC-signed JWT (`Keys.hmacShaKeyFor(secret)`), claims = `sub` (username) + `iat` + `exp`, 1-hour expiry. This is the **only file in the entire codebase that knows the signing secret.** | Now follow what happens the *next* time the client sends this token back in, on a real API call. |
| **7** | `api-gateway/.../security/GatewayAuthFilter.java` | A Spring Cloud Gateway `GlobalFilter`, `getOrder()=-1`, runs before any proxied route is forwarded. Reads `Authorization: Bearer <token>`, validates it with `JwtUtil.isValid()`, and — on success — **mutates the request to add a new header `X-Authenticated-User: <username>`** before forwarding. On failure, writes a 401 directly and never calls `chain.filter()`. | The request (with the new header attached) now actually leaves the gateway process — follow it to whichever backend service the path matched. |
| **8** | `<service>/.../security/AuthenticatedUserFilter.java` + `<service>/.../controller/WhoAmIController.java` | A plain `OncePerRequestFilter` that reads `X-Authenticated-User` (defaulting to `"anonymous"` if absent) and stores it as a request attribute — **no JWT parsing, no secret, no crypto**. `WhoAmIController`'s `GET /api/<resource>/me` returns that value, proving the mechanism works end to end. | This is the end of the chain — full detail on why this design was chosen is in Section 5. |

### Tour B — "A client enrolls a student in a course"

```
FILE 1  ─▶  FILE 2  ─▶  FILE 3  ─▶  FILE 4  ─▶  FILE 5  ─▶  FILE 6  ─▶  FILE 7
```

| # | File | What happens here | Why it's next |
|---|---|---|---|
| **1** | `enrollment-service/.../controller/EnrollmentController.java` | `POST /api/enrollments` receives `{studentId, courseId}`. | Delegates immediately to the service layer. |
| **2** | `enrollment-service/.../service/EnrollmentService.java` | `create()` inserts an `Enrollment` row as `PENDING_VALIDATION`, inserts a matching 1:1 `EnrollmentValidation` tracking row (`studentValid`/`courseValid` both `null`), then calls the Kafka producer, and returns **`202 Accepted` immediately** — it does not wait for any reply. | It published an event — follow the event, not the HTTP response. |
| **3** | `enrollment-service/.../kafka/EnrollmentRequestedProducer.java` | Publishes `EnrollmentRequestedEvent{enrollmentId, studentId, courseId, requestedAt}` to Kafka topic **`enrollment.requested`**, keyed by `enrollmentId`. | Two independent services are listening on this topic — read both. |
| **4a** | `student-service/.../kafka/EnrollmentRequestedListener.java` → `ValidationResultProducer.java` | Checks `studentRepository.existsById(studentId)`, then publishes `ValidationResultEvent{enrollmentId, valid, reason, source:"student-service"}` to topic **`student.validation.result`**. | Runs in parallel with 4b — different service, different thread, same trigger. |
| **4b** | `course-service/.../kafka/EnrollmentRequestedListener.java` → `ValidationResultProducer.java` | Checks `courseRepository.existsById(courseId)`, publishes to topic **`course.validation.result`**. | Both replies converge back on enrollment-service. |
| **5** | `enrollment-service/.../kafka/StudentValidationResultListener.java` and `CourseValidationResultListener.java` | Each calls `EnrollmentSagaService.applyStudentValidationResult(...)` / `applyCourseValidationResult(...)`. | The saga's decision logic lives one file over. |
| **6** | `enrollment-service/.../service/EnrollmentSagaService.java` + `repository/EnrollmentValidationRepository.java` | Each listener updates **only its own column** via a targeted `@Modifying` JPQL update (not load-mutate-save — this specifically avoids a lost-update race between the two concurrent Kafka consumer threads, a real bug documented in the base guide). Once *both* columns are non-null, `resolveIfComplete()` sets the `Enrollment`'s status to `CONFIRMED` or `REJECTED` and publishes the outcome via `EnrollmentOutcomeProducer` to **`enrollment.confirmed`** or **`enrollment.rejected`**. | The outcome event has one more listener — the last stop. |
| **7** | `notification-service/.../kafka/EnrollmentOutcomeListener.java` → `service/EnrollmentOutcomeService.java` | On `CONFIRMED`: writes an EMAIL + SMS `Notification` (plus matching `EmailLog`/`SmsLog`, simulated `SENT`). On `REJECTED`: writes a single EMAIL with the saga's combined rejection reason. | End of the flow. The client, meanwhile, has been polling `GET /api/enrollments/{id}` until `statusId` changes from `1` to `2` or `3`. |

---

## 4. Kafka Topics Reference

| Topic | Producer | Consumer(s) | Payload |
|---|---|---|---|
| `enrollment.requested` | enrollment-service | student-service, course-service | `EnrollmentRequestedEvent{enrollmentId, studentId, courseId, requestedAt}` |
| `student.validation.result` | student-service | enrollment-service | `ValidationResultEvent{enrollmentId, valid, reason, source, checkedAt}` |
| `course.validation.result` | course-service | enrollment-service | `ValidationResultEvent{enrollmentId, valid, reason, source, checkedAt}` |
| `enrollment.confirmed` | enrollment-service | notification-service | `EnrollmentOutcomeEvent{enrollmentId, studentId, courseId, status:"CONFIRMED", occurredAt}` |
| `enrollment.rejected` | enrollment-service | notification-service | same shape, `status:"REJECTED"`, `reason` set |

Broker: single node, KRaft mode (no Zookeeper), `docker-compose.yml`, external listener
`localhost:9095`. Payloads are JSON strings (Jackson `ObjectMapper`, hand-serialized) inside plain
`String` Kafka records — not a Spring-Kafka JSON serializer.

---

## 5. Authentication — Full Mechanics: How a Token Issued at the Gateway Authenticates Calls on Other Microservices

This is the most important part of the project to understand precisely, so it's spelled out here
step by step, file by file, with the actual code.

### 5.1 The core idea in one sentence

**Only the gateway ever sees a password or a JWT. Every backend microservice trusts a plain text
header (`X-Authenticated-User`) that the gateway attaches after it has already done the
cryptographic work — no backend service has a JWT library, a signing secret, or Spring Security
on its classpath.**

### 5.2 Step 1 — Login (`POST /auth/login`, api-gateway)

File: `api-gateway/src/main/java/com/studentmgmt/gateway/controller/AuthController.java`

```java
@PostMapping("/auth/login")
public Mono<ResponseEntity<Object>> login(@Valid @RequestBody LoginRequest request) {
    return studentLoginClient.verify(request.getUsername(), request.getPassword())
        .map(result -> {
            if (!result.isValid())
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body("Invalid username/password, or account inactive");
            String token = jwtUtil.generateToken(result.getUsername());
            return ResponseEntity.ok().body(new LoginResponse(token));
        });
}
```

`/auth/login` is a normal WebFlux `@RestController` mapping. It is **not** one of the gateway's
proxied routes (it matches none of the four `Path=` predicates in `application.yml`), so it is
dispatched directly by Spring and **never enters the `GatewayFilterChain`** — meaning it never
runs through `GatewayAuthFilter` either. That's *why* login itself doesn't require a token: it
structurally can't, since it isn't a routed/filtered request in the first place.

### 5.3 Step 2 — Credential verification is delegated, not local

File: `api-gateway/.../client/StudentLoginClient.java` (backed by `config/WebClientConfig.java`)

The gateway does not know how to check a password. It makes one reactive, non-blocking HTTP call:

```
POST http://localhost:8081/api/student-logins/verify
Body: {"username": "...", "password": "..."}
```

This lands on **student-service**, file `service/StudentLoginService.java`:

```java
public VerifyCredentialsResponse verifyCredentials(String username, String password) {
    return studentLoginRepository.findByUsername(username)
        .filter(login -> Boolean.TRUE.equals(login.getActive()))
        .filter(login -> login.getPasswordHash().equals(password))
        .map(login -> VerifyCredentialsResponse.valid(login.getStudentId(), login.getUsername()))
        .orElseGet(VerifyCredentialsResponse::invalid);
}
```

Notes:
- The password check is a plain `String.equals()` against the seeded `password_hash` column — a
  documented simplification for this demo project, not real hashing (a production system would
  hash the incoming password with the same algorithm and compare hashes, never raw strings).
- Only rows with `is_active = TRUE` can succeed.
- This endpoint **always returns HTTP 200** with `{valid: true/false, studentId, username}` — it
  never returns a 401 itself, so the gateway's `WebClient` code just inspects the `valid` field
  rather than handling an HTTP error status.

### 5.4 Step 3 — Token creation (the only place a JWT is ever built)

File: `api-gateway/.../security/JwtUtil.java`

```java
@Component
public class JwtUtil {
    private final SecretKey signingKey;
    private final long expirationMs;

    public JwtUtil(@Value("${app.jwt.secret}") String secret,
                    @Value("${app.jwt.expiration-ms}") long expirationMs) {
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMs = expirationMs;
    }

    public String generateToken(String username) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + expirationMs);
        return Jwts.builder()
                .subject(username)
                .issuedAt(now)
                .expiration(expiry)
                .signWith(signingKey)
                .compact();
    }

    public String extractUsername(String token) {
        return parseClaims(token).getSubject();
    }

    public boolean isValid(String token) {
        try { parseClaims(token); return true; }
        catch (JwtException | IllegalArgumentException e) { return false; }
    }

    private Claims parseClaims(String token) {
        return Jwts.parser().verifyWith(signingKey).build().parseSignedClaims(token).getPayload();
    }
}
```

| Property | Value |
|---|---|
| Secret | `app.jwt.secret` in `api-gateway/src/main/resources/application.yml` → `${JWT_SECRET:centralized-gateway-auth-shared-jwt-secret-key-2026-please-rotate-me}`. **This is the only copy of the signing secret in the entire codebase** — no backend service's config has any `jwt.*` key at all. |
| Algorithm | HMAC, auto-selected by key size (`HS512`, visible in a decoded token header as `eyJhbGciOiJIUzUxMiJ9`) |
| Claims | `sub` = username **only**. No roles claim, no numeric user/student ID claim. |
| Expiry | `app.jwt.expiration-ms = 3600000` → 1 hour |

The client receives:
```json
{"token": "eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJhYXJhdi5zaGFybWEi...", "tokenType": "Bearer"}
```

### 5.5 Step 4 — Enforcement on every subsequent call

File: `api-gateway/.../security/GatewayAuthFilter.java`

```java
@Component
public class GatewayAuthFilter implements GlobalFilter, Ordered {

    @Override
    public int getOrder() { return -1; }   // runs before route-forwarding

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();
        if (path.startsWith("/auth/")) {
            return chain.filter(exchange);
        }

        String header = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (header == null || !header.startsWith("Bearer ")) {
            return reject(exchange, "Missing Authorization: Bearer <token> header");
        }

        String token = header.substring(7);
        if (!jwtUtil.isValid(token)) {
            return reject(exchange, "Invalid or expired token");
        }

        String username = jwtUtil.extractUsername(token);
        ServerHttpRequest mutatedRequest = exchange.getRequest().mutate()
                .header("X-Authenticated-User", username)
                .build();

        return chain.filter(exchange.mutate().request(mutatedRequest).build());
    }

    private Mono<Void> reject(ServerWebExchange exchange, String message) {
        exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
        // writes {"status":401,"error":"Unauthorized","message":"..."} and returns —
        // chain.filter() is never called, so the backend service is never invoked.
    }
}
```

This is a Spring Cloud Gateway `GlobalFilter` — it only executes for requests that have already
matched one of the four static routes (i.e. everything under `/api/**`). Behavior:

- **No/malformed `Authorization` header** → gateway itself writes a `401`. The request never
  leaves the gateway process.
- **Header present but `jwtUtil.isValid(token)` is false** (expired, tampered, wrong secret,
  garbage string) → same: `401` written by the gateway, backend never called.
- **Valid token** → `jwtUtil.extractUsername(token)` pulls the `sub` claim back out, and the
  filter **mutates the outgoing request** to add a brand-new header, `X-Authenticated-User:
  <username>`, before calling `chain.filter(...)` to actually forward the request to whichever
  backend the route predicate selected.

Important detail: Spring Cloud Gateway forwards the **original `Authorization` header downstream
by default too** (nothing strips it) — so it technically still arrives at the backend service.
But no backend service reads it or re-validates it; it's documented in the project as an unused
fallback in case a service ever needed full JWT claims later. The header that actually carries
identity in practice is `X-Authenticated-User`.

### 5.6 Step 5 — The backend service trusts the header, does not touch the JWT

File: `<service>/.../security/AuthenticatedUserFilter.java` — **this exact file exists,
byte-for-byte identical, in all four backend services** (only the Java package differs:
`com.studentmgmt.student.security`, `.course.security`, `.enrollment.security`,
`.notification.security`). It is not a shared library — it's copy-pasted into each module.

```java
@Component
public class AuthenticatedUserFilter extends OncePerRequestFilter {
    public static final String ATTRIBUTE_NAME = "authenticatedUser";
    private static final String ANONYMOUS = "anonymous";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                     FilterChain filterChain) throws ServletException, IOException {
        String authenticatedUser = request.getHeader("X-Authenticated-User");
        if (authenticatedUser == null || authenticatedUser.isBlank()) {
            authenticatedUser = ANONYMOUS;
        }
        request.setAttribute(ATTRIBUTE_NAME, authenticatedUser);
        log.info("Request to {} authenticated as: {}", request.getRequestURI(), authenticatedUser);
        filterChain.doFilter(request, response);
    }
}
```

There is **no JWT library dependency, no signing secret, no `SecurityConfig`, and no Spring
Security** anywhere in any of the four backend services' `pom.xml` files — grepping the whole repo
confirms it. This filter does exactly one thing: read a plain string header, default it to
`"anonymous"` if it's missing, and stash it as a request attribute for controllers to read.

File: `<service>/.../controller/WhoAmIController.java` (also duplicated per service) —
`GET /api/<resource>/me` simply returns `{"authenticatedUser": "<value of the request attribute>"}`.
This is the concrete, callable proof that identity made it all the way from the login call to a
completely different microservice without that service ever seeing a JWT.

### 5.7 The trade-off, made explicit and demonstrated live

Because backend services enforce **nothing on their own**, a direct request to a backend port
bypasses authentication entirely:

```
GET http://localhost:8081/api/students/me      (straight to student-service, no gateway, no token)
→ 200 OK
  {"authenticatedUser": "anonymous"}
```

No crash, no rejection — `AuthenticatedUserFilter` just found no header and defaulted. This is not
a bug; it's the defining trade-off of centralizing authentication at the gateway: **the model is
only as strong as the guarantee that the gateway is the sole network entry point.** A real
deployment pairs this with network-level restrictions (firewall rules / private subnet / service
mesh policy) so that ports 8081–8084 are simply unreachable from outside the network the gateway
lives on. The alternative — every service independently validating the same shared-secret JWT —
is the "decentralized" model used by a sibling project (`SPRINGB-student-mgmt-async-CQRS-pattern-kafka`),
which trades gateway-simplicity for secret-sprawl across four config files instead of one.

### 5.8 End-to-end example, captured from an actual run

```
1) POST http://localhost:8080/auth/login
   {"username":"aarav.sharma","password":"hash_9f2b1c0a"}
   → {"token":"eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJhYXJhdi5zaGFybWEi...","tokenType":"Bearer"}

2) GET http://localhost:8080/api/students/me
   Authorization: Bearer <token>
   → {"authenticatedUser":"aarav.sharma"}

3) GET http://localhost:8080/api/courses/me         (same token, totally different service)
   → {"authenticatedUser":"aarav.sharma"}

4) GET http://localhost:8080/api/enrollments/me     (same token, a third service)
   → {"authenticatedUser":"aarav.sharma"}

5) GET http://localhost:8080/api/notifications/me   (same token, a fourth service)
   → {"authenticatedUser":"aarav.sharma"}
```

One login, one token, one gateway that did the cryptographic work exactly once — four independent
microservices all correctly reporting the same identity, none of them ever having parsed a JWT.

### 5.9 Quick-reference table

| Concept | File |
|---|---|
| Gateway routes + JWT secret/expiry config | `api-gateway/src/main/resources/application.yml` |
| Login endpoint | `api-gateway/.../controller/AuthController.java` |
| Gateway → student-service credential check call | `api-gateway/.../client/StudentLoginClient.java` |
| Credential check, source of truth | `student-service/.../service/StudentLoginService.java` |
| Token generation/validation | `api-gateway/.../security/JwtUtil.java` |
| Token enforcement + header injection | `api-gateway/.../security/GatewayAuthFilter.java` |
| Backend service reading the identity header | `<service>/.../security/AuthenticatedUserFilter.java` |
| Proof-of-concept endpoint per service | `<service>/.../controller/WhoAmIController.java` |

---

## 6. Full Module & File Inventory

### api-gateway (port 8080) — router + the only authentication choke point
```
ApiGatewayApplication.java              main class
client/StudentLoginClient.java          calls student-service to verify credentials
config/WebClientConfig.java             WebClient bean used by StudentLoginClient
controller/AuthController.java          POST /auth/login
dto/LoginRequest.java, LoginResponse.java
dto/VerifyCredentialsRequest.java, VerifyCredentialsResponse.java
security/GatewayAuthFilter.java         validates JWT, injects X-Authenticated-User
security/JwtUtil.java                   generate/validate JWT (the only secret in the system)
```
No entities, no repositories, no Kafka here — this module is purely routing + auth.

### student-service (port 8081, StudentDB) — credential owner
```
StudentServiceApplication.java
controller/StudentController.java, StudentAddressController.java, StudentDocumentController.java
controller/StudentLoginController.java  POST /api/student-logins/verify (internal, called by gateway)
controller/WhoAmIController.java        GET /api/students/me
entity/Student.java, StudentAddress.java, StudentDocument.java, StudentLogin.java
event/EnrollmentRequestedEvent.java, ValidationResultEvent.java
kafka/EnrollmentRequestedListener.java  consumes enrollment.requested
kafka/ValidationResultProducer.java     produces student.validation.result
repository/*Repository.java
security/AuthenticatedUserFilter.java
service/StudentService.java, StudentAddressService.java, StudentDocumentService.java, StudentLoginService.java
```

### course-service (port 8082, CourseDB)
```
CourseServiceApplication.java
controller/CourseController.java, CourseCategoryController.java, CourseFacultyController.java, CourseScheduleController.java
controller/WhoAmIController.java
entity/Course.java, CourseCategory.java, CourseFaculty.java, CourseSchedule.java
kafka/EnrollmentRequestedListener.java  consumes enrollment.requested
kafka/ValidationResultProducer.java     produces course.validation.result
repository/*Repository.java
security/AuthenticatedUserFilter.java
service/*.java
```

### enrollment-service (port 8083, EnrollmentDB) — the saga orchestrator
```
EnrollmentServiceApplication.java
controller/EnrollmentController.java, EnrollmentStatusController.java, PaymentController.java
controller/WhoAmIController.java
entity/Enrollment.java, EnrollmentStatus.java, EnrollmentValidation.java, Payment.java
kafka/EnrollmentRequestedProducer.java       produces enrollment.requested
kafka/StudentValidationResultListener.java   consumes student.validation.result
kafka/CourseValidationResultListener.java    consumes course.validation.result
kafka/EnrollmentOutcomeProducer.java         produces enrollment.confirmed / enrollment.rejected
repository/EnrollmentValidationRepository.java   targeted single-column JPQL updates (race-condition fix)
repository/*Repository.java
security/AuthenticatedUserFilter.java
service/EnrollmentService.java          create() → PENDING_VALIDATION + publish enrollment.requested
service/EnrollmentSagaService.java      decides CONFIRMED/REJECTED once both replies arrive
service/EnrollmentStatusService.java, PaymentService.java
```

### notification-service (port 8084, NotificationDB) — terminal consumer
```
NotificationServiceApplication.java
controller/NotificationController.java, EmailLogController.java, SmsLogController.java
controller/WhoAmIController.java
entity/Notification.java, EmailLog.java, SmsLog.java
kafka/EnrollmentOutcomeListener.java    consumes enrollment.confirmed AND enrollment.rejected
repository/*Repository.java
security/AuthenticatedUserFilter.java
service/EnrollmentOutcomeService.java   writes Notification + EmailLog/SmsLog rows (simulated SENT)
```

---

## 7. Summary

- **Start here:** MySQL → run the 4 SQL scripts → `docker compose up -d` (Kafka) → the four
  backend services → `api-gateway` last. Clients only ever call port `8080`.
- **Read the code in request order, not folder order** — Section 3's two tours cover the login +
  authenticated-CRUD path and the Kafka enrollment saga, which together touch nearly every file
  that matters.
- **Authentication is centralized:** the gateway is the only component that ever sees a password
  or a JWT. It authenticates once per request and forwards a plain `X-Authenticated-User` header;
  every backend service trusts that header verbatim, with zero cryptographic verification of its
  own. This makes each backend service simpler (one tiny filter instead of a full JWT stack) at
  the cost of making the gateway a hard security boundary — bypassing it (calling a backend port
  directly) bypasses authentication entirely, by design, and must be prevented at the network
  layer in any real deployment.
