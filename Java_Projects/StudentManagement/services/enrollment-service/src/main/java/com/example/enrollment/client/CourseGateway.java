package com.example.enrollment.client;

import com.example.enrollment.client.RemoteDtos.*;
import io.github.resilience4j.bulkhead.annotation.Bulkhead;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import io.github.resilience4j.timelimiter.annotation.TimeLimiter;
import java.util.concurrent.CompletableFuture;
import org.springframework.stereotype.Component;

/** Same resilience stack as StudentGateway, config instance "courseService". Seat reserve/release are idempotent, so retrying is safe. */
@Component
public class CourseGateway {
    private final CourseClient client;

    public CourseGateway(CourseClient client) { this.client = client; }

    @Bulkhead(name = "courseService", type = Bulkhead.Type.THREADPOOL)
    @TimeLimiter(name = "courseService")
    @CircuitBreaker(name = "courseService")
    @Retry(name = "courseService")
    public CompletableFuture<CourseInfo> getCourse(Long courseId) { return CompletableFuture.completedFuture(client.get(courseId)); }

    @Bulkhead(name = "courseService", type = Bulkhead.Type.THREADPOOL)
    @TimeLimiter(name = "courseService")
    @CircuitBreaker(name = "courseService")
    @Retry(name = "courseService")
    public CompletableFuture<AvailabilityInfo> availability(Long courseId) { return CompletableFuture.completedFuture(client.availability(courseId)); }

    @Bulkhead(name = "courseService", type = Bulkhead.Type.THREADPOOL)
    @TimeLimiter(name = "courseService")
    @CircuitBreaker(name = "courseService")
    @Retry(name = "courseService")
    public CompletableFuture<SeatResult> reserveSeat(Long courseId, Long enrollmentId) {
        return CompletableFuture.completedFuture(client.reserve(courseId, new SeatCommand(enrollmentId)));
    }

    @Bulkhead(name = "courseService", type = Bulkhead.Type.THREADPOOL)
    @TimeLimiter(name = "courseService")
    @CircuitBreaker(name = "courseService")
    @Retry(name = "courseService")
    public CompletableFuture<SeatResult> releaseSeat(Long courseId, Long enrollmentId) {
        return CompletableFuture.completedFuture(client.release(courseId, new SeatCommand(enrollmentId)));
    }
}
