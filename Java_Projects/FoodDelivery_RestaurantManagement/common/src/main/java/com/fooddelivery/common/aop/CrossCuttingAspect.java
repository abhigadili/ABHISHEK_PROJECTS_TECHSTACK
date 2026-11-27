package com.fooddelivery.common.aop;

import com.fooddelivery.common.security.SecurityUtils;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Spring AOP for cross-cutting concerns only (never business rules). Shows every advice type:
 * <ul>
 *   <li>{@code @Before}/{@code @AfterReturning}/{@code @AfterThrowing}/{@code @After} on REST controllers (trace of calls);</li>
 *   <li>{@code @Around} on {@link Audited} methods (audit trail with duration) and on all services (slow-call warning).</li>
 * </ul>
 * Join point = a method execution; pointcut = the expression selecting them; advice = the code run at them.
 */
@Aspect
@Component
public class CrossCuttingAspect {
    private static final Logger log = LoggerFactory.getLogger(CrossCuttingAspect.class);
    private static final Logger audit = LoggerFactory.getLogger("audit");

    @Pointcut("within(@org.springframework.web.bind.annotation.RestController *)")
    void restControllers() { }

    @Pointcut("execution(public * com.fooddelivery..service..*(..))")
    void serviceLayer() { }

    @Before("restControllers()")
    public void before(JoinPoint jp) {
        log.debug("-> {}.{}", jp.getSignature().getDeclaringType().getSimpleName(), jp.getSignature().getName());
    }

    @AfterReturning(pointcut = "restControllers()", returning = "result")
    public void afterReturning(JoinPoint jp, Object result) {
        log.debug("<- {} returned {}", jp.getSignature().getName(), result == null ? "null" : result.getClass().getSimpleName());
    }

    @AfterThrowing(pointcut = "restControllers()", throwing = "ex")
    public void afterThrowing(JoinPoint jp, Throwable ex) {
        log.debug("!! {} threw {}", jp.getSignature().getName(), ex.getClass().getSimpleName());
    }

    @After("restControllers()")
    public void after(JoinPoint jp) {
        log.trace("== {} finished", jp.getSignature().getName());
    }

    @Around("@annotation(audited)")
    public Object auditTrail(ProceedingJoinPoint pjp, Audited audited) throws Throwable {
        String who = SecurityUtils.currentUser().map(u -> u.username() + "#" + u.userId()).orElse("system");
        long start = System.nanoTime();
        try {
            Object r = pjp.proceed();
            audit.info("AUDIT action={} actor={} outcome=SUCCESS durationMs={}", audited.value(), who, (System.nanoTime() - start) / 1_000_000);
            return r;
        } catch (Throwable t) {
            audit.warn("AUDIT action={} actor={} outcome=FAILURE reason={}", audited.value(), who, t.getMessage());
            throw t;
        }
    }

    @Around("serviceLayer()")
    public Object timing(ProceedingJoinPoint pjp) throws Throwable {
        long start = System.nanoTime();
        try {
            return pjp.proceed();
        } finally {
            long ms = (System.nanoTime() - start) / 1_000_000;
            if (ms > 1000) log.warn("Slow service call {} took {} ms", pjp.getSignature().toShortString(), ms);
            else log.debug("{} took {} ms", pjp.getSignature().toShortString(), ms);
        }
    }
}
