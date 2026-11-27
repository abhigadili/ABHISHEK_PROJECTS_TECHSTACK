package com.hrportal.common.web;

import org.slf4j.MDC;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/** HandlerInterceptor #3: records client IP (X-Forwarded-For aware) and user agent into the request context / MDC. */
@Component
public class RequestMetadataInterceptor implements HandlerInterceptor {
    private final ObjectProvider<RequestContext> context;

    public RequestMetadataInterceptor(ObjectProvider<RequestContext> context) {
        this.context = context;
    }

    @Override
    public boolean preHandle(HttpServletRequest req, HttpServletResponse res, Object handler) {
        String forwarded = req.getHeader("X-Forwarded-For");
        String ip = forwarded != null && !forwarded.isBlank() ? forwarded.split(",")[0].trim() : req.getRemoteAddr();
        RequestContext ctx = context.getObject();
        ctx.setClientIp(ip);
        String ua = req.getHeader("User-Agent");
        ctx.setUserAgent(ua == null ? null : ua.substring(0, Math.min(ua.length(), 200)));
        ctx.setCorrelationId(MDC.get(CorrelationIdFilter.MDC_KEY));
        MDC.put("clientIp", ip);
        return true;
    }
}
