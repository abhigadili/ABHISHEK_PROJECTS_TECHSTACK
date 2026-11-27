package com.hrportal.common.web;

import java.io.IOException;
import java.time.Instant;
import java.util.Enumeration;
import java.util.regex.Pattern;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrportal.common.exception.ApiError;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Servlet Filter #3 (request header validation + security-related request processing):
 * rejects path-traversal / NUL-byte URLs, oversized headers and malformed correlation ids before any
 * Spring MVC code runs, and marks API answers as non-cacheable.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
public class RequestHeaderValidationFilter extends OncePerRequestFilter {
    public static final Pattern VALID_ID = Pattern.compile("^[A-Za-z0-9._-]{8,64}$");
    private static final int MAX_HEADER_LENGTH = 8192;
    private final ObjectMapper mapper;

    public RequestHeaderValidationFilter(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String uri = req.getRequestURI();
        String lower = uri.toLowerCase();
        if (uri.contains("..") || lower.contains("%2e%2e") || lower.contains("%00") || uri.indexOf('\0') >= 0) {
            reject(req, res, "Illegal path sequence in URL");
            return;
        }
        String cid = req.getHeader(CorrelationIdFilter.HEADER);
        if (cid != null && !VALID_ID.matcher(cid).matches()) {
            reject(req, res, "Malformed " + CorrelationIdFilter.HEADER + " header");
            return;
        }
        Enumeration<String> names = req.getHeaderNames();
        while (names != null && names.hasMoreElements()) {
            String v = req.getHeader(names.nextElement());
            if (v != null && v.length() > MAX_HEADER_LENGTH) {
                reject(req, res, "Request header too large");
                return;
            }
        }
        if (uri.startsWith("/api/")) {
            res.setHeader("Cache-Control", "no-store");
            res.setHeader("Pragma", "no-cache");
        }
        chain.doFilter(req, res);
    }

    private void reject(HttpServletRequest req, HttpServletResponse res, String msg) throws IOException {
        res.setStatus(400);
        res.setContentType("application/json");
        mapper.writeValue(res.getOutputStream(), new ApiError(Instant.now(), 400, "Bad Request", "INVALID_REQUEST", msg,
                req.getRequestURI(), org.slf4j.MDC.get("correlationId"), null));
    }
}
