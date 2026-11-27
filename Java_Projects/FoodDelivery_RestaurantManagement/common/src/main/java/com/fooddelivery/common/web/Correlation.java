package com.fooddelivery.common.web;

import org.slf4j.MDC;
import java.util.UUID;

/** Correlation-ID conventions shared by HTTP filters, Feign, WebClient and Kafka. */
public final class Correlation {
    public static final String HEADER = "X-Correlation-Id";
    public static final String MDC_KEY = "correlationId";

    private Correlation() {}

    public static String current() { return MDC.get(MDC_KEY); }

    public static String currentOrNew() {
        String c = MDC.get(MDC_KEY);
        return c != null ? c : UUID.randomUUID().toString();
    }
}
