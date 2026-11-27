package com.fooddelivery.common.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * Servlet filter (runs before Spring Security): puts the correlation id into the MDC, echoes it on the
 * response and writes one structured access-log line per request (method, path, status, duration).
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CorrelationIdFilter extends OncePerRequestFilter {
    private static final Logger ACCESS = LoggerFactory.getLogger("access");

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String p = request.getRequestURI();
        return p.startsWith("/actuator/health") || p.startsWith("/actuator/prometheus");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String cid = req.getHeader(Correlation.HEADER);
        if (cid == null || cid.isBlank()) cid = UUID.randomUUID().toString();
        MDC.put(Correlation.MDC_KEY, cid);
        MDC.put("httpMethod", req.getMethod());
        MDC.put("httpPath", req.getRequestURI());
        res.setHeader(Correlation.HEADER, cid);
        long start = System.nanoTime();
        try {
            chain.doFilter(req, res);
        } finally {
            long ms = (System.nanoTime() - start) / 1_000_000;
            MDC.put("httpStatus", String.valueOf(res.getStatus()));
            MDC.put("durationMs", String.valueOf(ms));
            ACCESS.info("{} {} -> {} ({} ms)", req.getMethod(), req.getRequestURI(), res.getStatus(), ms);
            MDC.clear();
        }
    }
}
