# Student Management Microservices — OpenFeign Variant

A beginner-friendly walkthrough of how this variant was built: the same
four-microservice student enrollment system, but `enrollment-service` reaches
its peers with **Spring Cloud OpenFeign** instead of `RestTemplate`.

Project location: `Documents/Java_Projects/SPRINGB-student-mgmt-sync-repository-OpenFeign`

This is a sibling of two other projects in this workspace that all implement
the *exact same business logic*, differing only in how `enrollment-service`
talks to `student-service`, `course-service`, and `notification-service`:

| Variant | HTTP client |
|---|---|
| `SPRINGB-student-mgmt-sync-repository-RESTTEMPLATE` | `RestTemplate` |
| **`SPRINGB-student-mgmt-sync-repository-OpenFeign`** (this one) | **Spring Cloud OpenFeign** |
| `SPRINGB-student-mgmt-sync-repository-WebClient` | `WebClient` + `.block()` |

All three remain **synchronous** — that requirement never changed. What
changed is how much boilerplate is required to make a synchronous call, and
how the client code reads.

---

## 1. What actually changed

Only `enrollment-service` was touched. `student-service`, `course-service`,
and `notification-service` are byte-for-byte identical to the RestTemplate
variant — they don't make outbound calls to anyone, so there was nothing in
them to migrate.

Inside `enrollment-service`:

| File | RestTemplate variant | OpenFeign variant |
|---|---|---|
| `config/RestTemplateConfig.java` | Defined the shared `RestTemplate` bean | **Deleted** — Feign clients don't need a shared bean; Spring Cloud OpenFeign creates one dynamic proxy per `@FeignClient` interface |
| `client/StudentClient.java` | Built URLs and called `restTemplate.getForObject(...)` directly | Now a thin wrapper that delegates to `StudentFeignClient` and translates `FeignException` → `PeerServiceException` |
| `client/StudentFeignClient.java` | *(didn't exist)* | **New** — a plain interface describing student-service's endpoints; Spring generates the implementation |
| `client/CourseClient.java` / `CourseFeignClient.java` | same pattern | same pattern |
| `client/NotificationClient.java` / `NotificationFeignClient.java` | same pattern | same pattern |
| `EnrollmentServiceApplication.java` | plain `@SpringBootApplication` | adds `@EnableFeignClients` |
| `pom.xml` | no extra dependency | adds `spring-cloud-starter-openfeign` + the `spring-cloud-dependencies` BOM |

**`EnrollmentService.java` and `PaymentService.java` were not touched at
all.** They depend on `StudentClient`/`CourseClient`/`NotificationClient` by
type, calling `.exists(id)`, `.getStudent(id)`, `.send(request)` — those
method signatures never changed, only what happens inside them. This is the
whole point of keeping a thin wrapper class between the business logic and
the transport-specific client: swapping HTTP libraries becomes a change
contained entirely inside the `client/` package.

---

## 2. The declarative contract: `@FeignClient`

The RestTemplate version builds a URL by hand every time:

```java
restTemplate.getForObject(baseUrl + "/api/students/{id}/exists", Map.class, studentId);
```

The OpenFeign version instead **declares** the endpoint as a Java interface
method, with no implementation body at all:

```java
@FeignClient(name = "student-service", url = "${services.student.base-url}")
public interface StudentFeignClient {

    @GetMapping("/api/students/{id}/exists")
    Map<String, Boolean> exists(@PathVariable("id") Long id);

    @GetMapping("/api/students/{id}")
    StudentDto getStudent(@PathVariable("id") Long id);
}
```

At startup, `@EnableFeignClients` on `EnrollmentServiceApplication` scans for
interfaces like this one and registers a dynamic proxy bean for each — Spring
generates the HTTP call, URL building, and JSON deserialisation from the
`@GetMapping`/`@PathVariable` annotations, the same annotations already
familiar from writing `@RestController` classes. There's no method body to
get wrong.

The `url = "${services.student.base-url}"` attribute is doing the same job
`baseUrl` did in the RestTemplate version — pointing at a fixed host:port
from `application.properties`, since this system doesn't use service
discovery (Eureka/Consul). If it did, `name = "student-service"` alone would
be enough, and Feign (via Spring Cloud LoadBalancer) would resolve the
address dynamically.

---

## 3. Still synchronous — just less code

A common misconception is that "Feign" or "declarative REST client" implies
something asynchronous or reactive. It doesn't. By default, a `@FeignClient`
method call is **just as blocking as `RestTemplate`** — calling
`studentFeignClient.exists(id)` parks the calling thread until student-service
responds, exactly like `restTemplate.getForObject(...)` did. The synchronous
call chain from the RestTemplate variant is identical here:

```
enrollment-service                student-service          course-service
       │  studentFeignClient.exists(id)   │                       │
       ├──────────────────────────────────►│                      │
       │◄─── {"exists": true} ─────────────┤                      │
       │                                                          │
       │  courseFeignClient.exists(id)                            │
       ├──────────────────────────────────────────────────────────►│
       │◄─── {"exists": true} ─────────────────────────────────────┤
       │
       │  (only now) save the Enrollment row
```

This was verified against the four running services:

```bash
curl -X POST http://localhost:8093/api/enrollments -d '{"studentId":999,"courseId":1}'
# -> 400 "Student does not exist: 999"   (Feign call to student-service, synchronously rejected)

curl -X POST http://localhost:8093/api/enrollments -d '{"studentId":4,"courseId":2}'
# -> 201 Created, statusId defaulted to 'Pending'

curl -X POST http://localhost:8093/api/payments -d '{"enrollmentId":9,"amount":22000.00,"paymentStatus":"Success",...}'
# -> 201 Created; enrollment status flipped to 'Active'; a synchronous Feign
#    call fetched the student's email, then a synchronous Feign call to
#    notification-service wrote a Notifications + Email_Logs row — all
#    before this response was returned
```

---

## 4. Error handling: `FeignException` instead of `RestClientException`

RestTemplate throws `RestClientException` (and subclasses like
`HttpClientErrorException`) on a failed call. Feign throws `FeignException`
(and subclasses like `FeignException.NotFound`) — both connectivity failures
and non-2xx HTTP responses land here. The wrapper classes catch it the same
way as before:

```java
public boolean exists(Long studentId) {
    try {
        Map<String, Boolean> response = studentFeignClient.exists(studentId);
        return response != null && Boolean.TRUE.equals(response.get("exists"));
    } catch (FeignException e) {
        throw new PeerServiceException("student-service",
                "Unable to verify student " + studentId + ": " + e.getMessage());
    }
}
```

`PeerServiceException` is still mapped to **502 Bad Gateway** by
`GlobalExceptionHandler`, unchanged from the RestTemplate variant — the rest
of the error-handling story (`ResourceNotFoundException` → 404,
`MethodArgumentNotValidException` → 400,
`MethodArgumentTypeMismatchException` → 400,
`DataIntegrityViolationException` → 409) is identical across all three
variants, because none of it lives in the `client/` package.

---

## 5. How SQL injection is prevented

Nothing about the SQL-injection story changes with this variant — the switch
from RestTemplate to OpenFeign only affects how `enrollment-service` talks to
*other services over HTTP*; it has no bearing on how any service talks to
*its own database*. Every repository in every service is still a
`JpaRepository` interface (Spring Data JPA-generated, always parameterised),
and every cross-reference (`student_id`, `course_id`, `enrollment_id`, etc.)
is still a `Long`, never a free-text string.

This means the same structural defense holds: a malicious string can't even
reach a repository method, because Spring MVC's parameter binding rejects it
first. Verified again on this variant:

```bash
curl "http://localhost:8091/api/students/1' OR '1'='1"
# -> 400 Bad Request
#    "Invalid value for parameter 'id': expected Long"
```

The request never got past type conversion — no SQL was built, no
repository method ran. Row counts in all four databases were confirmed
unchanged apart from the enrollments/payments/notifications this test's own
requests intentionally created.

---

## 6. Choosing between RestTemplate, OpenFeign, and WebClient

| | RestTemplate | OpenFeign | WebClient (blocking) |
|---|---|---|---|
| Style | Imperative — you write the call | Declarative — you describe the endpoint | Imperative, fluent/chained |
| Boilerplate per endpoint | Build URL string, cast response type | One interface method, no body | Build a request spec, call `.block()` |
| Extra dependency beyond `spring-boot-starter-web` | None | `spring-cloud-starter-openfeign` (+ BOM) | `spring-boot-starter-webflux` |
| Plays well with service discovery (Eureka/Consul) | Needs `@LoadBalanced` | Built-in via `name=` | Built-in via `spring-boot-starter-loadbalancer` |
| Best fit | Few, simple peer calls; no new dependency wanted | Many peer calls across many clients — the declarative style scales better | Teams already adopting reactive stacks elsewhere, or wanting one client library that supports both blocking and non-blocking usage |

For a system with exactly three peer endpoints (student, course,
notification) and no service discovery, all three are reasonable. OpenFeign
was chosen here because the interface-based contract is the clearest to read
for a beginner: the entire "API surface" `enrollment-service` depends on for
a peer is visible as a handful of method signatures in one file, with the
HTTP mechanics fully hidden.

---

## 7. Verifying the build

```bash
cd Documents/Java_Projects/SPRINGB-student-mgmt-sync-repository-OpenFeign
mvn clean package        # BUILD SUCCESS across all 4 modules
```

Then, with all four jars running, the full test pass was repeated:

- CRUD confirmed on `student-service`/`course-service`/`notification-service`
- Enrollment creation confirmed to reject invalid `studentId`/`courseId` via
  the Feign-based existence checks
- Payment creation with `paymentStatus: "Success"` confirmed to flip the
  enrollment to `Active`, fetch the student's email via
  `StudentFeignClient.getStudent()`, and call
  `NotificationFeignClient.send()` — producing a real `Notifications` +
  `Email_Logs` row
- The type-mismatch/SQL-injection-style test above
- MySQL row counts re-checked directly after every test

---

## 8. Running it yourself

```bash
cd Documents/Java_Projects/SPRINGB-student-mgmt-sync-repository-OpenFeign
mvn clean package

java -jar student-service/target/student-service.jar        # :8091
java -jar course-service/target/course-service.jar           # :8092
java -jar notification-service/target/notification-service.jar  # :8094
java -jar enrollment-service/target/enrollment-service.jar    # :8093
```

This variant shares the same four MySQL databases
(`StudentDB`/`CourseDB`/`EnrollmentDB`/`NotificationDB`) as the RestTemplate
and WebClient variants — the business data is identical across all three;
only the transport code inside `enrollment-service` differs. Run only one
variant's four services at a time (they all use the same ports:
8091/8092/8093/8094).

---

## 9. Key takeaways for a beginner

1. **"Synchronous" is about blocking behaviour, not which library you use.**
   RestTemplate, OpenFeign, and a `WebClient` call ending in `.block()` are
   all synchronous — they differ in ergonomics, not in whether the calling
   thread waits for a response.
2. **A thin wrapper class isolates a transport choice from business logic.**
   Because `EnrollmentService`/`PaymentService` depend on `StudentClient`
   (not `StudentFeignClient` directly), migrating the transport meant
   touching only the `client/` package — zero changes to business logic.
3. **Declarative clients trade a little indirection for a lot less
   boilerplate.** There's no method body to read in `StudentFeignClient` —
   you have to trust the annotations — but there's also no URL string to get
   wrong.
4. **Security posture doesn't change with the HTTP client library.** SQL
   injection resistance in this system comes entirely from how each service
   talks to *its own database* (Spring Data JPA, typed `Long` parameters),
   which has nothing to do with how `enrollment-service` talks to its peers.
