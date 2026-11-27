# Servlet Request Pipeline

Where each interception mechanism sits, what it can see, and what this project uses it for.

```
Client
  │  HTTPS
  ▼
┌─ API GATEWAY (reactive, Netty) ───────────────────────────────────────────────┐
│  Gateway GLOBAL FILTERS  CorrelationIdFilter(order -2^31) → RequestLoggingFilter(+10)       │
│  Spring Security WebFlux: CORS → JWT decode + Redis revocation → path/role rules             │
│  Route filter: RequestRateLimiter (Redis, key = user or IP) → route to service               │
└───────────────────────────────────────────────────────────────────────────────┘
  │  HTTP + Authorization + X-Correlation-Id + X-Forwarded-For
  ▼
┌─ SERVICE (Tomcat, Servlet 6) ───────────────────────────────────────────────────┐
│ SERVLET FILTERS (javax/jakarta Filter chain, before the servlet)                          │
│   1 CorrelationIdFilter         @Order(HIGHEST)       MDC correlationId, response header   │
│   2 RequestLoggingFilter        @Order(HIGHEST+10)    access log "--> / <--" (query masked)│
│   3 RequestHeaderValidationFilter @Order(HIGHEST+20)  400 on bad URL / header / id          │
│   4 Spring Security FilterChain  → JwtAuthenticationFilter → authorizeHttpRequests          │
│ DispatcherServlet ──► HandlerMapping (which controller method?)                            │
│ HANDLER INTERCEPTORS (/api/**, preHandle in order, afterCompletion in reverse)             │
│   1 RequestTimingInterceptor    order 1   start clock; slow-handler warning                │
│   2 RequestMetadataInterceptor  order 2   client IP, user agent → RequestContext + MDC     │
│   3 UserContextInterceptor      order 3   identity → RequestContext; must-change-password rule│
│ Argument resolvers: @RequestBody JSON → record, Bean Validation (@Valid)                   │
│ AOP: @PreAuthorize / @PostAuthorize proxy → ServiceTimingAspect → @Transactional proxy     │
│ CONTROLLER ─► SERVICE ─► REPOSITORY ─► MySQL                                              │
│ @RestControllerAdvice GlobalExceptionHandler  (any exception → ApiError JSON)             │
└───────────────────────────────────────────────────────────────────────────────┘
Also mapped directly in the servlet container:  /servlet/info → ServiceInfoServlet (plain HttpServlet, bypasses Spring MVC)
```

## Comparison
| | **Servlet Filter** | **HandlerInterceptor** | **AOP (aspect)** | **Gateway filter** |
|---|---|---|---|---|
| Layer | Servlet container | Spring MVC | Spring beans (proxies) | Spring Cloud Gateway (WebFlux) |
| Sees | raw request / response, **every** URL (incl. `/ping`, errors, static) | handler (controller method) + request | Java method calls (controllers, services, Kafka listeners, jobs) | reactive `ServerWebExchange` before the service is called |
| Can | wrap / replace request, short-circuit, set response headers, work before Spring Security | `preHandle` (veto), `postHandle`, `afterCompletion`; knows the handler | wrap any bean method: timing, security, transactions, retries; arguments and return value | route, rewrite, rate-limit, authenticate once for **all** services |
| Cannot | know which controller method runs | see non-MVC requests (servlet, Kafka) | see HTTP details (unless injected) | see inside a service |
| Registered by | `@Component` + `@Order` (`OncePerRequestFilter`) | `WebMvcConfigurer.addInterceptors` | `@Aspect @Component` | `GlobalFilter` bean / route config |
| Project example | `CorrelationIdFilter`, `RequestLoggingFilter`, `RequestHeaderValidationFilter`, `JwtAuthenticationFilter` | `RequestTimingInterceptor`, `RequestMetadataInterceptor`, `UserContextInterceptor` | `ServiceTimingAspect`; `@PreAuthorize`, `@Transactional`, `@Cacheable` (all AOP proxies) | gateway `CorrelationIdFilter`, `RequestLoggingFilter`, `RequestRateLimiter`, JWT security |

**Rule of thumb:** *transport concerns* (ids, logging, size limits, auth token) → filter; *MVC-aware concerns* (who is calling this handler, per-handler rules) → interceptor; *business-method concerns* (timing, authorisation, transactions, caching) → AOP; *cross-service concerns* (edge auth, rate limit, routing) → gateway.

## 1. Servlet filters (`common-library/.../web/`)
```java
@Component @Order(Ordered.HIGHEST_PRECEDENCE)
public class CorrelationIdFilter extends OncePerRequestFilter {
    protected void doFilterInternal(req, res, chain) {
        String id = req.getHeader("X-Correlation-Id");
        if (id == null || !VALID_ID.matcher(id).matches()) id = UUID.randomUUID().toString();
        MDC.put("correlationId", id);  res.setHeader("X-Correlation-Id", id);
        try { chain.doFilter(req, res); } finally { MDC.clear(); }
    }
}
```
* `RequestLoggingFilter` writes `--> GET /api/v1/employees/directory?q=...` and `<-- GET ... 200 (9 ms)`; query values of sensitive parameters are masked (`LogMasker.maskQuery`); `/ping` is skipped; bodies are never logged.
* `RequestHeaderValidationFilter` rejects path traversal / NUL bytes, headers over 8 KB and malformed correlation ids with 400 before anything else runs.
* `JwtAuthenticationFilter` (inside the Security chain, before `BasicAuthenticationFilter`) validates the token, checks Redis revocation and fills the `SecurityContext`; failures return the JSON 401 from `JsonSecurityHandlers`.
**Real log lines** (employee service):
```
15:49:07.584 INFO [hr-employee-service] [cid=3b16743f-...] http.access - --> GET /api/v1/employees/directory?q=priya
15:49:07.593 INFO [hr-employee-service] [cid=3b16743f-...] http.access - <-- GET /api/v1/employees/directory 200 (9 ms)
```
The same `X-Correlation-Id` is returned to the client and appears in the gateway log, every service log, Kafka event metadata and `ApiError.correlationId`.

## 2. Handler interceptors (`WebMvcInterceptorConfig`)
```java
registry.addInterceptor(timing).addPathPatterns("/api/**").order(1);
registry.addInterceptor(metadata).addPathPatterns("/api/**").order(2);
registry.addInterceptor(userContext).addPathPatterns("/api/**").order(3);
```
* `RequestTimingInterceptor` - start nanos in `preHandle`; in `afterCompletion` logs `Slow handler ... took N ms` above 1.5 s (DEBUG otherwise). (`postHandle` is too early for `@RestController` responses - they are already committed.)
* `RequestMetadataInterceptor` - client IP (first `X-Forwarded-For` entry or remote address), user agent (200 chars) → request-scoped `RequestContext` and MDC `clientIp`.
* `UserContextInterceptor` - copies user id / employee id / username into `RequestContext` and **enforces the must-change-password rule**: a flagged user may only call change-password, logout and `/me`; every other API returns `403 PASSWORD_CHANGE_REQUIRED`.
* `RequestContext` is a `@RequestScope` bean injected through `ObjectProvider` so singleton services can read per-request data safely.

## 3. The servlet itself
`ServiceInfoServlet` (plain `HttpServlet`, registered with `ServletRegistrationBean` in `ServletRegistrationConfig` at `/servlet/info`) demonstrates the raw Servlet API:
```bash
curl localhost:9102/servlet/info
{"service":"hr-employee-service","java":"21.0.7","startedAt":"2026-11-25T08:52:37.951124939Z","uptimeSeconds":5194,"servletApi":"6.0"}
```

## 4. AOP (`ServiceTimingAspect`)
```java
@Around("within(@org.springframework.stereotype.Service *) && execution(public * *(..))")
public Object time(ProceedingJoinPoint pjp) throws Throwable { ... pjp.proceed() ... warn if > hr.aop.slow-service-ms (2000) }
```
Applies to every `@Service` method - including Kafka listeners' delegates and scheduled jobs that never pass through a servlet filter. Arguments are not logged (may contain salary or personal data). Other AOP in play: method security (`@PreAuthorize` / `@PostAuthorize`), `@Transactional`, `@Cacheable`/`@CacheEvict` - all implemented by Spring AOP proxies; their relative order is decided by advisor order, so none of them may rely on another running first. **Gotcha:** self-invocation (`this.method()`) bypasses the proxy, so annotated methods are called through another bean (e.g. `TransactionTemplate` where a transaction is needed inside a class).

## 5. Gateway filters (`api-gateway`)
* Global filters: `CorrelationIdFilter` (accepts a well-formed `X-Correlation-Id` or generates one; adds `X-Forwarded-For`; writes the response header in `beforeCommit` so it appears once) and `RequestLoggingFilter` (access log with status and duration). Both implement `GlobalFilter, Ordered`.
* Security: `GatewaySecurityConfig` - JWT decoding + Redis revocation check (`hr:auth:revoked:<jti>`), public paths, role rules per path, CORS, JSON error bodies (`GatewayErrorHandler`).
* Route filter `RequestRateLimiter` (Redis token bucket: 20 req/s, burst 40; 10 req/s, burst 20 on the OpenAPI docs routes) with `userOrIpKeyResolver`. Headers returned: `X-RateLimit-Remaining`, `-Burst-Capacity`, `-Replenish-Rate`; exceeding → `429`.
**Real response headers through the gateway:** `X-Correlation-Id`, `X-RateLimit-Remaining: 39`, `X-RateLimit-Burst-Capacity: 40`, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`.

## 6. Error path
Exceptions thrown anywhere after the DispatcherServlet starts are converted by `GlobalExceptionHandler` (`@RestControllerAdvice`, an MVC component). Exceptions thrown *before* it (in filters, e.g. an invalid JWT) cannot reach it, so `JsonSecurityHandlers` and the filters write the same `ApiError` JSON themselves.

## Pros / cons
| Mechanism | Pros | Cons |
|---|---|---|
| Filter | earliest, covers everything, framework-independent | no handler knowledge; ordering mistakes (e.g. before vs after Security) |
| Interceptor | handler-aware, easy veto | MVC-only, response may be committed in `postHandle` |
| AOP | no business-code clutter, works off-HTTP | proxy limits (self-invocation, final classes), harder to trace |
| Gateway filter | one place for all services | reactive programming model; a single point everything depends on |
