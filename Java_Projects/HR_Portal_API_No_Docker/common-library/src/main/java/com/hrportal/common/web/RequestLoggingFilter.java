package com.hrportal.common.web;

import java.io.IOException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.hrportal.common.util.LogMasker;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/** Servlet Filter #2: one access-log line per request (method, masked URI, status, duration). Bodies are never logged. */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class RequestLoggingFilter extends OncePerRequestFilter {
    private static final Logger log = LoggerFactory.getLogger("http.access");

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return request.getRequestURI().equals("/ping");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        long start = System.nanoTime();
        String uri = req.getRequestURI() + (req.getQueryString() == null ? "" : "?" + LogMasker.maskQuery(req.getQueryString()));
        log.info("--> {} {}", req.getMethod(), uri);
        try {
            chain.doFilter(req, res);
        } finally {
            log.info("<-- {} {} {} ({} ms)", req.getMethod(), req.getRequestURI(), res.getStatus(), (System.nanoTime() - start) / 1_000_000);
        }
    }
}
