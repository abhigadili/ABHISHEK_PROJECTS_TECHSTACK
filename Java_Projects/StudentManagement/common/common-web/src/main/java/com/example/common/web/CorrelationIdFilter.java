package com.example.common.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.web.filter.OncePerRequestFilter;

/** Propagates X-Correlation-Id (generating one if absent) into the MDC and response, and logs each request. */
public class CorrelationIdFilter extends OncePerRequestFilter {
    public static final String HEADER = "X-Correlation-Id";
    public static final String MDC_KEY = "correlationId";
    private static final Logger log = LoggerFactory.getLogger("http.request");

    @Override
    protected boolean shouldNotFilterAsyncDispatch() { return false; }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String id = req.getHeader(HEADER);
        if (id == null || id.isBlank()) id = UUID.randomUUID().toString();
        MDC.put(MDC_KEY, id);
        res.setHeader(HEADER, id);
        long start = System.nanoTime();
        try {
            chain.doFilter(req, res);
        } finally {
            if (!req.getRequestURI().startsWith("/actuator")) {
                log.info("{} {} -> {} ({} ms)", req.getMethod(), req.getRequestURI(), res.getStatus(),
                        (System.nanoTime() - start) / 1_000_000);
            }
            MDC.remove(MDC_KEY);
        }
    }
}
