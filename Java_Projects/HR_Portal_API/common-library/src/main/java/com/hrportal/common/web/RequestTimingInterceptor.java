package com.hrportal.common.web;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/** HandlerInterceptor #1: measures the time spent in the controller layer (logged after the response is written) and warns on slow handlers. */
@Component
public class RequestTimingInterceptor implements HandlerInterceptor {
    private static final Logger log = LoggerFactory.getLogger(RequestTimingInterceptor.class);
    private static final long SLOW_MS = 1500;
    private final ObjectProvider<RequestContext> context;

    public RequestTimingInterceptor(ObjectProvider<RequestContext> context) {
        this.context = context;
    }

    @Override
    public boolean preHandle(HttpServletRequest req, HttpServletResponse res, Object handler) {
        context.getObject().setStartNanos(System.nanoTime());
        return true;
    }

    /** afterCompletion (not postHandle): for @RestController methods the response is already committed in postHandle, so a header could not be added there. */
    @Override
    public void afterCompletion(HttpServletRequest req, HttpServletResponse res, Object handler, Exception ex) {
        long ms = (System.nanoTime() - context.getObject().getStartNanos()) / 1_000_000;
        if (ms > SLOW_MS) log.warn("Slow handler {} {} took {} ms", req.getMethod(), req.getRequestURI(), ms);
        else log.debug("Handler {} {} took {} ms", req.getMethod(), req.getRequestURI(), ms);
    }
}
