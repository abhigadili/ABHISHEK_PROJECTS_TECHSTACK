package com.hrportal.common.web;

import org.springframework.stereotype.Component;
import org.springframework.web.context.annotation.RequestScope;

import lombok.Getter;
import lombok.Setter;

/**
 * REQUEST-scoped bean (one instance per HTTP request) filled by the interceptors. Services can inject it
 * (as a scoped proxy) to read who is calling and from where without touching the servlet API.
 */
@Getter
@Setter
@Component
@RequestScope
public class RequestContext {
    private String correlationId;
    private String userId;
    private String employeeId;
    private String username;
    private String clientIp;
    private String userAgent;
    private long startNanos;
}
