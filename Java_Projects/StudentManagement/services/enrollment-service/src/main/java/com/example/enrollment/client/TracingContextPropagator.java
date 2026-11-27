package com.example.enrollment.client;

import io.github.resilience4j.core.ContextPropagator;
import io.micrometer.context.ContextSnapshot;
import io.micrometer.context.ContextSnapshotFactory;
import java.util.Map;
import java.util.Optional;
import java.util.function.Consumer;
import java.util.function.Supplier;
import org.slf4j.MDC;

/**
 * Resilience4j's thread-pool bulkhead runs calls on its own threads. This propagator copies the current trace/span
 * (micrometer context-propagation) and the MDC (correlationId) to those threads, so Student/Course calls stay in the same
 * distributed trace and keep the correlation id.
 */
public class TracingContextPropagator implements ContextPropagator<TracingContextPropagator.Captured> {
    private static final ContextSnapshotFactory FACTORY = ContextSnapshotFactory.builder().build();
    private static final ThreadLocal<ContextSnapshot.Scope> SCOPE = new ThreadLocal<>();

    public record Captured(ContextSnapshot snapshot, Map<String, String> mdc) {}

    @Override
    public Supplier<Optional<Captured>> retrieve() { return () -> Optional.of(new Captured(FACTORY.captureAll(), MDC.getCopyOfContextMap())); }

    @Override
    public Consumer<Optional<Captured>> copy() {
        return captured -> captured.ifPresent(c -> {
            SCOPE.set(c.snapshot().setThreadLocals());
            if (c.mdc() != null) MDC.setContextMap(c.mdc());
        });
    }

    @Override
    public Consumer<Optional<Captured>> clear() {
        return captured -> {
            ContextSnapshot.Scope scope = SCOPE.get();
            if (scope != null) { scope.close(); SCOPE.remove(); }
            MDC.clear();
        };
    }
}
