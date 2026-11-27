# Circuit Breaker, Retry & Saga — Concepts, Code Walkthrough & Full Project Flow

This document has three layers, deliberately kept separate:

1. **§1–§3** explain each pattern **generically** — no Spring, no Kafka, no this-project-specific code — just the problem it solves and a minimal, self-contained example, so the *idea* is clear before you look at any real implementation.
2. **§4–§6** show **exactly how this project implements each pattern**, with real code, the configuration behind it, what you should *expect* to happen, and what the actual *output* (logs, HTTP responses, database rows) looks like.
3. **§7** traces the **entire system from the literal entry point** — the `main()` method — through startup, then through a normal request, then through the full asynchronous Saga, "and then, and then," hop by hop, to the final database write.

---

## Table of Contents

1. [Why These Three Patterns Exist](#1-why-these-three-patterns-exist)
2. [Pattern: Retry — Concept & Generic Example](#2-pattern-retry--concept--generic-example)
3. [Pattern: Circuit Breaker — Concept & Generic Example](#3-pattern-circuit-breaker--concept--generic-example)
4. [Pattern: Saga — Concept & Generic Example](#4-pattern-saga--concept--generic-example)
5. [Retry — Implemented in This Project](#5-retry--implemented-in-this-project)
6. [Circuit Breaker — Implemented in This Project](#6-circuit-breaker--implemented-in-this-project)
7. [Saga — Implemented in This Project](#7-saga--implemented-in-this-project)
8. [Full Project Flow From Scratch](#8-full-project-flow-from-scratch)
9. [Expectation vs. Output — Summary Table](#9-expectation-vs-output--summary-table)

---

## 1. Why These Three Patterns Exist

All three patterns exist because of one uncomfortable fact of distributed systems: **a network call can fail in ways a local method call never can.** A local method call either runs or it doesn't. A network call can time out, half-succeed, succeed-but-the-response-gets-lost, or hang for 30 seconds before failing — and the failure might be a one-millisecond blip or a genuinely dead service five minutes into an outage. These three patterns are three different, complementary answers to "what do I do when a call to another service goes wrong?":

| Pattern | Answers |
|---|---|
| **Retry** | "Was that failure transient? Should I just try again?" |
| **Circuit Breaker** | "This dependency keeps failing — should I stop calling it for a while?" |
| **Saga** | "I can't wrap this multi-step, multi-database operation in one transaction — how do I keep it consistent anyway?" |

They're complementary, not competing — this project uses Retry *inside* a Circuit Breaker (§6.3) and Retry *inside* a Saga step (§7) at the same time.

---

## 2. Pattern: Retry — Concept & Generic Example

**The idea:** if an operation fails with an error that *might* be temporary, automatically try it again — usually a small, limited number of times, usually waiting a little longer between each attempt ("backoff") — before finally giving up and reporting failure.

**Real-world analogy:** calling a friend and getting a busy signal. You don't conclude they've vanished forever after one busy signal — you hang up and try again in a minute, maybe wait a bit longer if it's busy again, and only after several tries do you give up and leave a message instead.

### 2.1 Generic example (no frameworks, no Spring, no Kafka)

```java
class UnreliableService {
    private int callCount = 0;

    String call() {
        callCount++;
        if (callCount < 3) {
            throw new RuntimeException("Temporary network glitch (attempt " + callCount + ")");
        }
        return "Success";
    }
}

class RetryExample {
    public static void main(String[] args) throws InterruptedException {
        UnreliableService service = new UnreliableService();
        int maxAttempts = 5;
        long delayMs = 500;

        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                String result = service.call();
                System.out.println("Succeeded on attempt " + attempt + ": " + result);
                return; // done — stop retrying
            } catch (RuntimeException e) {
                System.out.println("Attempt " + attempt + " failed: " + e.getMessage());
                if (attempt == maxAttempts) {
                    System.out.println("Giving up after " + maxAttempts + " attempts.");
                    throw e;
                }
                Thread.sleep(delayMs * attempt); // linear backoff: 500ms, 1000ms, 1500ms...
            }
        }
    }
}
```

**Expected output** (this exact service fails twice, then succeeds on attempt 3):

```
Attempt 1 failed: Temporary network glitch (attempt 1)
Attempt 2 failed: Temporary network glitch (attempt 2)
Succeeded on attempt 3: Success
```

### 2.2 The three decisions every Retry implementation has to make

| Decision | Options | What this project chose |
|---|---|---|
| **How many attempts?** | Too few → gives up on genuinely-transient failures. Too many → wastes time before eventually failing anyway. | 3 attempts (§5) |
| **How long to wait between attempts?** | Fixed delay (simple) vs. exponential backoff (spreads retries out, gives the dependency more breathing room the longer it's struggling) | Exponential backoff, ×2 multiplier (§5) |
| **Which failures are worth retrying?** | Retrying a "the request was invalid" error is pointless — it'll fail identically every time. Only retry errors that are plausibly *transient*. | Only `IllegalStateException` (wrapping Kafka send failures) — never a validation error (§5) |

---

## 3. Pattern: Circuit Breaker — Concept & Generic Example

**The idea:** if a dependency has failed *repeatedly and recently*, stop calling it altogether for a while — reject calls immediately, without even attempting them — instead of letting every new request wait out a timeout against something that's clearly not working. After a cool-down period, cautiously let a few test calls through to see if it's recovered.

**Real-world analogy:** an electrical circuit breaker. One overloaded appliance doesn't just fail quietly — enough current flowing wrong trips the breaker, cutting power to the whole circuit immediately, protecting everything else on it, until a person resets it.

### 3.1 The three states

```
                    enough recent calls failed
        ┌──────────────────────────────────────────┐
        │                                            ▼
   ┌─────────┐                                  ┌─────────┐
   │ CLOSED  │                                  │  OPEN   │
   │ (normal,│                                  │(rejects │
   │ calls go│                                  │ instantly,
   │ through)│◀─────────────────────────────────│ never   │
   └─────────┘   enough trial calls succeeded    │ calling │
        ▲        during HALF_OPEN                │ the dep)│
        │                                        └────┬────┘
        │                                             │
        │                                  reset-timeout has elapsed
        │              ┌─────────────┐                │
        └──────────────│  HALF_OPEN  │◀───────────────┘
       any trial call  │ (a few test │
       fails → back    │ calls let   │
       to OPEN         │ through)    │
                        └─────────────┘
```

### 3.2 Generic example (no frameworks)

```java
enum State { CLOSED, OPEN, HALF_OPEN }

class SimpleCircuitBreaker {
    private State state = State.CLOSED;
    private int failureCount = 0;
    private final int failureThreshold = 3;
    private long openedAtMillis;
    private final long resetTimeoutMs = 5000;

    String call(java.util.function.Supplier<String> dependencyCall) {
        if (state == State.OPEN) {
            boolean coolDownElapsed = System.currentTimeMillis() - openedAtMillis > resetTimeoutMs;
            if (coolDownElapsed) {
                state = State.HALF_OPEN;               // give it one chance
            } else {
                throw new RuntimeException("Circuit OPEN — call rejected, dependency not even attempted");
            }
        }
        try {
            String result = dependencyCall.get();      // the real call only happens here
            failureCount = 0;
            state = State.CLOSED;                       // success → fully reset
            return result;
        } catch (RuntimeException e) {
            failureCount++;
            if (state == State.HALF_OPEN || failureCount >= failureThreshold) {
                state = State.OPEN;                      // trip (or re-trip) the breaker
                openedAtMillis = System.currentTimeMillis();
            }
            throw e;
        }
    }
}
```

**Expected output**, calling this against a dependency that always throws:

```
call 1 → RuntimeException from dependency        (failureCount=1, state=CLOSED)
call 2 → RuntimeException from dependency        (failureCount=2, state=CLOSED)
call 3 → RuntimeException from dependency        (failureCount=3 >= threshold → state=OPEN)
call 4 → RuntimeException "Circuit OPEN — call rejected, dependency not even attempted"
         (the dependency's code never even runs this time — that's the whole point)
call 5 (after 5+ seconds) → HALF_OPEN trial → still fails → back to OPEN
```

### 3.3 Circuit Breaker vs. Retry — a common point of confusion

They look similar (both react to failures) but solve *different* problems and are usually used **together**, not instead of each other:

| | Retry | Circuit Breaker |
|---|---|---|
| Reacts to | A single call's failure | A *pattern* of failures over many calls |
| Typical timescale | Milliseconds to seconds (within one logical operation) | Seconds to minutes (protecting future operations) |
| What it changes | Tries the SAME call again | Stops attempting the call AT ALL for a while |
| Protects | The caller getting a slow/failed answer | The dependency from being hammered further, and the caller's own threads from piling up waiting |

---

## 4. Pattern: Saga — Concept & Generic Example

**The idea:** when one "transaction" needs to touch multiple databases owned by multiple services, you can't wrap it in one ACID `BEGIN...COMMIT` (each database only knows how to commit its own local transaction). A Saga instead breaks the work into a sequence of **local transactions**, each one triggered by the previous step's outcome — with explicit logic for what to do if a later step fails (a **compensating action**, not an automatic rollback, because there's nothing left to roll back once a step has already committed).

**Real-world analogy:** booking a trip that needs a flight AND a hotel room, sold by two unrelated companies. There's no single "trip transaction" spanning both companies' systems. You book the flight (step 1, commits immediately, irreversible-by-default). Then you book the hotel (step 2). If the hotel booking fails, you don't get an automatic undo — you have to explicitly *cancel the flight* (the compensating action) to end up consistent.

### 4.1 Generic example — choreography style (no frameworks, no Kafka — just events as plain method calls to keep the shape visible)

```java
// Each "service" publishes an event; each interested service reacts independently.
// No central coordinator tells anyone what to do — that's what makes this
// CHOREOGRAPHY rather than ORCHESTRATION.

class TripBookingSaga {

    void requestTrip(String tripId) {
        System.out.println(tripId + ": trip requested — booking flight and hotel in parallel");
        flightService.bookFlight(tripId);   // publishes FlightBooked or FlightBookingFailed
        hotelService.bookHotel(tripId);     // publishes HotelBooked or HotelBookingFailed
    }

    // Called when EITHER event arrives — order is not guaranteed
    void onFlightBooked(String tripId) {
        bookingState.put(tripId, "flight", true);
        resolveIfBothArrived(tripId);
    }
    void onFlightBookingFailed(String tripId) {
        bookingState.put(tripId, "flight", false);
        resolveIfBothArrived(tripId);
    }
    void onHotelBooked(String tripId) {
        bookingState.put(tripId, "hotel", true);
        resolveIfBothArrived(tripId);
    }
    void onHotelBookingFailed(String tripId) {
        bookingState.put(tripId, "hotel", false);
        resolveIfBothArrived(tripId);
    }

    void resolveIfBothArrived(String tripId) {
        if (!bookingState.hasBothReplies(tripId)) {
            return; // still waiting on the other reply — whichever arrives first just stops here
        }
        if (bookingState.bothSucceeded(tripId)) {
            System.out.println(tripId + ": TRIP CONFIRMED");
        } else {
            System.out.println(tripId + ": TRIP FAILED — issuing compensating actions");
            if (bookingState.get(tripId, "flight")) {
                flightService.cancelFlight(tripId);   // COMPENSATING ACTION — undo the side effect explicitly
            }
            if (bookingState.get(tripId, "hotel")) {
                hotelService.cancelHotel(tripId);      // COMPENSATING ACTION
            }
        }
    }
}
```

**Expected output — happy path** (both succeed, hotel replies first):

```
TRIP-001: trip requested — booking flight and hotel in parallel
TRIP-001: hotel booked, still waiting on flight reply
TRIP-001: flight booked, both replies in → TRIP CONFIRMED
```

**Expected output — one leg fails** (flight fails, hotel already succeeded):

```
TRIP-001: trip requested — booking flight and hotel in parallel
TRIP-001: flight booking FAILED (no seats), still waiting on hotel reply
TRIP-001: hotel booked, both replies in → TRIP FAILED — issuing compensating actions
TRIP-001: cancelling hotel booking (compensating action)
```

Notice: nothing "rolled back" — the hotel booking genuinely happened and genuinely had to be explicitly cancelled afterward. That's the fundamental difference from an ACID transaction.

---

## 5. Retry — Implemented in This Project

**Classes:** `ValidationResultProducer` (student-service, course-service), `EnrollmentRequestedProducer` and `EnrollmentOutcomeProducer` (enrollment-service).

**Real dependency being protected:** the Kafka broker — specifically, the moment a message is actually sent.

### 5.1 The code

```java
// student-service/src/main/java/com/studentmgmt/student/kafka/ValidationResultProducer.java
@Component
public class ValidationResultProducer {

    private static final String RETRY_INSTANCE = "kafkaPublish";

    @Retry(name = RETRY_INSTANCE, fallbackMethod = "publishFallback")
    public void publish(ValidationResultEvent event) {
        try {
            String payload = objectMapper.writeValueAsString(event);
            kafkaTemplate.send(topic, String.valueOf(event.getEnrollmentId()), payload)
                    .get(3, TimeUnit.SECONDS);   // turns the async send into a call that can THROW here
            log.info("Published to {}: enrollmentId={}, valid={}", topic, event.getEnrollmentId(), event.isValid());
        } catch (Exception e) {
            throw new IllegalStateException("Failed to publish validation result to Kafka", e);
        }
    }

    private void publishFallback(ValidationResultEvent event, Throwable t) {
        log.error("Giving up publishing validation result for enrollmentId={} after all retry attempts: {}",
                event.getEnrollmentId(), t.getMessage());
    }
}
```

### 5.2 The configuration

```properties
# student-service/src/main/resources/application.properties
resilience4j.retry.instances.kafkaPublish.max-attempts=3
resilience4j.retry.instances.kafkaPublish.wait-duration=500ms
resilience4j.retry.instances.kafkaPublish.enable-exponential-backoff=true
resilience4j.retry.instances.kafkaPublish.exponential-backoff-multiplier=2
resilience4j.retry.instances.kafkaPublish.retry-exceptions=java.lang.IllegalStateException
```

### 5.3 Expectations vs. output

**Scenario A — Kafka briefly unreachable, then recovers:**

| | |
|---|---|
| **Expectation** | The caller (`EnrollmentRequestedListener`) never sees an exception — `publish()` just takes a little longer than usual and returns normally. |
| **What actually happens** | Attempt 1 fails at t=0ms → wait 500ms → attempt 2 fails at t=500ms → wait 1000ms (500×2 backoff) → attempt 3 succeeds at t=1500ms → method returns |
| **Log output** | `INFO ... Published to student.validation.result: enrollmentId=37, valid=true` — one single success line; the two failed attempts are NOT logged individually by this code (Resilience4j's own retry-event listener would show them at DEBUG level via `/actuator/retryevents`) |

**Scenario B — Kafka is genuinely down for longer than all 3 attempts:**

| | |
|---|---|
| **Expectation** | The enrollment-side validation reply for this event never arrives; the enrollment stays in `PENDING_VALIDATION` forever unless a real system adds a reconciliation sweep (a known, documented simplification of this project). |
| **What actually happens** | 3 attempts, all fail, `publishFallback()` runs instead of the exception propagating |
| **Log output** | `ERROR ... Giving up publishing validation result for enrollmentId=37 after all retry attempts: <exception message>` |

**Try it yourself:** stop the Kafka container (`docker compose stop kafka`) after creating an enrollment but before the validation Kafka messages are consumed, wait ~2 seconds, then check `enrollment-service`'s `Enrollment_Validation` table — it stays with both columns `NULL`, proving the message never got through.

> **⚠️ The self-invocation gotcha, concretely:** `EnrollmentOutcomeProducer` needs to publish to two different topics (`enrollment.confirmed` / `enrollment.rejected`). The WRONG way is one `@Retry`-annotated **private** `send(topic, event)` helper called from two public methods — Spring AOP cannot proxy private methods, and even if it were public, calling it from another method in the *same* class bypasses the proxy (self-invocation), so `@Retry` would silently do nothing. The actual code instead gives `publishConfirmed()` and `publishRejected()` their own independent `@Retry` annotations, each calling a small *unannotated* private `send()` helper:
> ```java
> @Retry(name = RETRY_INSTANCE, fallbackMethod = "publishConfirmedFallback")
> public void publishConfirmed(EnrollmentOutcomeEvent event) { send(confirmedTopic, event); }
>
> @Retry(name = RETRY_INSTANCE, fallbackMethod = "publishRejectedFallback")
> public void publishRejected(EnrollmentOutcomeEvent event) { send(rejectedTopic, event); }
> ```

---

## 6. Circuit Breaker — Implemented in This Project

**Classes:** `StudentServiceClient`, `CourseServiceClient` (enrollment-service) — two *independent* breakers guarding two *independent* dependencies.

**Real dependency being protected:** a plain synchronous HTTP call from enrollment-service to student-service/course-service, used only by `GET /api/enrollments/{id}/details`.

### 6.1 The code

```java
// enrollment-service/src/main/java/com/studentmgmt/enrollment/client/StudentServiceClient.java
@Component
public class StudentServiceClient {

    @CircuitBreaker(name = "studentServiceClient", fallbackMethod = "getStudentFallback")
    public StudentSummary getStudent(Long studentId) {
        return restTemplate.getForObject(studentServiceUrl + "/api/students/{id}", StudentSummary.class, studentId);
    }

    private StudentSummary getStudentFallback(Long studentId, Throwable t) {
        log.warn("Circuit breaker fallback: student-service unavailable for studentId={} ({})", studentId, t.toString());
        return StudentSummary.fallback(studentId);  // {"firstName":"Unavailable", "fromFallback":true, ...}
    }
}
```

`RestTemplateConfig` deliberately sets short timeouts — **this matters more than it looks**:

```java
@Bean
public RestTemplate restTemplate(RestTemplateBuilder builder) {
    return builder.connectTimeout(Duration.ofSeconds(2)).readTimeout(Duration.ofSeconds(2)).build();
}
```

Without a short timeout, a hung dependency could block each call for the OS's default TCP timeout (potentially minutes) — far too slow for the circuit breaker's failure count to accumulate in any demoable time, and exactly the kind of thread-pool-exhaustion risk circuit breakers exist to prevent in the first place.

### 6.2 The configuration

```properties
resilience4j.circuitbreaker.instances.studentServiceClient.sliding-window-size=5
resilience4j.circuitbreaker.instances.studentServiceClient.minimum-number-of-calls=5
resilience4j.circuitbreaker.instances.studentServiceClient.failure-rate-threshold=50
resilience4j.circuitbreaker.instances.studentServiceClient.wait-duration-in-open-state=10s
resilience4j.circuitbreaker.instances.studentServiceClient.permitted-number-of-calls-in-half-open-state=2
resilience4j.circuitbreaker.instances.studentServiceClient.automatic-transition-from-open-to-half-open-enabled=true
```

### 6.3 Expectations vs. output

**Scenario A — student-service is healthy:**

| | |
|---|---|
| **Expectation** | Every call to `getStudent()` reaches the real service and returns real data; the breaker sits in CLOSED and is invisible in normal operation. |
| **Output** | `GET /api/enrollments/1/details` → `{"student":{"firstName":"Aarav","lastName":"Sharma",...},"course":{...}}` |

**Scenario B — student-service is stopped:**

```bash
# terminal 1
cd student-service && (Ctrl+C to stop it)

# terminal 2 — call the details endpoint 5 times in a row
for i in 1 2 3 4 5; do
  curl -s http://localhost:8110/api/enrollments/1/details -H "Authorization: Bearer $TOKEN"; echo
done
```

| Call # | Expectation | What you actually see |
|---|---|---|
| 1–4 | Each takes ~2 seconds (the connect timeout), then falls back | `{"student":{"firstName":"Unavailable","lastName":"(student-service is down)","fromFallback":true},...}` — but SLOW (≈2s each) |
| 5th and beyond, once 5 calls have been observed with ≥50% failing | Breaker trips OPEN — fails INSTANTLY, no 2-second wait | Same fallback JSON body, but now returned in a few **milliseconds** — the real call to student-service never happens |

Confirm the state directly:

```bash
curl http://localhost:8113/actuator/health | python3 -m json.tool
# → look for components.circuitBreakers.details.studentServiceClient.status: "CIRCUIT_OPEN"
```

Restart `student-service`, wait 10 seconds (`wait-duration-in-open-state`), call `/details` again — this is a HALF_OPEN trial call; if it succeeds, the breaker closes and subsequent calls go back to being real, full-speed calls.

---

## 7. Saga — Implemented in This Project

**Classes:** `EnrollmentService` (starts the saga), `EnrollmentRequestedListener` in student-service & course-service (the two parallel validation branches), `EnrollmentSagaService` (resolves the outcome), `EnrollmentOutcomeService` in notification-service (the terminal consumer).

### 7.1 The code — starting the saga

```java
// enrollment-service/src/main/java/com/studentmgmt/enrollment/service/EnrollmentService.java
@Transactional
public Enrollment create(Enrollment enrollment) {
    enrollment.setEnrollmentId(null);
    enrollment.setStatusId(enrollmentStatusService.findByStatusName("PENDING_VALIDATION").getStatusId());
    Enrollment saved = enrollmentRepository.save(enrollment);            // local transaction #1

    EnrollmentValidation validation = new EnrollmentValidation();
    validation.setEnrollmentId(saved.getEnrollmentId());
    enrollmentValidationRepository.save(validation);                     // still local transaction #1

    enrollmentRequestedProducer.publish(new EnrollmentRequestedEvent(    // kicks off the saga
            saved.getEnrollmentId(), saved.getStudentId(), saved.getCourseId(), LocalDateTime.now().toString()));

    return saved;
}
```

### 7.2 The code — each branch reacting independently

```java
// student-service/src/main/java/com/studentmgmt/student/kafka/EnrollmentRequestedListener.java
@KafkaListener(topics = "${app.kafka.topic.enrollment-requested}", groupId = "${spring.kafka.consumer.group-id}")
public void onEnrollmentRequested(String messageJson) throws Exception {
    EnrollmentRequestedEvent event = objectMapper.readValue(messageJson, EnrollmentRequestedEvent.class);
    boolean exists = studentRepository.existsById(event.getStudentId());        // local transaction #2 (a SELECT)
    ValidationResultEvent result = new ValidationResultEvent(
            event.getEnrollmentId(), exists,
            exists ? "Student exists" : "Student does not exist",
            "student-service", LocalDateTime.now().toString());
    validationResultProducer.publish(result);                                    // Retry-protected (§5)
}
```

`course-service` has the exact same class, checking `courseRepository.existsById(...)` instead — running completely independently, in a separate JVM process, with no knowledge that student-service even exists.

### 7.3 The code — resolving the saga (the part that actually needs both replies)

```java
// enrollment-service/src/main/java/com/studentmgmt/enrollment/service/EnrollmentSagaService.java
@Transactional
public void applyStudentValidationResult(Long enrollmentId, boolean valid, String reason) {
    enrollmentValidationRepository.updateStudentResult(enrollmentId, valid, reason);   // local transaction #3
    EnrollmentValidation validation = enrollmentValidationRepository.findById(enrollmentId).orElseThrow(...);
    resolveIfComplete(validation);
}
// applyCourseValidationResult(...) is the symmetric twin, called by CourseValidationResultListener

private void resolveIfComplete(EnrollmentValidation validation) {
    if (!validation.isResolved()) {     // isResolved() == BOTH student_valid and course_valid are non-null
        log.info("Enrollment {} still waiting on the other validation reply...", validation.getEnrollmentId());
        return;                          // whichever reply arrives FIRST just stops here — no guessing, no timeout
    }
    // whichever reply arrives SECOND reaches this point and does the actual resolving
    boolean confirmed = validation.isFullyValid();      // both true?
    String statusName = confirmed ? "CONFIRMED" : "REJECTED";
    enrollment.setStatusId(enrollmentStatusService.findByStatusName(statusName).getStatusId());
    enrollmentRepository.save(enrollment);                                              // local transaction #4
    if (confirmed) enrollmentOutcomeProducer.publishConfirmed(outcome);                 // Retry-protected
    else enrollmentOutcomeProducer.publishRejected(outcome);
}
```

### 7.4 Expectations vs. output

**Scenario A — both student and course exist (the happy path):**

| Step | Expectation | Database / log evidence |
|---|---|---|
| `POST /api/enrollments {studentId:1, courseId:1}` | `202 Accepted` immediately, status `PENDING_VALIDATION` | `Enrollments` row: `status_id = <PENDING_VALIDATION id>` |
| ~50–200ms later (Kafka round trip × 2 services) | Both validations arrive, saga resolves to CONFIRMED | `Enrollment_Validation` row: `student_valid=1, course_valid=1`; `Enrollments.status_id = <CONFIRMED id>` |
| ~same time | notification-service sends EMAIL + SMS | Two `Notifications` rows, `status='SENT'` |
| `GET /api/enrollments/{id}` a moment later | `statusId` now shows CONFIRMED | Proves the whole async chain completed |

**Scenario B — the course doesn't exist (e.g. `courseId: 9999`):**

| Step | Expectation | Evidence |
|---|---|---|
| `POST /api/enrollments {studentId:1, courseId:9999}` | Still `202 Accepted` — the API doesn't (and structurally *can't*, synchronously) know yet that course 9999 doesn't exist | Same as before — `PENDING_VALIDATION` |
| student-service's check | `existsById(1)` → true | `student.validation.result`: `valid=true` |
| course-service's check | `existsById(9999)` → false | `course.validation.result`: `valid=false, reason="Course 9999 does not exist"` |
| Saga resolution | `isFullyValid()` → false (one side failed) → REJECTED | `Enrollments.status_id = <REJECTED id>`, `rejection_reason = "Course 9999 does not exist"` |
| notification-service | Sends ONE email (rejection notice), no SMS | One `Notifications` row, `channel='EMAIL'` |

This is the Saga's version of a "compensating action" — there's no data to roll back (nothing was ever written to a nonexistent course), so the compensation is simply: transition the local `Enrollments` row to `REJECTED` and tell the student why.

---

## 8. Full Project Flow From Scratch

This section starts at the literal entry point — `main()` — and walks forward.

### 8.1 Entry Point — Starting One Service

Every one of the five modules has an identical two-line entry point:

```java
// e.g. student-service/src/main/java/com/studentmgmt/student/StudentServiceApplication.java
@SpringBootApplication
public class StudentServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(StudentServiceApplication.class, args);
    }
}
```

Running `mvn spring-boot:run` inside `student-service/` triggers, in order:

```
1. Maven compiles the module and starts a JVM whose first line of this project's own
   code is StudentServiceApplication.main()
2. SpringApplication.run(...) creates the Spring Application Context
3. Spring Boot auto-configuration inspects the classpath (pom.xml dependencies) and wires up:
     - spring-boot-starter-web        → embedded Tomcat + Spring MVC's DispatcherServlet
     - spring-boot-starter-data-jpa   → a DataSource (connection pool) to StudentDB + Hibernate
     - spring-kafka                   → a KafkaTemplate (producer) + listener container factory
     - resilience4j-spring-boot3      → reads application.properties' resilience4j.retry.instances.*
                                         and builds a RetryRegistry containing a "kafkaPublish" Retry
                                         instance, BEFORE any bean that will use it is even created
     - spring-boot-starter-aop        → the proxying machinery @Retry needs to actually intercept calls
     - spring-boot-starter-actuator   → /actuator/* endpoints, including circuit-breaker/retry ones
4. Component scanning finds every @Component/@Service/@RestController/@Repository class under
   com.studentmgmt.student and creates exactly one bean of each — including, notably,
   ValidationResultProducer (whose constructor asks for a KafkaTemplate, an ObjectMapper, and
   the topic name from application.properties — all satisfied by beans already created)
5. Because ValidationResultProducer.publish() is annotated @Retry, Spring wraps the REAL bean in
   a dynamic PROXY at this point — every future call to publish() from outside the class goes
   through this proxy first, which is what actually implements the retry loop
6. The Kafka listener container starts: EnrollmentRequestedListener's @KafkaListener method is
   registered against topic "enrollment.requested", and a background thread starts polling Kafka
   — this thread sits idle from this moment until a real message arrives, for the rest of the
   process's life
7. The DataSource genuinely connects to MySQL (StudentDB) — this is the most common startup
   failure point if MySQL isn't running
8. Embedded Tomcat binds to port 8111 and starts accepting connections
9. Spring Boot logs "Started StudentServiceApplication in X seconds" — main() has technically
   returned, but the JVM stays alive because of the Tomcat listener thread and the Kafka
   consumer thread from steps 6 and 8
```

`course-service`, `enrollment-service`, and `notification-service` go through the identical sequence on their own ports/databases, as separate JVM processes with no shared memory. `api-gateway` differs only in using WebFlux/Netty instead of Tomcat, and having no database or Kafka listener of its own.

### 8.2 A Client Logs In

```
1. curl/Postman sends POST http://localhost:8110/auth/login {"username":"aarav.sharma","password":"password123"}
2. api-gateway's Netty server accepts the connection; this path matches no route (routes only
   match /api/**), so GatewayAuthFilter never runs for this request at all
3. AuthController.login(...) is invoked directly
4. StudentLoginClient (a reactive WebClient call) sends POST http://localhost:8111/api/student-logins/verify
   {"username":"aarav.sharma","password":"password123"} — a SECOND, independent HTTP request/response,
   this time to student-service
5. student-service: StudentLoginController → StudentLoginService.verifyCredentials(...)
     → finds the Student_Login row by username, checks is_active=true, compares password_hash
       to the incoming password as PLAIN TEXT (§ note: teaching simplification, not production-safe)
     → returns {"valid":true, "username":"aarav.sharma", "role":"STUDENT"}
6. Back in api-gateway: JwtUtil.generateToken("aarav.sharma", "STUDENT") signs a JWT containing
   both claims, using the ONE secret that exists only inside api-gateway
7. api-gateway returns {"token": "eyJhbGc..."} to the client
```

### 8.3 A Client Fetches Their Own Enrollment (a normal GET)

```
1. curl sends GET http://localhost:8110/api/enrollments/37 with "Authorization: Bearer <token>"
2. Netty parses the request; routing engine matches Path=/api/enrollments/** → enrollment-service:8113
3. GatewayAuthFilter runs (order=-1, before the route forwards anything):
     a. JwtUtil.isValid(token) → true
     b. username="aarav.sharma", role="STUDENT" extracted
     c. AuthorizationPolicy.isAllowed("GET", "/api/enrollments/37", "STUDENT") → true
        (no rule restricts GET on /api/enrollments — see §5.3 of the beginner guide)
     d. request forwarded with X-Authenticated-User / X-Authenticated-Role headers added
4. A brand-new TCP connection carries the (mutated) request to enrollment-service:8113
5. enrollment-service's CorrelationIdFilter (mints/reads X-Correlation-Id, puts it in MDC) then
   AuthenticatedUserFilter (reads the two headers gateway added) run, in that order (@Order 10, 20)
6. DispatcherServlet → EnrollmentController.findById(37L) → EnrollmentService.findById(37L)
     → EnrollmentRepository.findById(37L) → SELECT * FROM Enrollments WHERE enrollment_id = 37
7. Jackson serializes the Enrollment entity to JSON; HTTP 200
8. Response travels back: enrollment-service → gateway → client, unchanged
```

### 8.4 A Client Creates an Enrollment — The Full Saga, Hop by Hop

Building directly on §8.3's steps 1–5 (identical up through authentication/authorization/routing, this time for `POST /api/enrollments {"studentId":1,"courseId":1}`):

```
 6. EnrollmentController.create(enrollment) → EnrollmentService.create(enrollment)  [see §7.1's code]
 7. Inside one @Transactional block:
      a. SELECT the "PENDING_VALIDATION" status id from Enrollment_Status
      b. INSERT INTO Enrollments (student_id=1, course_id=1, status_id=<pending-id>, ...)
         → MySQL returns the new enrollment_id, say 41
      c. INSERT INTO Enrollment_Validation (enrollment_id=41, student_valid=NULL, course_valid=NULL)
 8. EnrollmentRequestedProducer.publish({enrollmentId:41, studentId:1, courseId:1, ...})
      — @Retry-protected (§5) — publishes to Kafka topic "enrollment.requested", key="41"
 9. Transaction commits — both INSERTs from step 7 are now permanent
10. EnrollmentController returns; @ResponseStatus(ACCEPTED) → HTTP 202
11. Response reaches the client: {"enrollmentId":41, "statusId":<pending-id>, ...}
    — AT THIS POINT THE ORIGINAL HTTP REQUEST IS FULLY COMPLETE. Everything below happens
      later, on background threads, in THREE OTHER JVM PROCESSES.

12. student-service's Kafka consumer thread (idle since §8.1 step 6) wakes up:
      EnrollmentRequestedListener.onEnrollmentRequested(...)  [see §7.2's code]
        a. deserializes the message
        b. studentRepository.existsById(1) → true (SELECT against StudentDB)
        c. ValidationResultProducer.publish({enrollmentId:41, valid:true, reason:"Student exists", ...})
           — @Retry-protected — publishes to "student.validation.result", key="41"

13. SIMULTANEOUSLY, course-service's Kafka consumer thread wakes up on the SAME
    "enrollment.requested" message (independent copy — different consumer group):
      EnrollmentRequestedListener.onEnrollmentRequested(...)
        a. courseRepository.existsById(1) → true (SELECT against CourseDB)
        b. ValidationResultProducer.publish({enrollmentId:41, valid:true, reason:"Course exists", ...})
           → "course.validation.result", key="41"

14. Back in enrollment-service, its own two listeners wake up independently — order not guaranteed:
      StudentValidationResultListener → EnrollmentSagaService.applyStudentValidationResult(41, true, ...)
      CourseValidationResultListener  → EnrollmentSagaService.applyCourseValidationResult(41, true, ...)
    [see §7.3's code] Whichever runs FIRST: UPDATEs its own column, sees the other is still NULL, returns.
    Whichever runs SECOND: UPDATEs its own column, sees BOTH are now non-NULL, resolves the saga:
        a. isFullyValid() → true (both true) → statusName = "CONFIRMED"
        b. UPDATE Enrollments SET status_id = <CONFIRMED-id> WHERE enrollment_id = 41
        c. EnrollmentOutcomeProducer.publishConfirmed({enrollmentId:41, studentId:1, courseId:1,
           status:"CONFIRMED", ...}) — @Retry-protected — publishes to "enrollment.confirmed"

15. notification-service's Kafka consumer (subscribed to BOTH enrollment.confirmed AND
    enrollment.rejected via one @KafkaListener) wakes up:
      EnrollmentOutcomeListener → EnrollmentOutcomeService.handle(event)  [see §7's EnrollmentOutcomeService]
        Because status == "CONFIRMED":
          a. NotificationDispatchService.dispatch(41, 1, EMAIL, "...CONFIRMED...")
          b. NotificationDispatchService.dispatch(41, 1, SMS,   "...CONFIRMED...")
        Each dispatch is Retry+CircuitBreaker-protected (§6.3) against the simulated gateway
        (healthy in this scenario, so attempt succeeds on try #1) and writes one Notifications
        row per channel with status='SENT', attempt_count=1

16. Client (a human, or a script) separately sends GET /api/enrollments/41 — runs the ENTIRE
    §8.3 GET trace again — and this time statusId resolves to CONFIRMED, proving steps 12-15
    above genuinely happened, invisibly, across three other processes, while the original
    POST had already returned many milliseconds earlier.
```

### 8.5 Circuit Breaker Tripping — Hop by Hop

Continuing from a healthy system, an operator (ADMIN role) deliberately breaks the simulated notification gateway:

```
1. ADMIN logs in (§8.2), gets a token with role="ADMIN"
2. POST /api/notifications/admin/toggle-failure?failing=true
     → GatewayAuthFilter: AuthorizationPolicy.isAllowed("POST", "/api/notifications/admin/toggle-failure", "ADMIN")
       → true (this exact path prefix requires ADMIN — a STUDENT token would get 403 here)
     → NotificationAdminController.toggleFailure(true) → SimulatedExternalGateway.setForcedFailure(true)
3. A new enrollment is created (§8.4's steps 1-14, unchanged) and resolves to CONFIRMED
4. notification-service's EnrollmentOutcomeService calls NotificationDispatchService.dispatch(...)
     Inside dispatch(): Decorators.ofSupplier(action).withRetry(retry).withCircuitBreaker(cb).decorate()
       a. attempt 1: gateway.send(...) throws IllegalStateException ("Simulated ... gateway outage")
       b. Retry waits 300ms, attempt 2: throws again
       c. Retry waits 300ms, attempt 3: throws again — max-attempts reached, exception propagates
          OUT of Retry and INTO the circuit breaker's view as ONE failed call
       d. circuit breaker increments its failure count for this ONE call (not three)
       e. dispatch() catches the exception → Notification row saved: status=FAILED, attemptCount=3
5. Repeat step 3-4 for 3 more enrollments — after 4 total dispatch calls (sliding-window-size=4)
   with a 50%+ failure rate, the circuit breaker for "notificationGateway" trips OPEN
6. The 5th dispatch call: CircuitBreaker rejects it BEFORE Retry (and therefore the simulated
   gateway) ever runs → Notification row saved: status=FAILED, attemptCount=0
7. ADMIN calls POST .../toggle-failure?failing=false, waits 8 seconds (wait-duration-in-open-state)
8. Next dispatch call is a HALF_OPEN trial: gateway.send() now succeeds → circuit closes again
   → Notification row: status=SENT, attemptCount=1
```

---

## 9. Expectation vs. Output — Summary Table

| Pattern | Trigger | Expectation | Concrete Output |
|---|---|---|---|
| **Retry** | Kafka publish fails once or twice, then Kafka recovers | Caller sees no error at all | One `INFO ... Published to ...` log line; total latency ≈ 1.5s instead of instant |
| **Retry** | Kafka publish fails all 3 attempts | Caller (Kafka listener) doesn't crash; failure is logged | `ERROR ... Giving up publishing ... after all retry attempts` |
| **Circuit Breaker** | student-service down, first few calls | Slow (timeout-bound) fallback responses | `{"firstName":"Unavailable",...}` after ~2s each |
| **Circuit Breaker** | student-service down, breaker now OPEN | Instant fallback responses, no real call attempted | Same fallback JSON, returned in milliseconds; `/actuator/health` shows `CIRCUIT_OPEN` |
| **Circuit Breaker** | student-service comes back, wait-duration elapses | One trial call succeeds → breaker closes | Real data returned again; `/actuator/health` shows `CLOSED` |
| **Retry + Circuit Breaker** | Simulated notification gateway forced to fail | 3 retries per dispatch, then FAILED; after 4 calls, breaker opens | `Notifications` rows: `status=FAILED`, `attempt_count=3` then `attempt_count=0` |
| **Saga** | Enrollment for a real student + real course | Ends CONFIRMED; 2 notifications sent | `Enrollments.status_id=CONFIRMED`; 2 `Notifications` rows |
| **Saga** | Enrollment for a real student + nonexistent course | Ends REJECTED with a reason; 1 notification sent | `Enrollments.status_id=REJECTED`, `rejection_reason` populated; 1 `Notifications` row |
| **Saga** | Only one of the two validation replies has arrived so far | No resolution yet — enrollment stays PENDING_VALIDATION | `Enrollment_Validation` row has exactly one of `student_valid`/`course_valid` set, the other still `NULL` |
