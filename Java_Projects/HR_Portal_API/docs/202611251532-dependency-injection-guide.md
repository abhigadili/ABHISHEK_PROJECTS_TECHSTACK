# Dependency Injection Guide

**What:** instead of a class creating its collaborators (`new TaxGateway()`), the Spring container creates them once and hands them in. **Why:** loose coupling (swap implementations), one place for configuration (URLs, secrets, timeouts), singletons managed for you, AOP proxies (transactions, security, caching) applied transparently.
Project scale: 72 `@Service`, 76 `@Component`, 39 `@RestController`, 2 `@Repository` plus Spring Data repositories and `@Configuration` classes. All applications scan `com.hrportal` (`@SpringBootApplication(scanBasePackages = "com.hrportal")`), which picks up `common-library` beans in every service.

## 1. Constructor injection (the default everywhere)
```java
@Component
public class PayrollInputGatherer {
    private final EmployeeClient employees;  private final AttendanceClient attendance;  private final LeaveClient leave;
    private final TaxGateway tax;            private final Executor executor;
    public PayrollInputGatherer(EmployeeClient employees, AttendanceClient attendance, LeaveClient leave, TaxGateway tax,
                                @Qualifier("hrExecutor") Executor executor) { ... }
}
```
Fields are `final`, the class cannot exist half-wired, and tests / other code can construct it by hand. There is no field injection (`@Autowired` appears nowhere) and no Lombok-generated constructors - what a class depends on is visible in its signature.
**Output / behaviour:** startup fails fast with `UnsatisfiedDependencyException` naming the missing bean if a dependency is absent.

## 2. Stereotypes and what they mean
| Annotation | Layer | Example |
|---|---|---|
| `@RestController` | HTTP adapter | `LeaveController`, `PayrollRunController` |
| `@Service` | business logic, transaction boundary | `LeaveApplicationService`, `PayrollRunService` |
| `@Repository` / Spring Data interfaces | persistence | `AttendanceJdbc`, `EmployeeRepository` |
| `@Component` | any other bean | filters, interceptors, queues, calculators |
| `@Configuration` + `@Bean` | explicit construction of third-party objects | `AsyncConfig`, `CacheConfig`, `FeignGlobalConfig`, `KafkaCommonConfig`, `CommonSecurityConfig` |

## 3. `@Bean` methods (third-party or parameterised objects)
```java
@Bean(name = "hrExecutor") ThreadPoolTaskExecutor hrExecutor(TaskDecorator decorator) { ... }   // AsyncConfig
@Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(10); }                // CommonSecurityConfig
@Bean Retryer hrRetryer() { return new Retryer.Default(200, 1000, 3); }                          // FeignGlobalConfig
@Bean JwtDecoder jwtDecoder(JwtProperties props) { ... }   // parameters are injected too
```

## 4. Qualifiers - choosing among several beans of one type
```java
@Qualifier("hrExecutor") Executor executor        // PayrollInputGatherer, AsyncReportService, MonthlyAttendanceService
```
Without it Spring would see several `Executor`-type beans (Boot's `applicationTaskExecutor` and ours) and fail with `NoUniqueBeanDefinitionException`.

## 5. Injecting all implementations of an interface (Strategy pattern)
```java
public SalaryCalculationEngine(List<ComponentCalculator> all, OvertimePay overtimePay) {
    all.forEach(c -> calculators.put(c.supports(), c));          // EnumMap<CalcType, ComponentCalculator>
}
```
Spring injects **every** `ComponentCalculator` bean (`payroll-service/.../engine/Calculators.java`: FIXED, PERCENT_OF_CTC, PERCENT_OF_BASIC, BALANCE, STATUTORY_PF, SLAB_PT, TAX_TDS, VARIABLE). Adding a calculation type = add one `@Component`; the engine needs no change (open/closed principle).

## 6. Configuration values and typed properties
```java
@Value("${hr.attendance.escalation-hours:48}") long hours             // single value with default
@ConfigurationProperties("hr.security") class JwtProperties { ... }   // type-safe group: secret, token minutes, public paths
@ConfigurationProperties("hr.cache")    class HrCacheProperties { Duration defaultTtl; Map<String, Duration> ttl; }
```
Secrets arrive only through environment variables referenced from YAML (`${JWT_SECRET}`), never from code.

## 7. Scopes and scoped proxies
* Singleton (default) for everything stateless.
* `@RequestScope` - `RequestContext` is created per HTTP request. A singleton service cannot hold a request-scoped bean directly, so it is injected as `ObjectProvider<RequestContext>` (or a scoped proxy) and resolved when used (`UserContextInterceptor`, `RequestTimingInterceptor`, `RequestMetadataInterceptor`).

## 8. Circular dependencies and `@Lazy`
`PunchImportQueue` needs `AttendanceService` and `AttendanceService` publishes to the queue. The cycle is broken at one edge: `PunchImportQueue(@Lazy AttendanceService attendance, ...)` receives a lazy proxy resolved on first use. `CorrectionEscalationQueue` / `CorrectionService` use the same technique. Prefer redesign over `@Lazy`; it is used only where the queue is a genuine callback target.

## 9. Conditional beans
`@ConditionalOnWebApplication(SERVLET)` (servlet filters/interceptors are not loaded in the reactive gateway), `@ConditionalOnClass` / `@ConditionalOnExpression` (`FlywayRepairConfig` is created only when `hr.flyway.repair-on-start` or `reset-on-start` is true).

## 10. Lifecycle callbacks
`@PostConstruct` starts the queue workers (`PunchImportQueue`, `EmailDispatchQueue`, `CorrectionEscalationQueue`) and stores the service name for event metadata (`KafkaCommonConfig`); `@PreDestroy` stops the workers; `@EventListener(ApplicationReadyEvent.class)` re-registers pending corrections after start-up (`CorrectionService`); `auth-service/.../config/BootstrapAdminInitializer` creates the first super admin from `HR_BOOTSTRAP_ADMIN_*` at start-up.

## 11. How proxies interact with DI
Beans that carry `@Transactional`, `@PreAuthorize`, `@Cacheable` or match `ServiceTimingAspect` are injected as **proxies** (CGLIB subclasses): classes and public methods must not be `final`, and calling a method on `this` bypasses the proxy (so a `TransactionTemplate` is used where a transaction is needed inside one class, e.g. `PayrollRunService`, `SettlementService`).

## 12. Dependency map (example: leave application)
```
LeaveController ──► LeaveApplicationService ──► LeaveBalanceService ──► LeaveBalanceRepository (JPA) , CacheEvictor
                                           ├──► EmployeeClient (Feign) ──► employee-service
                                           ├──► HolidayGateway (WebClient) ──► holiday-service
                                           ├──► LeaveDurationService ──► JdbcTemplate ──► fn_leave_duration
                                           ├──► DistributedLockService ──► Redis
                                           ├──► LeaveEventProducer ──► EventPublisher ──► outbox_events ──► Kafka
                                           └──► AuditService ──► audit_history
```

## Pros / cons
| Pros | Cons |
|---|---|
| Replaceable, testable collaborators; central configuration | "Magic" at start-up: wiring errors appear at runtime, not compile time |
| Constructor injection documents dependencies and enforces immutability | Large constructors signal a class doing too much (several services here have 8-10 parameters - candidates for splitting) |
| AOP/proxies add cross-cutting behaviour without code changes | Proxy pitfalls (self-invocation, final classes) |
