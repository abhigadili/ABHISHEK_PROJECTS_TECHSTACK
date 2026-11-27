package com.hospital.common.client;

import java.util.function.Supplier;

import com.hospital.common.web.ApiException;
import com.hospital.common.web.ServiceUnavailableException;

/** Normalises transport failures (refused connection, timeout, 5xx) into ServiceUnavailableException so the
 *  circuit breaker counts them, while business answers (404/409/...) pass through untouched. */
public final class Downstream {
    private Downstream() {
    }

    public static <T> T call(String service, Supplier<T> call) {
        try {
            return call.get();
        } catch (ApiException e) {
            throw e;
        } catch (RuntimeException e) {
            Throwable root = e;
            while (root.getCause() != null && root.getCause() != root) root = root.getCause();
            throw new ServiceUnavailableException(service + " is unreachable: " + root.getClass().getSimpleName() + (root.getMessage() == null ? "" : " - " + root.getMessage()));
        }
    }
}
