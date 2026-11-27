# Spring Boot Concepts Used in This Project

Spring Boot 3.4.5 (Spring Framework 6.2, Jakarta EE 10), Spring Cloud 2024.0.1. Format per concept: **what / why / where / HR use / example / output / pros-cons**. Dependency injection, AOP and the request pipeline have their own guides (`dependency-injection-guide`, `servlet-request-pipeline`).

## 1. Auto-configuration and starters
**What:** adding a *starter* to the POM pulls compatible libraries; Boot auto-configures beans from the classpath and properties. **Why:** no XML, sensible defaults, overridable. **Where:** each `<svc>/pom.xml`; parent `pom.xml` imports the Boot and Cloud BOMs so no version is repeated.
| Starter | Provides | Used by |
|---|---|---|
| `spring-boot-starter-web` | Tomcat, Spring MVC, Jackson | all 15 services |
| `spring-boot-starter-data-jpa` | Hibernate, Spring Data, Hikari | 15 services |
| `spring-boot-starter-security` + `oauth2-jose` | filter chain, JWT decode / encode | services (auth encodes) |
| `spring-boot-starter-validation` | Bean Validation | services |
| `spring-boot-starter-aop` | `@Aspect`, proxies | services |
| `spring-boot-starter-cache` + `data-redis` | `@Cacheable` over Redis | services |
| `spring-kafka` | `@KafkaListener`, `KafkaTemplate` | services |
| `spring-cloud-starter-openfeign` | declarative clients | callers |
| `spring-boot-starter-webflux` | `WebClient` | services (client only) |
| `flyway-core` + `flyway-mysql` | migrations | services |
| `springdoc-openapi` | OpenAPI 3 + Swagger UI | services |
| `spring-cloud-starter-gateway` (reactive) | gateway | api-gateway only |
Main class: `@SpringBootApplication(scanBasePackages = "com.hrportal")` + `@EntityScan` + `@EnableJpaRepositories(considerNestedRepositories = true)` + `@EnableFeignClients` + `@EnableAsync` (e.g. `leave-service/.../HrLeaveApplication.java`). Scanning `com.hrportal` is how the shared `common-library` beans (filters, exception advice, security) reach every service without per-service wiring.

## 2. Externalised configuration
* `application.yml` per service: name, port (`${LEAVE_SERVICE_PORT:9104}`), datasource URL (`hr_leave_db`), Kafka group id, cache TTLs, service-specific `hr.*` settings.
* **Shared defaults** in `common-library/src/main/resources/hr-common.yml`, imported with `spring.config.import: classpath:hr-common.yml`: Hikari (4 connections), Flyway users, JPA batching and `open-in-view: false`, Jackson (UTC, ISO dates, non-null), multipart limits (10 MB / 12 MB), Kafka producer (`acks=all`, idempotent) and consumer (manual-style `ack-mode: record`, earliest), Redis (1 s timeouts), Feign timeouts (2 s / 8 s), graceful shutdown, error body hardening (`include-message/stacktrace/binding-errors: never`), springdoc paths, JWT settings, downstream URLs, WebClient timeouts (2 s connect, 6 s response), outbox timings.
* **Secrets only from the environment:** `${MYSQL_APP_PASSWORD}`, `${JWT_SECRET}`, `${HR_DATA_ENCRYPTION_KEY}` ... no defaults in YAML, so a missing secret fails the start instead of running insecurely.
* Type-safe binding: `@ConfigurationProperties("hr.security")` (`JwtProperties`), `HrCacheProperties`; single values with `@Value("${hr.attendance.escalation-hours:48}")`.
*Output:* starting without `JWT_SECRET` → `Could not resolve placeholder 'JWT_SECRET'` and the context refuses to start.

## 3. Spring MVC (REST layer)
`@RestController`, `@RequestMapping("/api/v1/...")`, `@GetMapping/@PostMapping/...`, `@PathVariable`, `@RequestParam`, `@RequestBody @Valid` records, `ResponseEntity` / plain return values with Jackson. 39 controllers, ~410 endpoints (`api-documentation`). Paging: `PageRequests.of(...)` + `PageResponse<T>`. Errors by `@RestControllerAdvice` (`logging-exception-handling`). Versioned base path `/api/v1`. Controllers contain only HTTP concerns; every rule lives in services.

## 4. Spring Data JPA and transactions
Repositories extend `JpaRepository` (+ `JpaSpecificationExecutor`, custom fragments), derived queries, `@Query`, projections, `@EntityGraph`, `@Lock`, `@Modifying`. `@EnableJpaAuditing` (`HrJpaConfig`) fills `createdBy/At`, `updatedBy/At`. `@Transactional` (144 uses; read paths `readOnly=true`), `TransactionTemplate` for programmatic boundaries, `@TransactionalEventListener`-free design (events go through the outbox). Details: `jpa-hibernate-guide`.

## 5. Spring Security (stateless JWT)
`SecurityFilterChain` bean in `common-library/.../security/CommonSecurityConfig.java`: CSRF off (no cookies / sessions), stateless sessions, security headers (HSTS, `X-Frame-Options: DENY`, `nosniff`, no-referrer, CSP `default-src 'none'`), public paths, custom `JwtAuthenticationFilter`, JSON 401 / 403 handlers, `@EnableMethodSecurity` for `@PreAuthorize` / `@PostAuthorize` with SpEL beans (`@authz`, `@employeeAccess`), `BCryptPasswordEncoder(10)`. Gateway uses the WebFlux flavour. See `security`.

## 6. Caching
`@EnableCaching` + Redis (`CacheConfig`): per-cache TTL map from `hr.cache.ttl.*`, JSON values, key prefix `hr:<service>:<cache>:`, `CacheErrorHandler` makes Redis outages non-fatal, `CacheEvictor` for programmatic eviction. See `redis-guide`.

## 7. Messaging (Spring for Apache Kafka)
`KafkaTemplate` in `EventPublisher` / `OutboxRelay`; `@KafkaListener(topics = ..., groupId = ...)` consumers; `DefaultErrorHandler` + `DeadLetterPublishingRecoverer`; `@RetryableTopic` in the notification service; `NewTopic` beans. See `kafka-guide`.

## 8. Scheduling and async
`@EnableScheduling` + `@Scheduled(cron = ..., zone = "UTC")` jobs, always behind a Redis lock; `@EnableAsync` + the named `hrExecutor` (`ThreadPoolTaskExecutor`) with a context-propagating `TaskDecorator`. See `java-concurrency-guide`.

## 9. Application events and lifecycle
`@EventListener(ApplicationReadyEvent.class)` (re-register escalations), `@PostConstruct` / `@PreDestroy` (queue workers), `BootstrapAdminInitializer` (creates the first SUPER_ADMIN from environment values only when no admin exists), graceful shutdown (`server.shutdown: graceful`, 15 s executor await).

## 10. Flyway integration
Boot runs Flyway before JPA initialises; `hr-common.yml` gives it the migration login and `baseline-on-migrate: false`. `FlywayRepairConfig` (`@ConditionalOnExpression`) swaps in a `FlywayMigrationStrategy` for the opt-in operations `HR_FLYWAY_REPAIR` (repair then migrate) and `HR_FLYWAY_RESET` (clean then migrate; also needs `SPRING_FLYWAY_CLEAN_DISABLED=false`). See `database-design` §11.

## 11. Declarative HTTP clients
OpenFeign (`@FeignClient` + `FeignGlobalConfig` beans) and `WebClient` (`HrWebClient`, `WebClientFactory`). See `feign-webclient-guide`.

## 12. OpenAPI / Swagger
`springdoc` generates `/v3/api-docs` and `/swagger-ui.html` per service; `OpenApiConfig` adds title and the JWT bearer scheme (the "Authorize" button); the gateway routes `/docs/<service>/v3/api-docs` so one UI can list all services. Controllers carry `@Tag` / `@Operation(summary = ...)`. The 410-endpoint list in `api-documentation` is generated from these specs.

## 13. Gateway (Spring Cloud Gateway)
Route definitions in `api-gateway/src/main/resources/application.yml` (15 route groups + docs routes), predicates `Path=...`, filters (`RequestRateLimiter` with `userOrIpKeyResolver`), `GlobalFilter` beans, global CORS, JSON `ErrorWebExceptionHandler`. See `servlet-request-pipeline`.

## 14. Conditional and profile-free design
Behaviour is switched by **properties**, not profiles: `hr.flyway.*`, `HR_EXPOSE_RESET_TOKEN`, e-mail mode (`LOG` / `SMTP`, stored in `email_settings`), `@ConditionalOnWebApplication(SERVLET)` for the servlet components, `@ConditionalOnClass/Expression` for Flyway repair. Same artifact runs locally and in Docker; only environment variables differ.

## 15. What is intentionally absent
No Actuator, metrics, tracing or monitoring dependencies (requirement), no Spring Session (stateless), no template engine, no embedded DB, no tests in this deliverable. Liveness is a plain `/ping` endpoint (`PingController`).

## Pros / cons
| Pros | Cons |
|---|---|
| Convention over configuration: a service is ~1 main class + YAML + code | Auto-configuration "magic" - behaviour comes from the classpath (inspect with `--debug` conditions report) |
| One shared library + shared YAML keeps 15 services consistent | A change to `hr-common.yml` affects every service (rebuild all) |
| Env-driven config suits containers | Many environment variables to manage (see README table) |
