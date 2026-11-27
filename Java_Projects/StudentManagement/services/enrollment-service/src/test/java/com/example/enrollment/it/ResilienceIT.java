package com.example.enrollment.it;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.common.exception.ServiceUnavailableException;
import com.example.common.security.JwtTokenService;
import com.example.enrollment.client.*;
import com.example.enrollment.client.RemoteExceptions.RemoteConflictException;
import com.example.enrollment.client.RemoteExceptions.RemoteNotFoundException;
import com.sun.net.httpserver.HttpServer;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Function;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Real HTTP between Feign clients and a stub "Student/Course service": verifies error mapping, Resilience4j retry,
 * circuit breaker, time limiter / read timeout, bulkhead wiring, and service-to-service authentication headers.
 */
@SpringBootTest(properties = {"eureka.client.enabled=false", "spring.cloud.discovery.enabled=false", "enrollment.outbox.interval-ms=3600000",
        "enrollment.saga.recovery-interval-ms=3600000", "resilience4j.retry.configs.default.wait-duration=50ms",
        "resilience4j.circuitbreaker.configs.default.wait-duration-in-open-state=2s", "spring.cloud.openfeign.client.config.default.read-timeout=1000",
        "resilience4j.timelimiter.configs.default.timeout-duration=2s"})
class ResilienceIT extends AbstractIT {
    record Reply(int status, String body, long delayMs) {}

    static HttpServer stub;
    static final AtomicInteger HITS = new AtomicInteger();
    static final AtomicReference<Function<Integer, Reply>> BEHAVIOUR = new AtomicReference<>();
    static final List<String> AUTH_HEADERS = new CopyOnWriteArrayList<>();
    static final List<String> CORRELATION_HEADERS = new CopyOnWriteArrayList<>();

    static {
        try {
            stub = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        } catch (IOException e) { throw new IllegalStateException(e); }
        stub.setExecutor(java.util.concurrent.Executors.newCachedThreadPool());
        stub.createContext("/", ex -> {
            int n = HITS.incrementAndGet();
            AUTH_HEADERS.add(String.valueOf(ex.getRequestHeaders().getFirst("Authorization")));
            CORRELATION_HEADERS.add(String.valueOf(ex.getRequestHeaders().getFirst("X-Correlation-Id")));
            Reply r = BEHAVIOUR.get().apply(n);
            try { Thread.sleep(r.delayMs()); } catch (InterruptedException ignored) { }
            byte[] body = r.body().getBytes(StandardCharsets.UTF_8);
            ex.getResponseHeaders().add("Content-Type", "application/json");
            ex.sendResponseHeaders(r.status(), body.length == 0 ? -1 : body.length);
            if (body.length > 0) ex.getResponseBody().write(body);
            ex.close();
        });
        stub.start();
    }

    @DynamicPropertySource
    static void clientUrls(DynamicPropertyRegistry r) {
        String url = "http://127.0.0.1:" + stub.getAddress().getPort();
        r.add("clients.student-service.url", () -> url);
        r.add("clients.course-service.url", () -> url);
    }

    @AfterAll
    static void stopStub() { stub.stop(0); }

    @Autowired StudentGateway students;
    @Autowired CourseGateway courses;
    @Autowired CircuitBreakerRegistry breakers;
    @Autowired JwtTokenService jwt;

    private static final String STUDENT_JSON = "{\"studentId\":5,\"firstName\":\"Asha\",\"lastName\":\"Rao\",\"email\":\"a@b.com\",\"status\":\"ACTIVE\",\"unknownField\":1}";

    @BeforeEach
    void reset() {
        HITS.set(0); AUTH_HEADERS.clear(); CORRELATION_HEADERS.clear();
        breakers.getAllCircuitBreakers().forEach(CircuitBreaker::reset);
        BEHAVIOUR.set(n -> new Reply(200, STUDENT_JSON, 0));
    }

    @Test
    void successfulCallDecodesTheResponseAndSendsAServiceTokenAndCorrelationId() {
        org.slf4j.MDC.put("correlationId", "corr-123");
        try {
            var info = RemoteCall.await(students.getStudent(5L), "student-service");
            assertThat(info.fullName()).isEqualTo("Asha Rao");
            assertThat(info.status()).isEqualTo("ACTIVE");
        } finally { org.slf4j.MDC.clear(); }

        var token = jwt.parse(AUTH_HEADERS.get(0).replace("Bearer ", "")).orElseThrow();
        assertThat(token.roles()).containsExactly("SERVICE");
        assertThat(CORRELATION_HEADERS.get(0)).isEqualTo("corr-123");   // propagated through the bulkhead thread pool
    }

    @Test
    void notFoundIsABusinessAnswerNotRetriedAndNotCountedAgainstTheBreaker() {
        BEHAVIOUR.set(n -> new Reply(404, "", 0));
        for (int i = 0; i < 8; i++) {
            assertThatThrownBy(() -> RemoteCall.await(students.getStudent(5L), "student-service")).isInstanceOf(RemoteNotFoundException.class);
        }
        assertThat(HITS.get()).isEqualTo(8);                                         // exactly one attempt per call
        assertThat(breakers.circuitBreaker("studentService").getState()).isEqualTo(CircuitBreaker.State.CLOSED);
    }

    @Test
    void conflictIsMappedToARemoteConflict() {
        BEHAVIOUR.set(n -> new Reply(409, "", 0));
        assertThatThrownBy(() -> RemoteCall.await(courses.reserveSeat(1L, 2L), "course-service")).isInstanceOf(RemoteConflictException.class);
        assertThat(HITS.get()).isEqualTo(1);
    }

    @Test
    void transientServerErrorsAreRetriedUntilTheCallSucceeds() {
        BEHAVIOUR.set(n -> n < 3 ? new Reply(503, "", 0) : new Reply(200, STUDENT_JSON, 0));
        var info = RemoteCall.await(students.getStudent(5L), "student-service");
        assertThat(info.studentId()).isEqualTo(5L);
        assertThat(HITS.get()).isEqualTo(3);                                         // 2 failures + 1 success (max-attempts = 3)
    }

    @Test
    void persistentFailureExhaustsRetriesThenOpensTheCircuitAndFailsFast() throws Exception {
        BEHAVIOUR.set(n -> new Reply(503, "", 0));

        assertThatThrownBy(() -> RemoteCall.await(students.getStudent(5L), "student-service")).isInstanceOf(ServiceUnavailableException.class);
        assertThat(HITS.get()).as("3 attempts for one logical call").isEqualTo(3);
        assertThatThrownBy(() -> RemoteCall.await(students.getStudent(5L), "student-service")).isInstanceOf(ServiceUnavailableException.class);

        CircuitBreaker cb = breakers.circuitBreaker("studentService");
        assertThat(cb.getState()).isEqualTo(CircuitBreaker.State.OPEN);
        int before = HITS.get();
        assertThatThrownBy(() -> RemoteCall.await(students.getStudent(5L), "student-service"))
                .isInstanceOf(ServiceUnavailableException.class).hasMessageContaining("circuit breaker is OPEN");
        assertThat(HITS.get()).as("no request reaches the dependency while the breaker is open").isEqualTo(before);

        // dependency recovers -> after the wait duration the breaker half-opens and closes again
        BEHAVIOUR.set(n -> new Reply(200, STUDENT_JSON, 0));
        Thread.sleep(2500);
        for (int i = 0; i < 3; i++) RemoteCall.await(students.getStudent(5L), "student-service");
        assertThat(cb.getState()).isEqualTo(CircuitBreaker.State.CLOSED);
    }

    @Test
    void slowDependencyIsCutOffByTimeoutsInsteadOfHangingTheCaller() {
        BEHAVIOUR.set(n -> new Reply(200, STUDENT_JSON, 4000));
        long start = System.currentTimeMillis();
        assertThatThrownBy(() -> RemoteCall.await(courses.getCourse(1L), "course-service")).isInstanceOf(ServiceUnavailableException.class);
        assertThat(System.currentTimeMillis() - start).isLessThan(12_000);
    }

    @Test
    void breakersAreIndependentPerDependency() {
        BEHAVIOUR.set(n -> new Reply(503, "", 0));
        for (int i = 0; i < 3; i++) assertThatThrownBy(() -> RemoteCall.await(students.getStudent(5L), "student-service")).isInstanceOf(ServiceUnavailableException.class);
        assertThat(breakers.circuitBreaker("studentService").getState()).isEqualTo(CircuitBreaker.State.OPEN);
        assertThat(breakers.circuitBreaker("courseService").getState()).isEqualTo(CircuitBreaker.State.CLOSED);
    }
}
