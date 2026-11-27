package com.example.enrollment.client;

import com.example.common.exception.ServiceUnavailableException;
import io.github.resilience4j.bulkhead.BulkheadFullException;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/** Turns the outcome of a resilient (async) remote call into either a result, a business exception, or ServiceUnavailableException. */
public final class RemoteCall {
    private RemoteCall() {}

    public static <T> T await(CompletableFuture<T> future, String service) {
        try {
            return future.get(15, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ServiceUnavailableException(service + " call interrupted", e);
        } catch (TimeoutException e) {
            throw new ServiceUnavailableException(service + " timed out", e);
        } catch (ExecutionException e) {
            Throwable c = e.getCause() == null ? e : e.getCause();
            if (c instanceof RemoteExceptions.RemoteNotFoundException || c instanceof RemoteExceptions.RemoteConflictException
                    || c instanceof RemoteExceptions.RemoteRejectedException) {
                throw (RuntimeException) c;                       // business answer from the dependency
            }
            if (c instanceof CallNotPermittedException) throw new ServiceUnavailableException(service + " circuit breaker is OPEN", c);
            if (c instanceof BulkheadFullException) throw new ServiceUnavailableException(service + " is overloaded (bulkhead full)", c);
            if (c instanceof TimeoutException) throw new ServiceUnavailableException(service + " timed out", c);
            throw new ServiceUnavailableException(service + " unavailable: " + c.getMessage(), c);
        }
    }
}
