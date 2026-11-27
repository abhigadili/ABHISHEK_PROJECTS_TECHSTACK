# Centralized Authentication in the API Gateway — Why and How

This is a follow-up document, added to the existing
`SPRINGB-SMgmt-async-api-gateway-pattern-kafka-Centralized-Auth` project alongside its original
guide (`202607021559_async_api_gateway_kafka_student_mgmt_guide.md`), which is left unchanged.
That guide explains the base system (four microservices, the Kafka enrollment saga, the API
Gateway's routing). This one explains a feature added on top of it: **centralized authentication
at the gateway**, and the concrete mechanism by which the four backend services access the
identity the gateway already established — without any of them touching a JWT themselves.

---

## 1. Why centralize authentication at the gateway?

There are two ways to add authentication to a microservices system that already has an API
Gateway in front of it:

**Option A — decentralized.** Every service independently validates the same shared-secret JWT
on every request (this is exactly what the separate `SPRINGB-student-mgmt-async-CQRS-pattern-kafka`
sibling project does). Each service needs the signing secret, needs its own filter, and makes its
own accept/reject decision.

**Option B — centralized (this project).** Only the gateway holds the signing secret and only the
gateway ever parses a JWT. It makes the accept/reject decision once, for the whole system, before
a request is allowed anywhere near business logic. Backend services trust a plain header the
gateway injects after it has already done the work.

Given a gateway already exists in this architecture, **B is the more natural fit**, for three
concrete reasons observed while building this:

1. **One choke point, one place to get it right.** There is exactly one signing secret, defined
   in exactly one `application.yml` (`api-gateway`'s). Rotating it, changing the algorithm, or
   adding token revocation only ever touches one module. In the decentralized model, the same
   secret has to be kept in sync across four separate `application.properties` files by hand — a
   real operational risk (a single service updated out of step silently starts rejecting or
   trusting the wrong tokens).
2. **Invalid requests never reach business logic.** In this project's `GatewayAuthFilter`, a
   missing or bad token is rejected with the response written *by the gateway itself* — the
   backend service is never even called. In the decentralized model, an unauthenticated request
   still travels the full network hop to a backend service before being rejected there.
3. **Backend services get simpler, not more complex.** Each of the four services gained exactly
   one small filter (`AuthenticatedUserFilter`) that reads a plain string header — no crypto
   library, no signing secret, no token-expiry logic duplicated four times.

The trade-off, made explicit rather than hidden: this model only protects requests that go
**through the gateway**. A backend service's own port, if reachable at all, has zero enforcement
of its own — verified live in this project (see §4, "Direct-bypass request"). In a real
deployment this is intentional and is paired with network policy / firewalling so backend service
ports are simply unreachable from outside the private network the gateway lives on. Defense in
depth (each service also validating) is what Option A gives you instead, at the cost of the
secret-sprawl problem above. **Use centralized (this project) when the gateway is trusted as the
sole network entry point; use decentralized (the CQRS sibling) when you can't guarantee that.**

---

## 2. How it works, end to end

```
                     ┌──────────────────────────────────────────┐
  client            │              api-gateway (8080)            │
  ──────────────────▶  POST /auth/login                          │
                     │    │                                      │
                     │    ▼ (WebClient — the one sync call here)  │
                     │  student-service: POST /api/student-logins/verify
                     │    │                                      │
                     │    ▼ {valid, studentId, username}          │
                     │  JwtUtil.generateToken(username)           │
  ◀──────────────────  {"token": "...", "tokenType": "Bearer"}   │
                     └──────────────────────────────────────────┘

  client                                api-gateway (8080)
  ──────────────────▶ GET /api/students/me                 │
  Authorization:      │  GatewayAuthFilter (GlobalFilter)   │
  Bearer <token>      │    1. JwtUtil.isValid(token)?        │
                     │       no  → write 401 here, STOP     │
                     │       yes → mutate request:           │
                     │             + X-Authenticated-User    │
                     │    2. forward to the routed service   │
                     │                          │             │
                     └──────────────────────────┼─────────────┘
                                                 ▼
                                    student-service (8081)
                                    AuthenticatedUserFilter reads
                                    X-Authenticated-User (no JWT
                                    parsing, no secret needed)
                                    WhoAmIController returns it
  ◀───────────────────────────────────────────── {"authenticatedUser":"aarav.sharma"}
```

### Component by component

**`student-service` — the credential owner**
- `dto/VerifyCredentialsRequest.java` / `VerifyCredentialsResponse.java` — the request/response
  shape for the new internal endpoint.
- `StudentLoginService.verifyCredentials(username, password)` — looks up `Student_Login` by
  username (reusing the existing `StudentLoginRepository.findByUsername`), checks `active` and
  compares `password_hash` with a plain `equals()` (a simplification for this demo, exactly as
  documented in the CQRS sibling's `AuthController` — a real system hashes the incoming password
  the same way and never compares raw strings).
- `POST /api/student-logins/verify` on `StudentLoginController` — **always** returns `200` with
  a `valid` boolean, never `401`, so the gateway's `WebClient` call can just inspect a field
  instead of handling this as an HTTP error.

**`api-gateway` — the only place a token is issued or verified**
- `security/JwtUtil.java` — generate/validate a JWT signed with `app.jwt.secret`
  (`application.yml`), 1-hour expiry. **This secret exists in exactly one file in the entire
  system.**
- `config/WebClientConfig.java` + `client/StudentLoginClient.java` — the one deliberate
  synchronous-style call in this whole system (implemented reactively with `Mono`, so it never
  blocks the gateway's Netty event loop), used only for the login handshake.
- `controller/AuthController.java` — `POST /auth/login`. This is a **local** WebFlux controller
  endpoint, not a proxied route — `/auth/login` matches none of the four `Path=` predicates in
  `application.yml`, so requests to it never enter the `GatewayFilterChain` at all, and therefore
  never reach `GatewayAuthFilter`. No special-casing was needed to make login itself
  unauthenticated; it falls out of how Spring Cloud Gateway dispatches requests.
- `security/GatewayAuthFilter.java` — a `GlobalFilter`. Runs for every request that *did* match a
  route (i.e. everything under `/api/**`, today). Requires `Authorization: Bearer <token>`; on
  success, adds `X-Authenticated-User: <subject>` to the request via `exchange.mutate()` **before**
  forwarding; on failure, writes a `401` JSON body directly to the reactive response and never
  calls `chain.filter()` — the backend is never invoked.

**Each backend service — trusting the header, not the token**
- `security/AuthenticatedUserFilter.java` (`OncePerRequestFilter`) — reads `X-Authenticated-User`,
  defaults to `"anonymous"` if absent, stores it as a request attribute, logs it. No JWT library,
  no secret, no crypto — just a string read off a header.
- `controller/WhoAmIController.java` — `GET /api/<resource>/me`, returns
  `{"authenticatedUser": "..."}`. This is the concrete, callable proof of the whole mechanism.
  It required **zero changes** to any existing controller: Spring MVC always prefers a literal
  path segment (`/me`) over a `{id}` path-variable mapping regardless of declaration order or
  which controller class declares which, so it's purely additive, and it needed **zero new
  gateway routes** — it's already covered by the existing `Path=/api/students/**` (etc.)
  predicates.

Spring Cloud Gateway also forwards the original `Authorization` header downstream by default (no
extra configuration) — so if a backend service ever genuinely needed full JWT claim access
(not just the username), it still could, using the same secret. That's documented here as the
available fallback, not implemented, because doing so would just recreate the CQRS sibling's
decentralized model and defeat the point of centralizing in the first place.

---

## 3. Where to look in the code

| Concept | File |
|---|---|
| Login delegation (gateway → student-service) | `api-gateway/.../client/StudentLoginClient.java` |
| Credential check (student-service, source of truth) | `student-service/.../service/StudentLoginService.java` → `verifyCredentials` |
| The only JWT secret in the system | `api-gateway/src/main/resources/application.yml` → `app.jwt.secret` |
| Token issuance | `api-gateway/.../controller/AuthController.java` |
| Token enforcement + header injection | `api-gateway/.../security/GatewayAuthFilter.java` |
| How a backend reads the identity | `<service>/.../security/AuthenticatedUserFilter.java` |
| Proof-of-concept endpoint | `<service>/.../controller/WhoAmIController.java` |

---

## 4. Full walkthrough (real output, captured from an actual run)

**1. No token — rejected at the gateway itself**
```
GET http://localhost:8080/api/students
```
```
HTTP/1.1 401 Unauthorized
{"status":401,"error":"Unauthorized","message":"Missing Authorization: Bearer <token> header"}
```

**2. Login through the gateway**
```
POST http://localhost:8080/auth/login
{"username":"aarav.sharma","password":"hash_9f2b1c0a"}
```
```json
{"token":"eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJhYXJhdi5zaGFybWEi...","tokenType":"Bearer"}
```
student-service's own log confirms the WebClient call actually landed there:
```
Request to /api/student-logins/verify authenticated as: anonymous
```
("anonymous" here is correct and expected — this specific call is the gateway's *internal*
service-to-service call, not a client request that went through `GatewayAuthFilter`. You can't
present a token before you have one.)

**3–4. The same token, through the gateway, against all four services**
```
GET http://localhost:8080/api/students/me       -> {"authenticatedUser":"aarav.sharma"}
GET http://localhost:8080/api/courses/me        -> {"authenticatedUser":"aarav.sharma"}
GET http://localhost:8080/api/enrollments/me    -> {"authenticatedUser":"aarav.sharma"}
GET http://localhost:8080/api/notifications/me  -> {"authenticatedUser":"aarav.sharma"}
```
One login. Four independent services, none of which parsed a JWT, all correctly reporting the
same identity — because the gateway did the work once and forwarded the answer.

**5. Direct-bypass request — the trade-off, demonstrated**
```
GET http://localhost:8081/api/students/me        (straight to student-service, no gateway)
```
```json
{"authenticatedUser":"anonymous"}
```
No exception, no crash — `AuthenticatedUserFilter` just found no header and defaulted, exactly as
designed. This is the concrete illustration of §1's stated trade-off: this service enforces
nothing on its own; only the gateway does.

**6. A garbage token — still rejected, correctly**
```
GET http://localhost:8080/api/courses
Authorization: Bearer not-a-real-token
```
```
HTTP/1.1 401 Unauthorized
{"status":401,"error":"Unauthorized","message":"Invalid or expired token"}
```

**7–8. The enrollment saga, run through the authenticated gateway, unaffected**
```
POST http://localhost:8080/api/enrollments
Authorization: Bearer <token>
{"studentId":2,"courseId":3}
```
```
HTTP/1.1 202 Accepted
{"enrollmentId":5,"studentId":2,"courseId":3,"statusId":1, ...}
```
```
GET http://localhost:8080/api/enrollments/5
```
```json
poll 1: {"enrollmentId":5, ..., "statusId":2, ...}
```
Resolved to `CONFIRMED` (`statusId:2`) on the first poll — the Kafka choreography saga between
the backend services never touches the gateway or either new filter, so adding centralized auth
changed nothing about it.

A scan of all five services' logs after this run found zero real errors or exceptions.

---

## 5. Summary

Centralizing authentication at the API Gateway means exactly one component in the system ever
holds a signing secret or parses a token, and exactly one component ever makes an accept/reject
decision — invalid requests stop there and never reach a backend service. The four backend
services get simpler, not more complex: a single header-reading filter replaces what would
otherwise be four separate JWT-validation implementations to keep in sync. The cost is that this
model is only as strong as the guarantee that the gateway is the sole entry point — verified here
by showing a direct request to a backend service's own port sails through unauthenticated. That's
not a bug in this implementation; it's the defining trade-off of the pattern, and it's why real
deployments pair a centralized gateway like this with network-level restrictions on backend ports.
