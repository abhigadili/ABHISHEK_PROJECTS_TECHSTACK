# Student Management Microservices — WebClient Variant

A beginner-friendly walkthrough of how this variant was built: the same
four-microservice student enrollment system, but `enrollment-service` reaches
its peers with **`WebClient`** instead of `RestTemplate` — kept fully
synchronous with `.block()`.

Project location: `Documents/Java_Projects/SPRINGB-student-mgmt-sync-repository-WebClient`

This is a sibling of two other projects in this workspace that all implement
the *exact same business logic*, differing only in how `enrollment-service`
talks to `student-service`, `course-service`, and `notification-service`:

| Variant | HTTP client |
|---|---|
| `SPRINGB-student-mgmt-sync-repository-RESTTEMPLATE` | `RestTemplate` |
| `SPRINGB-student-mgmt-sync-repository-OpenFeign` | Spring Cloud OpenFeign |
| **`SPRINGB-student-mgmt-sync-repository-WebClient`** (this one) | **`WebClient` + `.block()`** |

All three remain synchronous — that requirement never changed.

---

## 1. What actually changed

Only `enrollment-service` was touched — `student-service`, `course-service`,
and `notification-service` are byte-for-byte identical to the other two
variants, since they never make outbound calls.

Inside `enrollment-service`:

| File | RestTemplate variant | WebClient variant |
|---|---|---|
| `config/RestTemplateConfig.java` | Defined the shared `RestTemplate` bean | **Replaced** by `config/WebClientConfig.java`, defining a shared `WebClient.Builder` bean |
| `client/StudentClient.java` | `restTemplate.getForObject(...)` | `webClient.get().uri(...).retrieve().bodyToMono(X.class).block()` |
| `client/CourseClient.java` | same pattern | same pattern |
| `client/NotificationClient.java` | `restTemplate.postForObject(...)` | `webClient.post().uri(...).bodyValue(request).retrieve().bodyToMono(Object.class).block()` |
| `EnrollmentServiceApplication.java` | no extra annotation | no extra annotation (WebClient needs no `@Enable...`) |
| `pom.xml` | no extra dependency | adds `spring-boot-starter-webflux` (for `WebClient` itself) |

**`EnrollmentService.java` and `PaymentService.java` were not touched at
all** — same as the OpenFeign variant. They call `.exists(id)`,
`.getStudent(id)`, `.send(request)` on the same wrapper classes; only what
happens *inside* those methods changed.

---

## 2. WebClient is reactive by design — `.block()` is what makes it synchronous here

This is the one variant where the underlying library's *default* behaviour
is the opposite of what the system requires, so it's worth being explicit
about the mechanism.

`WebClient` is built for **non-blocking, reactive** pipelines. A call like:

```java
webClient.get().uri("/api/students/{id}", studentId).retrieve().bodyToMono(StudentDto.class)
```

returns a `Mono<StudentDto>` — a *description* of a future HTTP call, not
the result of one. If you returned that `Mono` directly from a method, the
caller would need to be reactive too (subscribing to it, composing more
reactive operators), and the calling thread would be freed up to do other
work while the HTTP call happens in the background — genuinely asynchronous
behaviour.

That's not what this system wants. `enrollment-service` needs to know
*right now, on this thread* whether a student exists before deciding whether
to save an `Enrollment` row. So every call in this codebase ends with:

```java
.block();
```

`.block()` subscribes to the `Mono` immediately and **parks the calling
thread** until it completes (or throws) — turning the reactive pipeline back
into an ordinary, synchronous method call from the caller's perspective.
`StudentClient.exists()` looks and behaves exactly like it did with
RestTemplate:

```java
public boolean exists(Long studentId) {
    try {
        Map<String, Boolean> response = webClient.get()
                .uri("/api/students/{id}/exists", studentId)
                .retrieve()
                .bodyToMono(Map.class)
                .block();
        return response != null && Boolean.TRUE.equals(response.get("exists"));
    } catch (WebClientException e) {
        throw new PeerServiceException("student-service", "...");
    }
}
```

**This reactive-pipeline-terminated-by-`.block()` pattern never leaves the
`client/` package.** `EnrollmentService` and `PaymentService` never see a
`Mono` — they call a plain method that returns a plain `boolean` or
`StudentDto`, exactly as they did with RestTemplate and OpenFeign.

---

## 3. The synchronous call chain — unchanged in shape

```
enrollment-service                student-service          course-service
       │  webClient...exists().block()   │                       │
       ├──────────────────────────────────►│                      │
       │◄─── {"exists": true} ─────────────┤                      │
       │                                                          │
       │  webClient...exists().block()                            │
       ├──────────────────────────────────────────────────────────►│
       │◄─── {"exists": true} ─────────────────────────────────────┤
       │
       │  (only now) save the Enrollment row
```

Verified against the four running services:

```bash
curl -X POST http://localhost:8093/api/enrollments -d '{"studentId":999,"courseId":1}'
# -> 400 "Student does not exist: 999"

curl -X POST http://localhost:8093/api/enrollments -d '{"studentId":5,"courseId":3}'
# -> 201 Created, statusId defaulted to 'Pending'

curl -X POST http://localhost:8093/api/payments -d '{"enrollmentId":10,"amount":18000.00,"paymentStatus":"Success",...}'
# -> 201 Created; enrollment flipped to 'Active'; a blocking WebClient call
#    fetched the student's email, then a blocking WebClient call to
#    notification-service wrote a Notifications + Email_Logs row — all
#    before this response returned
```

---

## 4. Configuring timeouts on a non-blocking client

RestTemplate's builder exposes `.connectTimeout()`/`.readTimeout()`
directly. WebClient's timeout configuration lives one layer down, on the
underlying Reactor Netty `HttpClient` that backs its connector:

```java
@Bean
public WebClient.Builder webClientBuilder() {
    HttpClient httpClient = HttpClient.create()
            .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 3000)
            .doOnConnected(conn -> conn.addHandlerLast(new ReadTimeoutHandler(5, TimeUnit.SECONDS)));

    return WebClient.builder()
            .clientConnector(new ReactorClientHttpConnector(httpClient));
}
```

This is more ceremony than RestTemplate's builder for the same outcome — a
direct consequence of WebClient being designed around a fully configurable
reactive transport rather than a single blocking `HttpURLConnection`-style
client.

---

## 5. Error handling: `WebClientException` instead of `RestClientException`

Where RestTemplate throws `RestClientException` and Feign throws
`FeignException`, WebClient throws `WebClientException` (and subclasses like
`WebClientResponseException` for non-2xx responses, or
`WebClientRequestException` for connection failures) — surfaced by
`.block()` re-throwing whatever error terminated the reactive pipeline. The
wrapper classes catch it the same way as the other two variants:

```java
} catch (WebClientException e) {
    throw new PeerServiceException("student-service", "Unable to verify student " + studentId + ": " + e.getMessage());
}
```

`PeerServiceException` is still mapped to 502 Bad Gateway by
`GlobalExceptionHandler`, identical across all three variants — none of the
error-handling code outside `client/` needed to change.

---

## 6. Coexisting with `spring-boot-starter-web`

`enrollment-service`'s `pom.xml` now has **both**
`spring-boot-starter-web` (brings in Tomcat, for this service's own REST
controllers — `/api/enrollments`, `/api/payments`) **and**
`spring-boot-starter-webflux` (brings in `WebClient`, used only as an
outbound HTTP client). This is a common and fully supported combination:
Spring Boot still starts an embedded **Tomcat** servlet container for
`enrollment-service`'s own incoming requests (because `spring-boot-starter-web`
is present), while `WebClient` is used purely as a library for making
*outbound* calls — it does not turn `enrollment-service` itself into a
reactive/Netty application. This was confirmed in the startup logs:

```
Tomcat initialized with port 8093 (http)
...
Started EnrollmentServiceApplication in 21.087 seconds
```

---

## 7. How SQL injection is prevented

Identical to both other variants — swapping the HTTP client only affects how
`enrollment-service` talks to *other services*, never how any service talks
to *its own database*. Every repository is still a `JpaRepository` interface
(always parameterised by Spring Data JPA), and every cross-reference is
still a `Long`, never a free-text string. Verified again on this variant:

```bash
curl "http://localhost:8091/api/students/1' OR '1'='1"
# -> 400 Bad Request
#    "Invalid value for parameter 'id': expected Long"
```

The request never reached a repository or a SQL statement — Spring MVC's own
parameter binding rejected the malformed `Long` first. MySQL row counts were
re-checked after every test and matched exactly what the test's own CRUD
calls should have produced.

---

## 8. Verifying the build

```bash
cd Documents/Java_Projects/SPRINGB-student-mgmt-sync-repository-WebClient
mvn clean package        # BUILD SUCCESS across all 4 modules
```

Then, with all four jars running, the full test pass was repeated:

- CRUD confirmed on all three "passive" services
- Enrollment creation confirmed to reject invalid `studentId`/`courseId` via
  the WebClient-based existence checks
- Payment creation with `paymentStatus: "Success"` confirmed to flip the
  enrollment to `Active`, fetch the student's email via a blocking
  `WebClient` call, and trigger `notification-service` via another blocking
  `WebClient` call — producing a real `Notifications` + `Email_Logs` row
- The type-mismatch/SQL-injection-style test above
- MySQL row counts re-checked directly after every test

---

## 9. Running it yourself

```bash
cd Documents/Java_Projects/SPRINGB-student-mgmt-sync-repository-WebClient
mvn clean package

java -jar student-service/target/student-service.jar        # :8091
java -jar course-service/target/course-service.jar           # :8092
java -jar notification-service/target/notification-service.jar  # :8094
java -jar enrollment-service/target/enrollment-service.jar    # :8093
```

This variant shares the same four MySQL databases as the RestTemplate and
OpenFeign variants. Run only one variant's four services at a time — they
all use the same ports (8091/8092/8093/8094).

---

## 10. Choosing between RestTemplate, OpenFeign, and WebClient

See the OpenFeign variant's guide for the full three-way comparison table.
The short version for WebClient specifically: it's the right choice if this
system were expected to *grow* into a reactive/non-blocking architecture
later (e.g. a future high-throughput endpoint that genuinely benefits from
non-blocking I/O), because the same client library would support both styles
— today's `.block()`-terminated calls could be refactored into real reactive
pipelines without swapping libraries again. For a system that is, and is
expected to remain, synchronous throughout, RestTemplate or OpenFeign involve
less conceptual overhead (no `Mono`, no reactive-only exception types, no
Reactor Netty configuration) to achieve the identical behaviour.

---

## 11. Key takeaways for a beginner

1. **A library's default execution model and your code's actual behaviour
   are two different things.** WebClient defaults to non-blocking; this
   codebase is fully synchronous anyway, because every call is deliberately
   terminated with `.block()`. Always check *how a client is used*, not just
   *which client is used*, before concluding whether code is sync or async.
2. **`.block()` is a bridge, not a workaround to feel ashamed of.** Using a
   reactive client purely for its API surface, then immediately blocking on
   every call, is a legitimate and common pattern — especially when
   incrementally introducing a library team members will use reactively
   elsewhere.
3. **Swapping HTTP client libraries is a `client/`-package-only change** when
   the surrounding code depends on a stable wrapper interface rather than the
   library directly — true across all three variants in this workspace.
4. **Two starters can coexist for two different jobs.** `spring-boot-starter-web`
   (inbound, Tomcat) and `spring-boot-starter-webflux` (outbound, `WebClient`)
   living in the same `pom.xml` is not a conflict — Spring Boot resolves which
   web server to start based on what's actually needed for *incoming*
   requests.
5. **The database layer doesn't care what talks to it over HTTP.** SQL
   injection resistance in this system is entirely a property of how each
   service accesses its own database (Spring Data JPA, typed `Long`
   parameters) — completely independent of RestTemplate vs. OpenFeign vs.
   WebClient.
