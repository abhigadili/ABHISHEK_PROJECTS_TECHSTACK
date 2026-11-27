package com.example.enrollment.client;

import com.example.enrollment.client.RemoteDtos.EligibilityInfo;
import com.example.enrollment.client.RemoteDtos.StudentInfo;
import io.github.resilience4j.bulkhead.annotation.Bulkhead;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import io.github.resilience4j.timelimiter.annotation.TimeLimiter;
import java.util.concurrent.CompletableFuture;
import org.springframework.stereotype.Component;

/**
 * Resilience4j stack around Student Service (outermost -> innermost): Retry -> CircuitBreaker -> TimeLimiter -> thread-pool Bulkhead
 * -> Feign. Config: resilience4j.*.instances.studentService in application.yml. Callers use RemoteCall.await(...).
 */
@Component
public class StudentGateway {
    private final StudentClient client;

    public StudentGateway(StudentClient client) { this.client = client; }

    @Bulkhead(name = "studentService", type = Bulkhead.Type.THREADPOOL)
    @TimeLimiter(name = "studentService")
    @CircuitBreaker(name = "studentService")
    @Retry(name = "studentService")
    public CompletableFuture<EligibilityInfo> eligibility(Long studentId) { return CompletableFuture.completedFuture(client.eligibility(studentId)); }

    @Bulkhead(name = "studentService", type = Bulkhead.Type.THREADPOOL)
    @TimeLimiter(name = "studentService")
    @CircuitBreaker(name = "studentService")
    @Retry(name = "studentService")
    public CompletableFuture<StudentInfo> getStudent(Long studentId) { return CompletableFuture.completedFuture(client.get(studentId)); }
}
