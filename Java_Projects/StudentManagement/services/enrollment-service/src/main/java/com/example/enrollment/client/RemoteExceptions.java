package com.example.enrollment.client;

/** Exceptions produced by the Feign ErrorDecoder. Business answers (404/409/4xx) are never retried / never trip the breaker. */
public final class RemoteExceptions {
    private RemoteExceptions() {}

    public static class RemoteNotFoundException extends RuntimeException {
        public RemoteNotFoundException(String m) { super(m); }
    }

    public static class RemoteConflictException extends RuntimeException {
        public RemoteConflictException(String m) { super(m); }
    }

    /** Other 4xx: the dependency understood and refused the request. */
    public static class RemoteRejectedException extends RuntimeException {
        public RemoteRejectedException(String m) { super(m); }
    }

    /** 5xx / network error: retryable and counted by the circuit breaker. */
    public static class RemoteUnavailableException extends RuntimeException {
        public RemoteUnavailableException(String m) { super(m); }
    }
}
