package com.hrportal.common.web;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * AOP (cross-cutting concern): wraps every public method of every {@code @Service} bean and measures it. Business code stays free of
 * timing / logging code. Slow service methods (default &gt; 2 s, {@code hr.aop.slow-service-ms}) are logged as WARN with class and method
 * name; everything else is a DEBUG line. Arguments are never logged (they may contain personal or salary data).
 * Unlike a servlet filter or an interceptor (which see HTTP requests), an aspect sees Java method calls - including calls made by
 * Kafka listeners and scheduled jobs that have no HTTP request at all.
 */
@Aspect
@Component
public class ServiceTimingAspect {
    private static final Logger log = LoggerFactory.getLogger(ServiceTimingAspect.class);
    private final long slowMs;

    public ServiceTimingAspect(@Value("${hr.aop.slow-service-ms:2000}") long slowMs) {
        this.slowMs = slowMs;
    }

    @Around("within(@org.springframework.stereotype.Service *) && execution(public * *(..))")
    public Object time(ProceedingJoinPoint pjp) throws Throwable {
        long start = System.nanoTime();
        try {
            return pjp.proceed();
        } finally {
            long ms = (System.nanoTime() - start) / 1_000_000;
            if (ms > slowMs) {
                log.warn("Slow service method {}.{} took {} ms", pjp.getSignature().getDeclaringType().getSimpleName(), pjp.getSignature().getName(), ms);
            } else if (log.isDebugEnabled()) {
                log.debug("{}.{} took {} ms", pjp.getSignature().getDeclaringType().getSimpleName(), pjp.getSignature().getName(), ms);
            }
        }
    }
}
