# Student Management System — Application Architecture and Execution Flow Guide

**A beginner-friendly, source-verified walkthrough of the Java 21 / Spring Boot 3.4.5 microservices project**

| | |
|---|---|
| Project root | `~/Documents/Java_Projects/StudentManagement` (all paths in this guide are relative to it unless a table says otherwise) |
| Generated | 10 November 2026 |
| Scope | Documentation only. No source file, configuration, database structure or business logic was modified to produce this guide. |
| Test files | Excluded from the per-file explanations (as requested); they are mentioned only where they prove a behaviour. |
| Secrets | No password, token or secret value is printed. Where a setting has a development default, the guide says "a development default exists" instead of showing it. |


## Table of Contents

- **1. How to Read This Guide**
    - 1.1 Who this is for
    - 1.2 Conventions used
    - 1.3 The ten-second summary
    - 1.4 Recommended way to read
- **2. Project Structure — What Every Folder Is For**
    - 2.1 Top-level layout
    - 2.2 Maven multi-module build
    - 2.3 Package layout inside a service
- **3. The Build Configuration (Maven `pom.xml`)**
    - 3.1 The parent `pom.xml`
    - 3.2 External dependencies and why each is there
    - 3.3 Module build files
- **4. Application Startup Flow — From Zero**
    - 4.1 Step 0 — How the application is executed
    - 4.2 Step 1 — The `main()` method
    - 4.3 Step 2 — What `SpringApplication.run()` does
    - 4.4 Step 3 — What `@SpringBootApplication` means
    - 4.5 Step 4 — The ApplicationContext
    - 4.6 Step 5 — How Spring identifies and creates beans
    - 4.7 Step 6 — Dependency Injection and constructor injection
    - 4.8 Step 7 — How `common-web` joins every service (auto-configuration)
    - 4.9 Step 8 — How configuration properties are loaded
    - 4.10 Step 9 — How database connections are initialised
    - 4.11 Step 10 — How repositories and other components become available
    - 4.12 Step 11 — How embedded Tomcat starts
    - 4.13 Step 12 — When is the application "ready"?
    - 4.14 Startup differences per program
- **5. Java and Spring Boot Fundamentals, Tied to This Code**
    - 5.1 Classes, objects, constructors, access modifiers, encapsulation
    - 5.2 Interfaces and implementations, polymorphism, abstraction
    - 5.3 Inheritance
    - 5.4 Records (immutable data carriers) and enums
    - 5.5 Generics and collections
    - 5.6 Exceptions
    - 5.7 Lambdas, streams, method references
    - 5.8 Annotations
    - 5.9 Inversion of Control and Dependency Injection
    - 5.10 REST APIs and JSON
    - 5.11 DTOs versus entities, ORM
    - 5.12 Transactions
- **6. Every Spring Boot Layer in This Project**
    - 6.1 Why layers exist
    - 6.2 Interface versus implementation in this code
    - 6.3 Layer inventory — Student Service
    - 6.4 Layer inventory — Course Service
    - 6.5 Layer inventory — Enrollment Service
    - 6.6 Layer inventory — Notification Service
    - 6.7 Layer inventory — shared libraries, gateway, registry
- **7. Annotations Actually Used in the Project**
    - 7.1 Spring Boot / stereotype / configuration
    - 7.2 Web / request mapping
    - 7.3 Validation
    - 7.4 Persistence / JPA / Hibernate
    - 7.5 Security
    - 7.6 Caching, messaging, scheduling, resilience, OpenAPI
    - 7.7 Lombok
- **8. Configuration and Environment Management**
    - 8.1 What `application.yml` is
    - 8.2 Precedence (highest wins)
    - 8.3 Common keys explained (present in the four business services)
    - 8.4 Service-specific keys
    - 8.5 Environment variables in one table
    - 8.6 Profiles
    - 8.7 Which configuration is loaded where
- **9. Database Execution Flow**
    - 9.1 Connection configuration
    - 9.2 The four databases and who owns what
    - 9.3 Entity ⇄ table mapping and relationships
    - 9.4 Lazy versus eager loading
    - 9.5 Repositories and CRUD
    - 9.6 JPQL queries (no native SQL)
    - 9.7 How Java objects become rows and back
    - 9.8 Transactions, commit and rollback — exactly where used
    - 9.9 Concurrency control in the database (three techniques)
    - 9.10 Redis caching (database-read shortcut)
    - 9.11 One complete database operation traced end to end
- **10. Dependency Injection and Bean Lifecycle**
    - 10.1 Beans and the ApplicationContext
    - 10.2 Constructor injection versus field injection
    - 10.3 How interfaces and implementations are injected
    - 10.4 Scopes
    - 10.5 Initialisation and destruction lifecycle
    - 10.6 Circular dependencies
- **11. API Request and Response Lifecycle**
    - 11.1 The generic path through this application
    - 11.2 Which components are *different* for non-standard requests
- **12. Every Endpoint and Its Complete Execution Flow**
    - 12.1 Endpoint catalogue (36 business endpoints)
    - 12.2 Infrastructure endpoints (not business logic)
    - 12.3 The common prefix and suffix of every flow
    - 12.4 Student Service endpoints (`/api/auth`, `/api/students`)
    - 12.5 Course Service endpoints (`/api/courses`)
    - 12.6 Enrollment Service endpoints (`/api/enrollments`)
    - 12.7 Notification Service endpoints (`/api/notifications`)
    - 12.8 Gateway-only endpoint: `/fallback/{service}`
- **13. Authentication and Authorization Flow**
    - 13.1 What is implemented and what is not
    - 13.2 Roles
    - 13.3 Token contents
    - 13.4 Login flow, step by step
    - 13.5 Protected request flow
    - 13.6 Filters that run before the controller (in order)
    - 13.7 Token expiry and refresh
    - 13.8 Passwords
- **14. Multi-Microservice Architecture**
    - 14.1 What exists (and what does not)
    - 14.2 Eureka (service discovery)
    - 14.3 API Gateway routing table
    - 14.4 Synchronous communication: OpenFeign
    - 14.5 Service-to-service authentication and correlation
    - 14.6 Resilience4j around every remote call
    - 14.7 The enrollment saga (distributed transaction)
    - 14.8 Transactional outbox and the Kafka producer
    - 14.9 Consuming events: inbox, notification, dispatcher, dead letters
    - 14.10 CQRS in Enrollment Service
    - 14.11 Error handling between services
    - 14.12 One complete multi-service business transaction
- **15. Scripts and Execution Commands**
    - 15.1 `scripts/start-local.sh` — start the whole stack as local JVMs
    - 15.2 `scripts/stop-local.sh` — stop by port
    - 15.3 `scripts/e2e.py` — end-to-end verification through the gateway
    - 15.4 `scripts/verify-db.sh` — read-only database check
    - 15.5 Maven, Docker and run commands
    - 15.6 Useful URLs while running
- **16. Real Code Tracing Examples**
    - 16.1 Use case A — Create a student (`POST /api/students`)
    - 16.2 Use case B — Enroll a student (`POST /api/enrollments`)
    - 16.3 Use case C — From enrolment event to e-mail (asynchronous)
    - 16.4 Use case D — Login and an authorised call
    - 16.5 Use case E — Cancel an enrolment (`POST /api/enrollments/77/cancel`)
- **17. Exception Handling and Validation Flow**
    - 17.1 Where validation happens (three layers)
    - 17.2 Exceptions and their HTTP mapping
    - 17.3 How exceptions propagate
    - 17.4 Trace: a successful request
    - 17.5 Trace: failed requests
    - 17.6 Logging and debugging
- **18. Architecture and Design Decisions**
    - 18.1 Patterns that **are** implemented (with the proof)
    - 18.2 SOLID, applied
    - 18.3 Background concepts that are **not** implemented here
- **19. Glossary**
- **20. Beginner Learning and Navigation Guide**
    - 20.1 Recommended reading order
    - 20.2 Suggested practice
- **21. Verification, Known Gaps and Limitations**
    - 21.1 How this guide was verified
    - 21.2 What could not be verified from source
    - 21.3 Known gaps and observations found while documenting
- **22. Index of Source Files**

---

# 1. How to Read This Guide

## 1.1 Who this is for

You know a little programming but are new to Java and Spring Boot. Every technical term is explained the first time it appears, always in the same order: **what** it is, **why** it exists, **where** it lives in this project, and **how** it behaves at run time. Nothing is assumed about Spring.

## 1.2 Conventions used

| Convention | Meaning |
|---|---|
| `path/File.java` | A real file. Every path in this guide was checked against the file system by a script (see section 21). |
| `Class#method` | A method of a class, e.g. `StudentService#create`. |
| "Base path" line above a table | The directory prefix that is common to all files in that table. Prepend it to get the complete relative path. |
| Numbered lists | Execution flows. Follow them top to bottom; each number is one thing that happens at run time. |
| **Not implemented** / **Could not be verified** | Used whenever a feature is absent or the source cannot prove it. Nothing is invented. |

The guide uses **no diagrams or flowcharts**, only numbered text flows, as requested.

## 1.3 The ten-second summary

The application is a **student course-enrolment system** split into small independent Spring Boot programs ("microservices"). A client (browser, Postman, the `e2e.py` script) talks only to the **API Gateway** on port 8080. The gateway checks the login token and forwards the call to one of four business services:

| Service | Port | Owns database | Business job |
|---|---|---|---|
| Student Service | 8081 | `StudentDB` | Students, user accounts, login (JWT), refresh tokens |
| Course Service | 8082 | `CourseDB` | Courses, categories, **seat counts** and seat reservations |
| Enrollment Service | 8083 | `EnrollmentDB` | Enrolling a student in a course (a multi-step **saga**), cancelling, history |
| Notification Service | 8084 | `NotificationDB` | Listens to Kafka events and "sends" (simulated) e-mails |

Two infrastructure programs complete the system: **Eureka Server** (port 8761, a phone book of running services) and the **API Gateway** (port 8080, the single front door). Redis (cache), Kafka (message broker) and Jaeger (tracing UI) run as Docker containers; MySQL runs on the host.

## 1.4 Recommended way to read

Read sections 2 → 5 once to get the vocabulary, then jump to section 12 (endpoints) and section 16 (code tracing) and follow the real source files side by side. Section 20 gives a precise reading order.

---

# 2. Project Structure — What Every Folder Is For

## 2.1 Top-level layout

```
StudentManagement/
├── pom.xml                      parent build file (Maven)
├── README.md                    run instructions
├── docker-compose.yml           infra + app containers
├── .env / .env.example          local environment values (git-ignored / template)
├── common/
│   ├── event-contracts/         Kafka message shapes (plain Java, no Spring)
│   └── common-web/              shared JWT, filters, error handling (auto-configured library)
├── eureka-server/               service registry
├── api-gateway/                 single entry point (reactive Spring Cloud Gateway)
├── services/
│   ├── student-service/
│   ├── course-service/
│   ├── enrollment-service/
│   └── notification-service/
├── scripts/                     start-local.sh, stop-local.sh, e2e.py, verify-db.sh
├── kubernetes/                  K8s manifests (written, not applied)
├── monitoring/                  Prometheus + Grafana provisioning
├── docker/ , database/          notes about DB connectivity / existing schemas
└── Documentation/               30 topic documents (00-29)
```

The tree above is a *directory listing*, not a diagram of behaviour; the behaviour is explained in numbered flows later.

## 2.2 Maven multi-module build

Maven is the tool that compiles the code, downloads libraries and packages programs. The file `pom.xml` (Project Object Model) in the root is the **parent**. It declares eight **modules**:

| Module (folder) | Packaging result | Kind |
|---|---|---|
| `common/event-contracts` | plain JAR library | Library used by Course, Enrollment, Notification |
| `common/common-web` | plain JAR library (auto-configuration) | Library used by all services and the gateway |
| `eureka-server` | executable Spring Boot JAR | Program |
| `api-gateway` | executable Spring Boot JAR | Program |
| `services/student-service` | executable Spring Boot JAR | Program |
| `services/course-service` | executable Spring Boot JAR | Program |
| `services/enrollment-service` | executable Spring Boot JAR | Program |
| `services/notification-service` | executable Spring Boot JAR | Program |

Every program has exactly one class with a `main()` method (section 4.1). The two `common/*` modules have no `main()`; they are *libraries* that other modules list as a dependency.

## 2.3 Package layout inside a service

All four business services use the same layered package layout. Learn it once and every service looks familiar:

| Package | Contains | Layer name (section 6) |
|---|---|---|
| `controller` | Classes that receive HTTP requests | Controller |
| `service` | Business rules | Service |
| `repository` | Interfaces that talk to the database | Repository |
| `entity` | Classes mapped to database tables, plus enums | Entity |
| `dto` | Request / response shapes (Java `record`s) | DTO |
| `mapper` | Entity ⇄ DTO converters | Mapper |
| `config` | Spring configuration (security, cache, Kafka) | Configuration |
| `validation` | Custom validation annotations | Validation |
| `client`, `command`, `query`, `saga`, `outbox`, `event` | Enrollment-only packages (section 14) | Integration / CQRS / Messaging |
| `consumer`, `processing` | Notification-only packages | Messaging |

Resources live under `src/main/resources`: `application.yml` (settings) and `db/migration/V*.sql` (database scripts run by Flyway).

---

# 3. The Build Configuration (Maven `pom.xml`)

## 3.1 The parent `pom.xml`

File: `pom.xml`

| Part | What it does |
|---|---|
| `<parent> spring-boot-starter-parent 3.4.5` | Inherits Spring Boot's tested set of library versions, Java compiler settings and the `-parameters` flag (needed so Spring can see method parameter *names*, e.g. `#id` in security expressions). |
| `<java.version>21` | Compiles with Java 21 (records, switch expressions, pattern matching are used). |
| `<modules>` | The eight modules listed above, built in this order. |
| `<dependencyManagement>` | Imports `spring-cloud-dependencies 2024.0.1` (a version catalogue for Gateway, Eureka, OpenFeign...) and pins `springdoc 2.8.6`, `jjwt 0.12.6`, `resilience4j 2.2.0`. "Management" means *versions only*: nothing is added to a module until the module itself declares the dependency. |
| `maven-failsafe-plugin` | Runs classes named `*IT` (integration tests using Testcontainers) in the `verify` phase, separately from fast unit tests. |
| `spring-boot-maven-plugin` config | Excludes Lombok from the final executable JAR (Lombok is needed only to compile). |

## 3.2 External dependencies and why each is there

A **dependency** is a library the build downloads. A *starter* is a bundle of related libraries.

| Dependency | Used by | Purpose |
|---|---|---|
| `spring-boot-starter-web` | 4 services | Spring MVC + embedded Tomcat: HTTP controllers. |
| `spring-cloud-starter-gateway` | gateway | Reactive (Netty) gateway: routing and filters. |
| `spring-boot-starter-validation` | 4 services | Bean Validation (`@NotBlank`, `@Valid`...). |
| `spring-boot-starter-security` | 4 services | Spring Security filter chain and method security. |
| `spring-boot-starter-data-jpa` | 4 services | JPA + Hibernate + Spring Data repositories. |
| `mysql-connector-j` (runtime) | 4 services | The JDBC driver that speaks to MySQL. |
| `flyway-core`, `flyway-mysql` | 4 services | Versioned database migrations. |
| `spring-cloud-starter-netflix-eureka-client` | gateway + 4 services | Register in / look up from Eureka. |
| `spring-cloud-starter-netflix-eureka-server` | eureka-server | The registry itself. |
| `spring-cloud-starter-loadbalancer` | gateway, enrollment | Client-side load balancing for `lb://` and Feign names. |
| `spring-cloud-starter-openfeign` | enrollment | Declarative HTTP clients (`StudentClient`, `CourseClient`). |
| `resilience4j-spring-boot3`, `spring-boot-starter-aop`, `spring-cloud-starter-circuitbreaker-resilience4j` | enrollment | Retry, circuit breaker, time limiter, bulkhead annotations. |
| `spring-cloud-starter-circuitbreaker-reactor-resilience4j` | gateway | Circuit breaker filter with fallback. |
| `spring-kafka` | course, enrollment, notification | Kafka producer/consumer support. |
| `spring-boot-starter-data-redis`, `spring-boot-starter-cache` | student, course | Redis-backed `@Cacheable`. |
| `jjwt-api / impl / jackson` | common-web | Create and verify JWT tokens. |
| `springdoc-openapi-starter-webmvc-ui` (and `-webflux-ui` for the gateway) | all | Swagger UI + OpenAPI JSON. |
| `spring-boot-starter-actuator`, `micrometer-registry-prometheus` | all | Health and metrics endpoints. |
| `micrometer-tracing-bridge-otel`, `opentelemetry-exporter-otlp` | all | Distributed tracing to Jaeger. |
| `lombok` (optional) | 4 services | Generates getters/setters at compile time. |
| `testcontainers`, `spring-boot-testcontainers`, `spring-security-test`, `spring-boot-starter-test` (test scope) | 4 services | Tests only; not explained further (test files are out of scope). |

## 3.3 Module build files

Each module's own `pom.xml` lists only what that module needs, using versions from the parent. Notable details:

- `common/common-web/pom.xml` marks `spring-boot-starter-web`, `-security`, `-validation`, `-actuator`, `spring-kafka` and `springdoc` as `<optional>true</optional>`. Optional means *"I need it to compile, but do not force it onto my users"*. The reactive gateway reuses `JwtTokenService` from this library without being forced to pull in Spring MVC (which would conflict with its reactive engine).
- `common/event-contracts/pom.xml` has **no dependencies at all**: the Kafka message classes are plain Java so any service can use them.
- Each program module contains `spring-boot-maven-plugin`, which turns the compiled classes plus libraries into one runnable "fat" JAR (`<module>/target/<name>-1.0.0.jar`).

---

# 4. Application Startup Flow — From Zero

This section explains what happens between typing `java -jar student-service-1.0.0.jar` and the first request being served. The example class is `StudentServiceApplication`, but all six programs follow the same sequence.

## 4.1 Step 0 — How the application is executed

```
java -jar services/student-service/target/student-service-1.0.0.jar
```

The JVM (Java Virtual Machine) opens the JAR, reads `META-INF/MANIFEST.MF` and finds the *start class* written there by the Spring Boot Maven plugin (a small `JarLauncher`). The launcher sets up the class loader for the libraries packed inside the JAR and finally calls `main()` of our class. In practice `scripts/start-local.sh` runs this command for you (section 15).

## 4.2 Step 1 — The `main()` method

File: `services/student-service/src/main/java/com/example/student/StudentServiceApplication.java`

```java
@SpringBootApplication
public class StudentServiceApplication {
    public static void main(String[] args) { SpringApplication.run(StudentServiceApplication.class, args); }
}
```

- `public static void main(String[] args)` is the standard Java entry point: the JVM looks for exactly this signature. `args` are the command-line arguments (for example `--server.port=9000`).
- It does one thing: calls `SpringApplication.run(...)`, passing the class that carries the configuration and the arguments.

## 4.3 Step 2 — What `SpringApplication.run()` does

In order:

1. **Choose the application type.** It inspects the classpath. Servlet classes + Spring MVC present → *servlet web application* (Tomcat). In `api-gateway`, Spring WebFlux is present → *reactive web application* (Netty). In `eureka-server` it is servlet again.
2. **Prepare the Environment.** It builds the `Environment`, an object that merges every configuration source (section 8 lists them). `application.yml` is read here, and `${...}` placeholders are resolved against environment variables.
3. **Print the banner and publish the "starting" events.**
4. **Create the `ApplicationContext`** (section 4.5), the container that will hold every object Spring manages.
5. **Refresh the context** (section 4.6): scan for classes, create beans, apply auto-configuration, start Tomcat.
6. **Run "runners".** After the context is ready, beans implementing `ApplicationRunner` / `CommandLineRunner` execute. In this project `AdminBootstrap` (student-service) is one.
7. **Publish "application ready"** so health probes can report readiness.

## 4.4 Step 3 — What `@SpringBootApplication` means

`@SpringBootApplication` is a shortcut for three annotations:

| Annotation | Meaning | Effect in this project |
|---|---|---|
| `@Configuration` (via `@SpringBootConfiguration`) | The class is a source of bean definitions. | The application class itself is a configuration class. |
| `@ComponentScan` | Scan this package **and all sub-packages** for classes annotated `@Component`, `@Service`, `@Repository`, `@RestController`, `@Configuration`. | Starting at `com.example.student`, finds `controller`, `service`, `repository`, `config`, `mapper` classes. Classes outside `com.example.student` (for example `com.example.common`) are **not** found by scanning. |
| `@EnableAutoConfiguration` | Look at the libraries on the classpath and automatically configure matching beans (a DataSource if JPA + MySQL driver are present, Tomcat if web is present, and so on). | This is how classes in `common-web` get in despite being outside the scanned package (section 4.8). |

Additional annotations on application classes:

| Class | Extra annotation | Why |
|---|---|---|
| `EurekaServerApplication` | `@EnableEurekaServer` | Turns the program into a registry. |
| `EnrollmentServiceApplication` | `@EnableFeignClients`, `@EnableScheduling` | Activates `@FeignClient` interfaces and `@Scheduled` jobs (outbox poller, saga recovery). |
| `NotificationServiceApplication` | `@EnableScheduling` | Activates the dispatcher job. |

## 4.5 Step 4 — The ApplicationContext

The `ApplicationContext` is Spring's **container**: a registry that creates, stores and wires together all objects ("beans"). Servlet applications use `AnnotationConfigServletWebServerApplicationContext`; the gateway uses its reactive equivalent. You never create it yourself; `SpringApplication.run` returns it.

## 4.6 Step 5 — How Spring identifies and creates beans

A **bean** is simply an object whose lifecycle Spring controls. Spring finds beans in three ways:

1. **Component scanning** — a class annotated with a *stereotype* annotation becomes a bean: `@Component` (generic), `@Service` (business logic), `@Repository` (data access), `@RestController` (web), `@Configuration` (config).
2. **`@Bean` methods** — a method inside a `@Configuration` class whose return value is registered. Example: `SecurityConfig#passwordEncoder` returns `new BCryptPasswordEncoder()`.
3. **Auto-configuration** — libraries register their own beans (`DataSource`, `EntityManagerFactory`, `TransactionTemplate`, `KafkaTemplate`, `RedisConnectionFactory`...).
4. **Spring Data repositories** — an *interface* such as `StudentRepository extends JpaRepository<Student, Long>` has no code. At startup Spring Data generates an implementation class (a proxy) and registers it as a bean. This is why interfaces with no body still work.

Spring first reads all **bean definitions** (recipes), then instantiates them in dependency order.

## 4.7 Step 6 — Dependency Injection and constructor injection

**Dependency Injection (DI)** means an object does not create the objects it needs; it *declares* them and Spring supplies them. In this project every dependency is declared in the **constructor**:

```java
@Service
public class StudentService {
    private final StudentRepository repository;
    private final StudentMapper mapper;

    public StudentService(StudentRepository repository, StudentMapper mapper) {
        this.repository = repository;
        this.mapper = mapper;
    }
```

Line by line:

1. `@Service` — register this class as a bean named `studentService`.
2. `private final StudentRepository repository;` — a field that can be assigned exactly once. `final` makes the class safe: it can never be used with a missing dependency.
3. The constructor lists what the class needs. Because there is exactly one constructor, Spring uses it automatically; **`@Autowired` is not needed and is not used anywhere in this project**.
4. When Spring creates `StudentService` it looks for beans of type `StudentRepository` and `StudentMapper`, creates them first if necessary, and passes them in.

Where only a *value* is needed, `@Value("${...}")` on a constructor parameter injects a configuration property (for example `AdminBootstrap`, `SeatService`, `OutboxPublisher`).

## 4.8 Step 7 — How `common-web` joins every service (auto-configuration)

`common/common-web/src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` lists two classes:

```
com.example.common.CommonAutoConfiguration
com.example.common.KafkaHealthAutoConfiguration
```

When `@EnableAutoConfiguration` runs, Spring reads this file from every JAR on the classpath and processes the listed classes. Therefore adding `common-web` as a dependency is enough to give a service: `JwtTokenService`, the `CorrelationIdFilter`, the `JwtAuthenticationFilter` bean, the `GlobalExceptionHandler`, the OpenAPI definition and a Kafka health indicator. No `@Import` or scan configuration is needed in the service.

## 4.9 Step 8 — How configuration properties are loaded

1. Spring Boot reads `classpath:application.yml` from inside the JAR.
2. Each `key: ${NAME:default}` is resolved: use environment variable `NAME` if it is set, otherwise the text after the colon.
3. Command-line arguments and environment variables override file values (section 8 gives the exact precedence).
4. Values reach code in two ways: `@Value("${app.cache.student-ttl:10m}")` for single values, and `@ConfigurationProperties(prefix = "app.security.jwt")` which binds a whole group to the class `JwtProperties` (fields `secret`, `issuer`, `accessTokenTtl`, `refreshTokenTtl`).

## 4.10 Step 9 — How database connections are initialised

1. Auto-configuration sees `spring-boot-starter-data-jpa` and the MySQL driver, so it builds a `DataSource` from `spring.datasource.url/username/password`. The pool implementation is **HikariCP** (Spring Boot's default; no pool setting is overridden in this project, so Hikari's defaults apply — **its exact default size is a library default and not set in the source**).
2. **Flyway runs first** (before JPA). It connects, creates its history table `flyway_schema_history` if missing, because `baseline-on-migrate: true` with `baseline-version: 0` treats the *already-populated* database as version 0, then applies `V1__...sql`, and so on. These scripts only `CREATE TABLE IF NOT EXISTS sms_*` tables; **existing tables are never touched or dropped**.
3. Hibernate (the JPA implementation) builds an `EntityManagerFactory`, scans `@Entity` classes and, because `ddl-auto: validate`, **checks** that every mapped column exists with a compatible type. If a column is missing the application refuses to start. Hibernate never creates or alters tables here.

## 4.11 Step 10 — How repositories and other components become available

After the DataSource and `EntityManagerFactory` exist, Spring Data creates the repository proxies. Services that declare repositories in their constructors then receive them. Transaction and cache support is added by *proxies*: Spring wraps beans that use `@Transactional`, `@Cacheable`, `@PreAuthorize` in a generated subclass/proxy that runs extra logic before and after your method (section 11).

## 4.12 Step 11 — How embedded Tomcat starts

Because the application type is servlet, Spring Boot starts an **embedded Tomcat** (no separate server install). It opens the port from `server.port` (for example 8081), registers the `DispatcherServlet` at `/`, and registers filters (the Spring Security filter chain, `CorrelationIdFilter`, tracing). The gateway starts **Netty** instead; Eureka starts Tomcat.

## 4.13 Step 12 — When is the application "ready"?

1. All beans are created; Tomcat is listening.
2. `ApplicationRunner` beans run (`AdminBootstrap` inserts the first ADMIN user if missing).
3. The Eureka client registers the service with Eureka (`prefer-ip-address: true`, so it advertises its IP).
4. Spring publishes `ApplicationReadyEvent`; `/actuator/health` becomes `UP` once its checks (database, Redis, Kafka as configured in `management.endpoint.health.group.readiness.include`) pass.
5. `scripts/start-local.sh` detects readiness by polling `http://localhost:<port>/actuator/health` (section 15.1).

## 4.14 Startup differences per program

| Program | What is special at startup |
|---|---|
| `eureka-server` | Starts the registry; it neither registers with itself nor fetches the registry (`register-with-eureka: false`, `fetch-registry: false`). Must start **first**. |
| `student-service` | Flyway V1+V2; `AdminBootstrap` creates the first ADMIN; Redis cache manager; **no Kafka**. |
| `course-service` | Flyway V1; Redis cache; Kafka producer; declares topic `course.low-availability` (3 partitions). |
| `enrollment-service` | Flyway V1; Kafka producer; declares four `enrollment.*` topics; Feign clients; Resilience4j; scheduled jobs `OutboxPublisher#publishPending` (every 1 s) and `SagaRecoveryJob#recover` (every 15 s). |
| `notification-service` | Flyway V1; Kafka consumers (group `notification-service`, concurrency 3); declares 5 topics and their `.DLT` twins; scheduled `NotificationDispatcher#dispatch` (every 2 s). |
| `api-gateway` | Netty; routes from `application.yml`; two global filters; loads the service list from Eureka. Must start **last**. |

---

# 5. Java and Spring Boot Fundamentals, Tied to This Code

Each concept below is explained using a real snippet from the project, never a generic example.

## 5.1 Classes, objects, constructors, access modifiers, encapsulation

A **class** is a blueprint; an **object** is one instance created with `new`. `Student` (`services/student-service/src/main/java/com/example/student/entity/Student.java`) is a class whose instances represent rows of the table `sms_students`.

- **Access modifiers** control visibility: `private` (this class only), no modifier = *package-private* (same package; used by `GlobalExceptionHandler`'s handler methods), `public` (everyone), `protected` (subclasses).
- **Encapsulation** = fields are `private` and reachable only through methods. `Student` has private fields (`firstName`...) and Lombok generates public getters/setters (`@Getter @Setter`).
- **Constructors**: `AuthService(UserAccountRepository users, ...)` is a constructor that receives dependencies. `@NoArgsConstructor` (Lombok) generates the empty constructor that JPA requires to instantiate entities.

## 5.2 Interfaces and implementations, polymorphism, abstraction

An **interface** declares *what* can be done, a class provides *how*. `StudentRepository` is an interface that extends `JpaRepository<Student, Long>`; you never write a class for it. At runtime Spring Data supplies an implementation. Code that uses `StudentRepository` does not know or care which concrete class it is, which is **polymorphism**.

`ConstraintValidator<ValidPhoneNumber, String>` is another interface; `PhoneNumberValidator` implements it. `GlobalFilter` (gateway) and `ApplicationRunner` are interfaces implemented by `JwtAuthGlobalFilter` and `AdminBootstrap`. **Abstraction** is the idea that callers depend on the interface (`PasswordEncoder`) not on the concrete `BCryptPasswordEncoder`.

## 5.3 Inheritance

A class `extends` another to reuse it. `JwtAuthenticationFilter extends OncePerRequestFilter` inherits the guarantee "run at most once per request" and only overrides `doFilterInternal`. The custom exceptions (`ConflictException extends RuntimeException`) inherit all of `RuntimeException`.

## 5.4 Records (immutable data carriers) and enums

Java **records** are compact immutable classes. All DTOs are records:

```java
public record EnrollmentRequest(@NotNull @Positive Long studentId, @NotNull @Positive Long courseId) { }
```

The compiler generates the constructor, `studentId()` / `courseId()` accessors, `equals`, `hashCode` and `toString`. Note accessors have no `get` prefix (`request.studentId()`). **Enums** such as `EnrollmentStatus { PENDING, CONFIRMED, REJECTED, CANCELLED }` model a fixed set of values and can carry behaviour: `EnrollmentStatus#allowedNext()` returns the legal next states using a `switch` expression.

## 5.5 Generics and collections

`JpaRepository<Student, Long>` is generic: `Student` is the entity type and `Long` the id type. `Page<StudentResponse>`, `List<SagaInstance>`, `Map<String,String> fieldErrors`, `Set<String> SORTABLE` (a whitelist of sort columns in controllers) are collections / generic types. `Optional<Student>` (return type of `findById`) represents "a value or nothing" and avoids `null`: `repository.findById(id).orElseThrow(() -> new ResourceNotFoundException(...))`.

## 5.6 Exceptions

Java signals errors with exceptions. This project only uses **unchecked** exceptions (`RuntimeException` subclasses) so method signatures stay clean. A service throws a *meaningful* exception (`ConflictException`) and a single class (`GlobalExceptionHandler`) converts it into an HTTP status (section 17).

## 5.7 Lambdas, streams, method references

A **lambda** is an inline function: `orElseThrow(() -> new UnauthorizedException("..."))`. A **method reference** `mapper::toResponse` passes an existing method as a function. A **stream** processes collections: `categories.findAll().stream().map(mapper::toResponse).toList()` (in `CategoryService#list`) converts every entity to a DTO.

## 5.8 Annotations

Annotations are metadata tags (`@Service`, `@Transactional`). They do nothing by themselves; Spring reads them at startup/runtime through reflection and acts. Section 7 lists every annotation used.

## 5.9 Inversion of Control and Dependency Injection

**IoC** means the framework, not your code, controls object creation and calling. DI is how IoC is applied (section 10). `StudentController` never says `new StudentService(...)`; Spring does.

## 5.10 REST APIs and JSON

**REST** = resources addressed by URLs and manipulated with HTTP verbs: `GET /api/students/5` reads, `POST /api/students` creates, `PUT` replaces, `PATCH` partially updates, `DELETE` removes. Data travels as **JSON**. The library Jackson converts JSON text to Java objects (**deserialisation**, `@RequestBody`) and back (**serialisation**, the return value). `JavaTimeModule` teaches Jackson dates; the Redis cache configuration also uses Jackson.

## 5.11 DTOs versus entities, ORM

An **entity** mirrors a table row and is managed by JPA. A **DTO** (Data Transfer Object) is the shape sent over HTTP. They are kept separate on purpose: the API can change without changing the table, and secrets (`passwordHash`) never leak. **ORM** (Object-Relational Mapping), here Hibernate, converts between entities and rows so you write `repository.save(student)` instead of SQL.

## 5.12 Transactions

A **transaction** is a group of database operations that either all succeed (*commit*) or all undo (*rollback*). `@Transactional` on a service method says "wrap this method in one". Section 9 shows exactly where this project uses it, including the subtle cases (`REQUIRES_NEW`, `MANDATORY`, `TransactionTemplate`).

---

# 6. Every Spring Boot Layer in This Project

## 6.1 Why layers exist

Separating responsibilities keeps each class small, testable and replaceable. The call direction is always **downwards** and one layer only knows the layer below it:

1. **Controller** receives HTTP, checks permissions and input shape, calls a service. Never touches a repository or SQL.
2. **Service** holds business rules and transaction boundaries. Calls repositories (and in Enrollment, remote services).
3. **Repository** talks to the database.
4. **Entity** is the in-memory form of a table row.
5. **DTO / Mapper** shape data going in and out.

If you swapped MySQL for another database only repositories/entities change; if you added gRPC beside REST only controllers change.

## 6.2 Interface versus implementation in this code

| Interface | Implementation | Who writes it |
|---|---|---|
| `StudentRepository`, `CourseRepository`, `EnrollmentRepository`, ... (11 repository interfaces) | A proxy class generated at startup | Spring Data |
| `ConstraintValidator<A,T>` | `PhoneNumberValidator`, `CourseCodeValidator` | Us |
| `CachingConfigurer` | `CacheConfig` (student, course) | Us |
| `ApplicationRunner` | `AdminBootstrap` | Us |
| `GlobalFilter`, `Ordered` | `JwtAuthGlobalFilter`, `CorrelationIdGlobalFilter` | Us |
| `ContextPropagator<T>` | `TracingContextPropagator` | Us |
| `CacheErrorHandler` | anonymous class inside each `CacheConfig` | Us |
| `Specification<T>` | lambdas returned by `*Specifications.filter(...)` | Us |

Note the services themselves (`StudentService`) are **concrete classes with no interface**. That is a deliberate simplification: there is exactly one implementation, so an interface would add files without value.

## 6.3 Layer inventory — Student Service

Base path: `services/student-service/src/main/java/com/example/student/`

| File | Layer | Responsibility and key members | Used by |
|---|---|---|---|
| `StudentServiceApplication.java` | Entry | `main()`, `@SpringBootApplication`. | JVM |
| `controller/AuthController.java` | Controller | `/api/auth`: `register`, `login`, `refresh`, `logout`, `me`. | Gateway → HTTP clients |
| `controller/StudentController.java` | Controller | `/api/students`: `create`, `search`, `get`, `eligibility`, `update`, `updateStatus`, `delete`; static `pageable(page,size,sort)` with a sort-column whitelist. | Gateway, Enrollment (Feign) |
| `service/AuthService.java` | Service | `register`, `login`, `refresh`, `logout`, `me`; private `issue`, static `hash` (SHA-256). | `AuthController` |
| `service/StudentService.java` | Service | `create`, `getById` (cached), `search`, `update`, `updateStatus`, `delete`, `eligibility`; constant `CACHE = "students"`. | `StudentController`, `AuthService`, `CacheConfig` |
| `repository/StudentRepository.java` | Repository | `JpaRepository` + `JpaSpecificationExecutor`; `existsByEmailIgnoreCase`, `existsByEmailIgnoreCaseAndStudentIdNot`. | `StudentService` |
| `repository/StudentSpecifications.java` | Repository helper | `filter(search,status,gender)` builds a dynamic `WHERE`. | `StudentService#search` |
| `repository/UserAccountRepository.java` | Repository | `findByUsernameIgnoreCase`, `findByEmailIgnoreCase`, `existsBy...`. | `AuthService`, `AdminBootstrap` |
| `repository/RefreshTokenRepository.java` | Repository | `findByTokenHash`. | `AuthService` |
| `entity/Student.java` | Entity | Table `sms_students`; `@CreationTimestamp/@UpdateTimestamp`. | Repository, `StudentMapper` |
| `entity/UserAccount.java` | Entity | Table `sms_users` (username, email, `passwordHash`, role, studentId, enabled). | `AuthService`, `AdminBootstrap` |
| `entity/RefreshToken.java` | Entity | Table `sms_refresh_tokens` (stores the **SHA-256 hash**, never the token). | `AuthService` |
| `entity/Gender.java`, `Role.java`, `StudentStatus.java` | Entity enums | `MALE/FEMALE/OTHER`, `ADMIN/STUDENT/STAFF`, `ACTIVE/INACTIVE`. | Everywhere |
| `dto/StudentRequest.java` | DTO | Input with validation annotations. | `StudentController`, `AuthService` |
| `dto/StudentResponse.java` | DTO | Output; also the **cached** type. | Mapper, cache |
| `dto/AuthDtos.java` | DTO | Nested records: `RegisterRequest`, `LoginRequest`, `RefreshRequest`, `TokenResponse`, `UserResponse`. | `AuthController`, `AuthService` |
| `dto/StatusUpdateRequest.java`, `EligibilityResponse.java` | DTO | PATCH status body; eligibility answer. | Controller/service |
| `mapper/StudentMapper.java` | Mapper | `toEntity`, `apply` (copy + normalise: trim, lower-case e-mail), `toResponse`. | `StudentService` |
| `validation/ValidPhoneNumber.java`, `PhoneNumberValidator.java` | Validation | Custom constraint: optional phone, 7-15 digits. | `StudentRequest`, `RegisterRequest` |
| `config/SecurityConfig.java` | Security config | `SecurityFilterChain`, `PasswordEncoder` (BCrypt), `@EnableMethodSecurity`. | Spring Security |
| `config/CacheConfig.java` | Config | Redis cache manager (TTL from `app.cache.student-ttl`) and a cache-error handler that logs instead of failing. | `@Cacheable` |
| `config/AdminBootstrap.java` | Config / startup | `ApplicationRunner` that seeds the first ADMIN user. | Startup |

## 6.4 Layer inventory — Course Service

Base path: `services/course-service/src/main/java/com/example/course/`

| File | Layer | Responsibility and key members | Used by |
|---|---|---|---|
| `CourseServiceApplication.java` | Entry | `main()`. | JVM |
| `controller/CourseController.java` | Controller | `/api/courses`: `create`, `search`, `get`, `availability`, `update`, `status`, `delete`, `reserve`, `release`. | Gateway, Enrollment (Feign) |
| `controller/CategoryController.java` | Controller | `/api/courses/categories`: `create`, `list`, `update`, `delete`. | Gateway |
| `service/CourseService.java` | Service | CRUD + cached reads; `update` handles capacity changes; private `find`, `category`. | `CourseController` |
| `service/SeatService.java` | Service | `reserve`, `release` (atomic, idempotent). | `CourseController` |
| `service/CategoryService.java` | Service | Category CRUD with duplicate/in-use checks. | `CategoryController` |
| `service/LowAvailabilityPublisher.java` | Messaging | `@TransactionalEventListener(AFTER_COMMIT)` sends the Kafka event. | `SeatService` (via Spring events) |
| `repository/CourseRepository.java` | Repository | Spring Data + three JPQL `@Modifying @Query` statements: `reserveSeat`, `releaseSeat`, `changeCapacity`. | `SeatService`, `CourseService` |
| `repository/CourseSpecifications.java` | Repository helper | Dynamic filter (search, category, status, fee range, availableOnly). | `CourseService#search` |
| `repository/CourseCategoryRepository.java`, `SeatReservationRepository.java` | Repository | `existsByNameIgnoreCase`; `findByEnrollmentId`. | Services |
| `entity/Course.java` | Entity | Table `sms_courses`; `@ManyToOne(LAZY)` category; `@Version`; seat columns `updatable=false`. | Repositories, mapper |
| `entity/CourseCategory.java`, `SeatReservation.java` | Entity | `sms_course_categories`, `sms_seat_reservations`. | Services |
| `entity/CourseStatus.java`, `ReservationStatus.java` | Enums | `ACTIVE/INACTIVE`, `RESERVED/RELEASED`. | Services |
| `dto/CourseRequest.java`, `CourseResponse.java`, `CourseAvailabilityResponse.java`, `StatusRequest.java`, `CategoryDtos.java`, `SeatDtos.java` | DTO | Inputs/outputs; `SeatDtos` has `SeatRequest`, `SeatResponse(replayed)`. | Controllers |
| `mapper/CourseMapper.java` | Mapper | `toEntity`, `apply`, `toResponse`, `toAvailability`, category `toResponse`. | Services |
| `validation/ValidCourseCode.java`, `CourseCodeValidator.java` | Validation | Upper-case alphanumerics and `-`, 2-20 chars. | `CourseRequest` |
| `config/SecurityConfig.java` | Security config | Same chain as Student but no public API endpoints. | Spring Security |
| `config/CacheConfig.java` | Config | Two caches: `courses` (10 min) and `courseAvailability` (1 min). | `@Cacheable` |
| `config/CourseCacheEvictor.java` | Config / helper | `evictAfterCommit(courseId)` clears both caches **after** the transaction commits. | `CourseService`, `SeatService` |
| `config/KafkaConfig.java` | Config | Declares topic `course.low-availability` with 3 partitions. | Kafka admin |

## 6.5 Layer inventory — Enrollment Service

Base path: `services/enrollment-service/src/main/java/com/example/enrollment/`

| File | Layer | Responsibility and key members | Used by |
|---|---|---|---|
| `EnrollmentServiceApplication.java` | Entry | `@EnableFeignClients @EnableScheduling`. | JVM |
| `controller/EnrollmentController.java` | Controller | `enroll`, `cancel`, `update`, `get`, `search`, `history`, `forCourse`; helpers `requireSelfOrStaff`, `pageable`. | Gateway |
| `command/CreateEnrollmentCommand.java` + `CreateEnrollmentCommandHandler.java` | CQRS command | Validates replay/duplicate, starts the saga, maps result to `EnrollmentOutcome`. | `EnrollmentController#enroll` |
| `command/CancelEnrollmentCommand.java` + `CancelEnrollmentCommandHandler.java` | CQRS command | Release seat remotely, then cancel locally + outbox event. | `EnrollmentController#cancel` |
| `command/UpdateEnrollmentCommand.java` + `UpdateEnrollmentCommandHandler.java` | CQRS command | Updates remarks only. | `EnrollmentController#update` |
| `command/EnrollmentOutcome.java` | DTO | `result` (`CONFIRMED/REJECTED/IN_PROGRESS`), `message`, `enrollment`. | Controller |
| `query/EnrollmentQueries.java` | CQRS query objects | Records: `GetEnrollmentQuery`, `SearchEnrollmentsQuery`, `StudentEnrollmentHistoryQuery`, `CourseEnrollmentsQuery`. | Controller |
| `query/EnrollmentQueryHandlers.java` | CQRS query handler | `@Transactional(readOnly=true)`; four overloaded `handle(...)` methods. | Controller |
| `query/EnrollmentSpecifications.java` | Repository helper | Dynamic filter (student, course, status, date range). | Query handlers |
| `saga/EnrollmentSagaOrchestrator.java` | Service (saga) | `start`, `run`, `step` and the step methods `validateStudent`, `validateCourse`, `createPendingEnrollment`, `reserveSeat`, `confirm`, `fail`, `compensate`. | Create handler, recovery job |
| `saga/SagaRecoveryJob.java` | Background job | `@Scheduled recover()` resumes stuck sagas. | Scheduler |
| `saga/SagaPausedException.java` | Exception | Signals "wait, a dependency is down". | Orchestrator |
| `client/StudentClient.java`, `CourseClient.java` | Integration | `@FeignClient` interfaces (HTTP calls described by annotations). | Gateways |
| `client/StudentGateway.java`, `CourseGateway.java` | Integration | Wrap each Feign call with Retry, CircuitBreaker, TimeLimiter, Bulkhead. | Orchestrator, cancel handler |
| `client/FeignConfig.java` | Integration config | `RequestInterceptor` (adds service JWT + correlation id), `ErrorDecoder` (HTTP status → exception). | Feign |
| `client/RemoteCall.java` | Integration helper | `await(future, serviceName)` converts failures into business exceptions or `ServiceUnavailableException`. | Orchestrator, cancel handler |
| `client/RemoteDtos.java`, `RemoteExceptions.java` | DTO / exceptions | Consumer-side views of other services' responses; 4 exception types. | Client layer |
| `client/TracingContextPropagator.java` | Integration helper | Copies trace + MDC to bulkhead threads. | Resilience4j |
| `outbox/OutboxWriter.java` | Messaging | `store(topic,key,event)` inserts an outbox row (propagation `MANDATORY`). | `EnrollmentEventRecorder` |
| `outbox/OutboxPublisher.java` | Messaging | `@Scheduled publishPending()` sends rows to Kafka. | Scheduler |
| `event/EnrollmentEventRecorder.java` | Messaging | Builds `EnrollmentEvent` and calls `OutboxWriter`. | Orchestrator, cancel handler |
| `entity/Enrollment.java`, `SagaInstance.java`, `OutboxEvent.java` | Entity | Tables `sms_enrollments`, `sms_saga_instances`, `sms_outbox_events`. | Repositories |
| `entity/EnrollmentStatus.java`, `SagaState.java`, `OutboxStatus.java` | Enums | State machines. | Everywhere |
| `repository/EnrollmentRepository.java`, `SagaInstanceRepository.java`, `OutboxEventRepository.java` | Repository | Includes `lockDue` (`SELECT ... FOR UPDATE SKIP LOCKED`). | Handlers, jobs |
| `dto/EnrollmentRequest.java`, `EnrollmentResponse.java`, `CancelRequest.java`, `EnrollmentUpdateRequest.java` | DTO | `EnrollmentResponse.from(Enrollment)` is the mapper (a static factory). | Controller, handlers |
| `config/SecurityConfig.java`, `config/KafkaConfig.java` | Config | JWT chain; declares 4 topics. | Spring |

## 6.6 Layer inventory — Notification Service

Base path: `services/notification-service/src/main/java/com/example/notification/`

| File | Layer | Responsibility and key members | Used by |
|---|---|---|---|
| `NotificationServiceApplication.java` | Entry | `@EnableScheduling`. | JVM |
| `consumer/EventConsumers.java` | Messaging | Two `@KafkaListener` methods: `onEnrollmentEvent`, `onLowAvailability`. | Kafka |
| `service/NotificationIngestService.java` | Service | `handleEnrollmentEvent`, `handleLowAvailability`: inbox check + create `PENDING` notification (one transaction). | `EventConsumers` |
| `service/NotificationQueryService.java` | Service | `search`, `get`, `forStudent`, `retry`. | `NotificationController` |
| `processing/NotificationDispatcher.java` | Background job | `@Scheduled dispatch()` finds due `PENDING` rows. | Scheduler |
| `processing/NotificationProcessor.java` | Service | `process(id)` in `REQUIRES_NEW`: send, mark `SENT`, or back-off/`FAILED`. | Dispatcher |
| `processing/EmailSimulator.java` | Integration (simulated) | Logs "EMAIL SENT"; fails for `@fail.test` / `@flaky.test` test addresses. | Processor |
| `controller/NotificationController.java` | Controller | `search`, `get`, `forStudent`, `retry`. | Gateway |
| `repository/NotificationRepository.java` | Repository | `findDue`, `search` (JPQL), `existsByEnrollmentIdAndNotificationType`, `findByStudentId`. | Services |
| `repository/InboxMessageRepository.java` | Repository | `existsByMessageIdAndConsumerGroup`. | Ingest service |
| `entity/Notification.java`, `InboxMessage.java` | Entity | `sms_notifications`, `sms_inbox_messages`. | Repositories |
| `entity/NotificationStatus.java`, `NotificationType.java` | Enums | `PENDING/SENT/FAILED`; four types. | Everywhere |
| `dto/NotificationResponse.java`, `mapper/NotificationMapper.java` | DTO / Mapper | Output shape and converter. | Query service |
| `config/KafkaConfig.java` | Config | Topics + DLT topics; JSON and byte templates; `DefaultErrorHandler` with exponential back-off and dead-lettering. | Listener container |
| `config/SecurityConfig.java` | Security config | JWT chain. | Spring Security |

## 6.7 Layer inventory — shared libraries, gateway, registry

Base path `common/common-web/src/main/java/com/example/common/` (library used by 5 programs)

| File | Responsibility | Used by |
|---|---|---|
| `CommonAutoConfiguration.java` | `@AutoConfiguration`: registers `JwtTokenService`, `CorrelationIdFilter`, `JwtAuthenticationFilter` (not as a plain servlet filter), `GlobalExceptionHandler`, OpenAPI bearer-scheme definition. | Spring auto-config |
| `KafkaHealthAutoConfiguration.java` | Adds a `kafka` health component that calls `AdminClient#describeCluster` (3-second timeout). | Services that use Kafka |
| `security/JwtTokenService.java` | `createAccessToken`, `createServiceToken`, `parse` (HS256, issuer check), `accessTtl`, `refreshTtl`. | Student auth, gateway filter, services' filter, Feign interceptor |
| `security/JwtProperties.java` | `@ConfigurationProperties("app.security.jwt")`: `secret`, `issuer`, `accessTokenTtl` (default 15 min), `refreshTokenTtl` (default 7 days). | `JwtTokenService` |
| `security/JwtAuthenticationFilter.java` | Reads `Authorization: Bearer ...`, fills `SecurityContext`. | Each service's `SecurityFilterChain` |
| `security/AuthenticatedUser.java` | Record: `userId`, `username`, `roles`, `studentId`; `hasRole`, `isStaffOrAdmin`. | Controllers (via `@AuthenticationPrincipal`) |
| `security/JsonSecurityHandlers.java` | JSON bodies for 401 (`entryPoint`) and 403 (`accessDenied`). | Each `SecurityConfig` |
| `web/CorrelationIdFilter.java` | Ensures `X-Correlation-Id`, puts it in the logging MDC, logs one line per request. | All servlet services |
| `exception/GlobalExceptionHandler.java`, `ApiError.java` + 6 exception classes | Central error → HTTP mapping and the error body shape. | All services |

Base path `common/event-contracts/src/main/java/com/example/events/`

| File | Responsibility | Used by |
|---|---|---|
| `EnrollmentEvent.java` | Record: `eventId`, `eventType`, `enrollmentId`, `studentId`, `courseId`, `studentName`, `studentEmail`, `courseName`, `reason`, `correlationId`, `occurredAt`. | Enrollment (producer), Notification (consumer) |
| `EnrollmentEventType.java` | Enum with its Kafka topic: `EnrollmentRequested/Confirmed/Rejected/Cancelled`. | Enrollment, Notification |
| `LowCourseAvailabilityEvent.java` | Record for low-seat alerts. | Course (producer), Notification (consumer) |
| `Topics.java` | Constants: five topic names, `DLT_SUFFIX = ".DLT"`, `ENROLLMENT_TOPICS[]`. | Course, Enrollment, Notification |

Gateway — base path `api-gateway/src/main/java/com/example/gateway/`

| File | Responsibility |
|---|---|
| `ApiGatewayApplication.java` | `main()`. |
| `filter/CorrelationIdGlobalFilter.java` | First filter (`HIGHEST_PRECEDENCE`): creates/propagates `X-Correlation-Id`, logs request line. |
| `filter/JwtAuthGlobalFilter.java` | Second filter (`HIGHEST_PRECEDENCE + 10`): rejects non-public requests without a valid token (401). Public: `POST /api/auth/{login,register,refresh,logout}`, `/actuator/**`, `/fallback/**`, Swagger paths. |
| `controller/FallbackController.java` | `@RequestMapping("/fallback/{service}")` returns a 503 JSON when a circuit breaker opens. |

Eureka — `eureka-server/src/main/java/com/example/eureka/EurekaServerApplication.java`: `@EnableEurekaServer` + `main()`; all behaviour is configuration in `eureka-server/src/main/resources/application.yml`.

---

# 7. Annotations Actually Used in the Project

Only annotations found in the main source are listed. Where the prompt names an annotation that is **not** used it is stated explicitly.

## 7.1 Spring Boot / stereotype / configuration

| Annotation | Where | What it does at run time |
|---|---|---|
| `@SpringBootApplication` | 6 application classes | Marks the configuration root; enables scanning + auto-configuration (section 4.4). |
| `@EnableEurekaServer` | `EurekaServerApplication` | Adds Eureka registry endpoints and dashboard. |
| `@EnableFeignClients` | `EnrollmentServiceApplication` | Scans for `@FeignClient` interfaces and creates HTTP-client beans. |
| `@EnableScheduling` | Enrollment, Notification applications | Starts the scheduler that runs `@Scheduled` methods. |
| `@Configuration` | `SecurityConfig`, `CacheConfig`, `KafkaConfig` (each service), `CommonAutoConfiguration` nested classes | Class contains `@Bean` methods. `proxyBeanMethods = false` is used in nested auto-config classes to skip subclass proxying for speed. |
| `@AutoConfiguration` | `CommonAutoConfiguration`, `KafkaHealthAutoConfiguration` | Marks a class listed in `AutoConfiguration.imports`; processed during auto-configuration. |
| `@Bean` | All `config` classes | Method return value is registered as a bean. |
| `@Component` | `AdminBootstrap`, mappers, `CourseCacheEvictor`, handlers, `OutboxPublisher`, `EmailSimulator`, filters in the gateway... | Generic scanned bean. |
| `@Service` | `StudentService`, `AuthService`, `CourseService`, `SeatService`, `CategoryService`, `EnrollmentSagaOrchestrator`, `NotificationIngestService`, `NotificationQueryService` | Business-logic bean. Functionally identical to `@Component` but states intent. |
| `@RestController` | `AuthController`, `StudentController`, `CourseController`, `CategoryController`, `EnrollmentController`, `NotificationController`, `FallbackController` | `@Controller` + `@ResponseBody`: return values are written as JSON. |
| `@Value("${...}")` | `AdminBootstrap`, `SeatService`, `OutboxPublisher`, `SagaRecoveryJob`, `NotificationProcessor`... | Injects a single configuration property (with a default after `:`). |
| `@ConfigurationProperties` | `JwtProperties` | Binds the `app.security.jwt.*` group onto a typed class. |
| `@EnableConfigurationProperties` | `CommonAutoConfiguration` | Registers `JwtProperties` as a bean. |
| `@ConditionalOnMissingBean`, `@ConditionalOnClass`, `@ConditionalOnBean`, `@ConditionalOnWebApplication` | `CommonAutoConfiguration`, `KafkaHealthAutoConfiguration` | Register a bean **only if** a condition holds (e.g. only for servlet apps, only if Kafka admin exists). This is what keeps the reactive gateway from loading servlet filters. |

**Not used:** `@Autowired` (constructor injection is implicit), `@ComponentScan` as a *separate* annotation (it is inside `@SpringBootApplication`), `@Controller` (only `@RestController`), `@Repository` (Spring Data interfaces are detected automatically), `@Profile` / `@ActiveProfiles` in main code (no profile-specific configuration exists, see section 8.6).

## 7.2 Web / request mapping

| Annotation | Where | Meaning |
|---|---|---|
| `@RequestMapping("/api/students")` | Class level on controllers | Common URL prefix. Also used method-level in `FallbackController`. |
| `@GetMapping`, `@PostMapping`, `@PutMapping`, `@PatchMapping`, `@DeleteMapping` | Controller methods | Bind HTTP verb + sub-path to the method. |
| `@PathVariable` | `get(@PathVariable Long id)` | Takes `{id}` from the URL. |
| `@RequestParam` | `search(...)`, `availableOnly`, `page`... | Reads query-string values; `defaultValue`, `required=false` supported. |
| `@RequestBody` | `create(@Valid @RequestBody StudentRequest ...)` | Deserialises JSON into a DTO. |
| `@RequestHeader` | `enroll(... @RequestHeader("Idempotency-Key") ...)` | Reads a header. |
| `@AuthenticationPrincipal` | `get(..., @AuthenticationPrincipal AuthenticatedUser user)` | Injects the logged-in user object stored in the `SecurityContext`. |
| `@RestControllerAdvice` + `@ExceptionHandler` | `GlobalExceptionHandler` | Intercepts exceptions from **all** controllers (section 17). `@ControllerAdvice` itself is not used; `@RestControllerAdvice` = `@ControllerAdvice` + `@ResponseBody`. |
| `@DateTimeFormat(iso = DATE)` | `EnrollmentController#search` | Parses `from`/`to` query dates. |

## 7.3 Validation

| Annotation | Where | Rule |
|---|---|---|
| `@Valid` | Controller parameters | Triggers validation of the DTO. A failure throws `MethodArgumentNotValidException`. |
| `@NotBlank`, `@NotNull`, `@Size`, `@Email`, `@Pattern`, `@Past`, `@Min`, `@Max`, `@DecimalMin`, `@Digits`, `@Positive` | DTO record components | Standard Bean Validation rules (jakarta.validation). |
| `@ValidPhoneNumber`, `@ValidCourseCode` | `StudentRequest`, `RegisterRequest`, `CourseRequest` | **Custom** constraint annotations; `@Constraint(validatedBy = ...)` links to the validator class. `@Target`, `@Retention(RUNTIME)`, `@Documented` are standard annotation plumbing. |

## 7.4 Persistence / JPA / Hibernate

| Annotation | Where | Meaning |
|---|---|---|
| `@Entity`, `@Table(name = "sms_students")` | All entities | Class ⇄ table. |
| `@Id`, `@GeneratedValue(strategy = IDENTITY)` | Primary keys | MySQL `AUTO_INCREMENT` creates the id; Hibernate reads it back after insert. |
| `@Column(name, nullable, length, unique, updatable, insertable, columnDefinition, precision, scale)` | Fields | Column mapping details. `updatable=false` on `Course.totalSeats/availableSeats` prevents entity saves from overwriting seat counts. |
| `@Enumerated(EnumType.STRING)` | Status/role fields | Stores the enum **name** (`"ACTIVE"`) not its ordinal. |
| `@ManyToOne(fetch = LAZY)`, `@JoinColumn` | `Course.category` | Many courses to one category; loaded on demand. |
| `@Version` | `Course`, `Enrollment`, `SagaInstance`, `Notification` | **Optimistic locking**: Hibernate adds `WHERE version = ?` to updates and throws `OptimisticLockingFailureException` if another transaction changed the row (mapped to 409). |
| `@CreationTimestamp`, `@UpdateTimestamp` (Hibernate) | `createdAt`, `updatedAt` | Auto-filled timestamps. |
| `@PreUpdate` | `SagaInstance#touch` | Callback that refreshes `updatedAt` before each update. |
| `@Lock(PESSIMISTIC_WRITE)` + `@QueryHints` | `OutboxEventRepository#lockDue` | Row locks with `FOR UPDATE SKIP LOCKED` (lock timeout `-2` = skip locked). |
| `@Query`, `@Modifying(flushAutomatically, clearAutomatically)`, `@Param` | `CourseRepository`, `NotificationRepository`, `OutboxEventRepository` | Custom JPQL; `@Modifying` marks UPDATE statements; the two flags flush pending changes first and clear the persistence context after. |
| `@Transactional` | Services (section 9.8) | Transaction boundary; attributes `readOnly`, `propagation` used. |
| `@TransactionalEventListener(phase = AFTER_COMMIT)` | `LowAvailabilityPublisher` | Runs the Kafka send only after the surrounding transaction committed. |

## 7.5 Security

| Annotation | Where | Meaning |
|---|---|---|
| `@EnableMethodSecurity` | Each `SecurityConfig` | Turns on `@PreAuthorize`. |
| `@PreAuthorize("hasAnyRole('ADMIN','STAFF')")` | Controller methods | Evaluated **before** the method; false → `AccessDeniedException` → 403. Expression `#user.studentId == #id` compares the principal with the path variable. |

## 7.6 Caching, messaging, scheduling, resilience, OpenAPI

| Annotation | Where | Meaning |
|---|---|---|
| `@EnableCaching`, `@Cacheable`, `@CachePut`, `@CacheEvict` | Student and Course `CacheConfig` / services | Redis cache around service methods (section 9.10). |
| `@KafkaListener` | `EventConsumers` | Subscribes a method to topics. |
| `@Scheduled(fixedDelayString = "${...}")` | `OutboxPublisher`, `SagaRecoveryJob`, `NotificationDispatcher` | Runs repeatedly; next run starts N ms after the previous one **finished**. |
| `@FeignClient`, `@GetMapping`/`@PostMapping` inside the interface | `StudentClient`, `CourseClient` | Declarative HTTP client. |
| `@Retry`, `@CircuitBreaker`, `@TimeLimiter`, `@Bulkhead(type = THREADPOOL)` | `StudentGateway`, `CourseGateway` | Resilience4j policies applied by AOP proxy (section 14.6). |
| `@Operation`, `@ApiResponse(s)`, `@Tag`, `@Content`, `@ExampleObject`, `@Schema` | Controllers | Swagger/OpenAPI documentation only; no behavioural effect. |

## 7.7 Lombok

| Annotation | Where | Effect (at compile time) |
|---|---|---|
| `@Getter`, `@Setter` | All entities | Generates getter/setter methods. |
| `@NoArgsConstructor` | All entities | Generates the empty constructor JPA needs. (`InboxMessage` also writes a 3-argument constructor by hand.) |

Lombok is a compile-time tool: it rewrites the class before the compiler finishes, which is why the generated methods exist in the class files but not in the source; that is also why it is excluded from the runtime JAR.

---

# 8. Configuration and Environment Management

## 8.1 What `application.yml` is

Each program has one `src/main/resources/application.yml`. YAML is an indentation-based settings format: nesting means a dotted key, so

```yaml
spring:
  datasource:
    url: ...
```

is the property `spring.datasource.url`. The syntax `${NAME:default}` means *"use environment variable NAME if present, otherwise the default"*. That single pattern is how the same JAR runs on a laptop (defaults), in Docker Compose (`.env` values) and in Kubernetes (ConfigMap/Secret) without rebuilding.

## 8.2 Precedence (highest wins)

1. Command-line arguments (`--server.port=9000`).
2. Operating-system environment variables (`SERVER_PORT=9000`, `MYSQL_USER=...`).
3. `application.yml` inside the JAR (after placeholder resolution).
4. Defaults in code (`@ConfigurationProperties` field initialisers such as `JwtProperties`, or `@Value("...:default")`).

## 8.3 Common keys explained (present in the four business services)

| Key | Meaning |
|---|---|
| `server.port: ${SERVER_PORT:808x}` | HTTP port. Defaults: student 8081, course 8082, enrollment 8083, notification 8084, gateway 8080 (`${SERVER_PORT:8080}`), Eureka 8761 (fixed). |
| `server.forward-headers-strategy: framework` | Trust `X-Forwarded-*` headers set by the gateway so Swagger shows the gateway URL. |
| `spring.application.name` | The service's **identity**: becomes its Eureka registration name (`lb://student-service`), the `application` tag on metrics and the first item in log lines. |
| `spring.datasource.url` | `jdbc:mysql://${MYSQL_HOST:localhost}:${MYSQL_PORT:3306}/<Database>?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC`. The database name is fixed per service: `StudentDB`, `CourseDB`, `EnrollmentDB`, `NotificationDB`. |
| `spring.datasource.username/password` | `${MYSQL_USER:...}` / `${MYSQL_PASSWORD:...}`. **A development default exists in each file** so the project runs locally; real deployments supply the environment variables (see 8.7). The values are intentionally not printed here. |
| `spring.jpa.open-in-view: false` | Do **not** keep the database session open during JSON rendering. Entities must be fully loaded inside the service; this prevents accidental lazy-loading in controllers and long-held connections. |
| `spring.jpa.hibernate.ddl-auto: validate` | Hibernate checks the schema, never changes it. Flyway owns the schema. |
| `spring.jpa.properties.hibernate.jdbc.time_zone: UTC` | Store/read timestamps in UTC. |
| `spring.flyway.*` | `enabled: true`, `locations: classpath:db/migration`, `baseline-on-migrate: true`, `baseline-version: 0`, `clean-disabled: true` (`clean` would delete everything, so it is switched off). |
| `app.security.jwt.secret: ${JWT_SECRET:...}` | HMAC signing key for tokens. **Must be identical in the gateway and all four services**; a development default exists; production sets `JWT_SECRET`. |
| `eureka.client.service-url.defaultZone: ${EUREKA_URL:http://localhost:8761/eureka}` | Where the registry lives. |
| `eureka.instance.prefer-ip-address: true` | Register by IP instead of hostname. |
| `management.endpoints.web.exposure.include` | Which Actuator endpoints are exposed over HTTP (health, info, prometheus, metrics; Enrollment also `circuitbreakers, retries, bulkheads`; gateway adds `gateway`). |
| `management.endpoint.health.probes.enabled`, `show-details: always`, `group.readiness.include` | Kubernetes-style `/actuator/health/liveness` and `/readiness`. Readiness includes the dependencies each service really needs (student: db, redis; course: db, redis, kafka; enrollment: db, kafka; notification: db, kafka). |
| `management.tracing.sampling.probability: 1.0` | Trace **every** request (suitable for development). |
| `management.otlp.tracing.endpoint: ${OTEL_EXPORTER_OTLP_TRACES_ENDPOINT:http://localhost:4318/v1/traces}` | Where traces go (Jaeger's OTLP port). |
| `management.metrics.tags.application` | Labels metrics with the service name. |
| `logging.pattern.level` | Adds `[service,traceId,spanId,correlationId]` to every log line. The gateway uses a shorter version without `correlationId` in the pattern. |
| `logging.level.com.example: INFO` | Our packages log at INFO. |

## 8.4 Service-specific keys

### Student Service — `services/student-service/src/main/resources/application.yml`

| Key | Meaning |
|---|---|
| `spring.data.redis.host/port/timeout` | Redis connection (`${REDIS_HOST:localhost}`, `${REDIS_PORT:6379}`, timeout 1 s). |
| `spring.cache.type: redis` | Spring's cache abstraction uses Redis. |
| `app.bootstrap.admin-username: admin`, `admin-email: admin@sms.local`, `admin-password: ${ADMIN_PASSWORD:...}` | Used once by `AdminBootstrap` to seed the first ADMIN. The password default is a development value; set `ADMIN_PASSWORD` for real use. |
| `app.cache.student-ttl: 10m` | Time-to-live for cached students (read in `CacheConfig`). |

### Course Service — `services/course-service/src/main/resources/application.yml`

| Key | Meaning |
|---|---|
| Redis keys | As above. |
| `app.cache.course-ttl: 10m`, `availability-ttl: 1m` | TTLs of the two caches. |
| `spring.kafka.bootstrap-servers: ${KAFKA_BOOTSTRAP_SERVERS:localhost:9092}` | Broker address. |
| `spring.kafka.producer.acks: all`, `properties.enable.idempotence: true` | The broker confirms from all replicas and duplicates from producer retries are dropped. |
| `value-serializer: ...JsonSerializer`, `spring.json.add.type.headers: false` | Messages are JSON **without** Java class names, so consumers are not coupled to our class names. |
| `app.course.low-availability-threshold: ${LOW_AVAILABILITY_THRESHOLD:5}` | Publish an alert when seats left ≤ this number. |

### Enrollment Service — `services/enrollment-service/src/main/resources/application.yml`

| Key | Meaning |
|---|---|
| Kafka producer | As Course but `value-serializer` is `StringSerializer`: the outbox row already contains the JSON text. |
| `spring.cloud.openfeign.client.config.default.connect-timeout: 2000`, `read-timeout: 3000`, `logger-level: basic` | Feign HTTP timeouts (ms) for every client. |
| `enrollment.saga.recovery-interval-ms: 15000` | How often `SagaRecoveryJob` looks for stuck sagas. |
| `enrollment.saga.stale-after-seconds: 30` | A saga untouched for 30 s counts as stuck. |
| `enrollment.saga.max-recovery-attempts: 20` | **Present in the file but not read by any Java class** (verified by search): it has no effect today. |
| `enrollment.outbox.interval-ms: 1000`, `batch-size: 50`, `send-timeout-seconds: 5` | Outbox poller frequency, rows per poll, broker acknowledgement wait. |
| `resilience4j.circuitbreaker/retry/timelimiter/thread-pool-bulkhead` | Policies for instances `studentService` and `courseService` (section 14.6). Business answers (`RemoteNotFound/Conflict/RejectedException`) are in `ignore-exceptions` so they never count as failures or get retried. |
| `management.health.circuitbreakers.enabled: true` | Circuit-breaker state appears in `/actuator/health`. |
| `clients.student-service.url` / `clients.course-service.url` | **Not set**: the Feign annotation reads `${clients.student-service.url:}`; empty means "resolve the name via Eureka". Tests may set it. |

### Notification Service — `services/notification-service/src/main/resources/application.yml`

| Key | Meaning |
|---|---|
| `spring.kafka.consumer.group-id: notification-service` | Consumer group name (also written into the inbox table). |
| `auto-offset-reset: earliest`, `enable-auto-commit: false` | New group starts from the oldest message; offsets are committed by Spring only after the listener succeeds. |
| `value-deserializer: ErrorHandlingDeserializer` + `delegate.class: JsonDeserializer` | A poison (non-JSON) record does not crash the consumer; it is passed to the error handler, which dead-letters it. |
| `spring.json.trusted.packages: com.example.events`, `use.type.headers: false` | Only our event package may be deserialised; the target type comes from the listener, not from the message. |
| `spring.kafka.listener.ack-mode: record`, `concurrency: 3` | Commit after every record; three consumer threads. |
| `producer.properties.max.block.ms: 5000` | The dead-letter publisher gives up after 5 s instead of the default 60 s. |
| `notification.admin-email` | Recipient of low-seat alerts. |
| `notification.dispatch.interval-ms/batch-size/max-attempts/base-backoff-seconds` | 2000 ms, 50 rows, 5 tries, 5 s back-off (doubles each time). |
| `notification.consumer.retry-initial-ms/retry-multiplier/retry-max-elapsed-ms` | 1000 ms, ×2, stop after 15 s then dead-letter. |

### API Gateway — `api-gateway/src/main/resources/application.yml`

| Key | Meaning |
|---|---|
| `spring.cloud.gateway.httpclient.connect-timeout: 2000`, `response-timeout: 15s` | Gateway-to-service timeouts. |
| `globalcors.cors-configurations.'[/**]'` | Browser CORS: allowed origins from `${CORS_ALLOWED_ORIGINS:http://localhost:3000,http://localhost:4200,http://localhost:5173}`, methods GET/POST/PUT/PATCH/DELETE/OPTIONS, exposes `X-Correlation-Id`. |
| `default-filters: DedupeResponseHeader=...` | Prevents duplicate CORS headers when both gateway and service add them. |
| `routes:` (8 entries) | The URL → service table (section 14.3). |
| `springdoc.swagger-ui.urls` | Lists the four services' API docs in one Swagger UI. |
| `resilience4j.circuitbreaker.configs.default` | Window 20 calls, min 10 calls, open at 50 % failures, stay open 10 s. |
| `resilience4j.timelimiter.configs.default.timeout-duration: 20s` | Gateway-level timeout. |

### Eureka Server — `eureka-server/src/main/resources/application.yml`

| Key | Meaning |
|---|---|
| `server.port: 8761` | Fixed port. |
| `eureka.instance.hostname: ${EUREKA_HOSTNAME:localhost}` | Registry's own name. |
| `eureka.client.register-with-eureka: false`, `fetch-registry: false` | The registry does not register with itself. |
| `eureka.server.enable-self-preservation: false` | Evict dead instances quickly (development-friendly; production usually keeps self-preservation on). |
| `eureka.server.eviction-interval-timer-in-ms: 5000` | Check for dead instances every 5 s. |

## 8.5 Environment variables in one table

| Variable | Used by | Purpose | Default? |
|---|---|---|---|
| `SERVER_PORT` | all services, gateway | Port override. | yes |
| `MYSQL_HOST`, `MYSQL_PORT` | 4 services | Database address. | `localhost`, `3306` |
| `MYSQL_USER`, `MYSQL_PASSWORD` | 4 services | Database login. | development default in `application.yml` |
| `REDIS_HOST`, `REDIS_PORT` | student, course | Redis. | `localhost`, `6379` |
| `KAFKA_BOOTSTRAP_SERVERS` | course, enrollment, notification | Kafka. | `localhost:9092` |
| `EUREKA_URL` | gateway + 4 services | Registry. | `http://localhost:8761/eureka` |
| `JWT_SECRET` | gateway + 4 services | Token signing key (≥ 32 chars; the application **refuses to start** if shorter). | development default |
| `ADMIN_PASSWORD` | student | Seed ADMIN password. | development default |
| `LOW_AVAILABILITY_THRESHOLD` | course | Seat alert threshold. | 5 |
| `CORS_ALLOWED_ORIGINS` | gateway | Browser origins. | three localhost ports |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | all | Trace exporter. | `http://localhost:4318/v1/traces` |
| `EUREKA_HOSTNAME` | eureka | Registry hostname. | `localhost` |

## 8.6 Profiles

A Spring **profile** is a named set of settings (`application-dev.yml`, `application-prod.yml`) selected with `--spring.profiles.active=prod`. **This project defines no profile-specific files and no `@Profile` annotation**, so there is exactly one configuration; environment differences are expressed through the environment variables above (and `.env`, Compose and Kubernetes supply them). You *can* still pass `--spring.profiles.active=x`; it would simply change nothing today. (Docker Compose has a *Compose* profile called `mysql-proxy`; that is a different concept.)

## 8.7 Which configuration is loaded where

| Environment | How values reach the JVM | Files |
|---|---|---|
| Local JVMs (`scripts/start-local.sh`) | No variables set → the defaults in each `application.yml` | `application.yml` only |
| Docker Compose | `docker-compose.yml` passes `${...}` values read from `.env` into container environment variables | `.env` (git-ignored), `.env.example` (template) |
| Kubernetes | ConfigMap (non-secret) and Secret (credentials, JWT secret) mounted as environment variables | `kubernetes/01-configmap.yaml`, `kubernetes/03-secret.yaml` |

**Secret handling:** defaults are for local development only. The source notes this gap as an open item (section 21.3): production deployments must set `MYSQL_PASSWORD`, `JWT_SECRET` and `ADMIN_PASSWORD`; no vault or secret manager is integrated (**not implemented**).

---

# 9. Database Execution Flow

## 9.1 Connection configuration

Section 4.10 described startup. In steady state each service holds a **pool** of ready-made JDBC connections to its own database (HikariCP, default settings). A request borrows a connection when a transaction begins and returns it on commit/rollback. Because `open-in-view` is `false`, the connection is released when the *service* method ends, not at the end of the HTTP response.

## 9.2 The four databases and who owns what

| Database | Owner | Tables created by this project (Flyway) | Pre-existing tables |
|---|---|---|---|
| `StudentDB` | Student Service | `sms_students`, `sms_users`, `sms_refresh_tokens` | Existing user data is **left untouched** (not read by the code). |
| `CourseDB` | Course Service | `sms_course_categories`, `sms_courses`, `sms_seat_reservations` | untouched |
| `EnrollmentDB` | Enrollment Service | `sms_enrollments`, `sms_saga_instances`, `sms_outbox_events` | untouched |
| `NotificationDB` | Notification Service | `sms_notifications`, `sms_inbox_messages` | untouched |

Every migrated table also exists next to Flyway's own `flyway_schema_history`. Migration files: `services/student-service/src/main/resources/db/migration/V1__create_student_and_auth_tables.sql`, `V2__user_deleted_with_student.sql`; `services/course-service/.../V1__create_course_tables.sql`; `services/enrollment-service/.../V1__create_enrollment_tables.sql`; `services/notification-service/.../V1__create_notification_tables.sql`.

**Database-per-service rule:** there are **no foreign keys across databases**. `sms_enrollments.student_id`, `course_id`, `sms_seat_reservations.enrollment_id`, `sms_notifications.student_id` are *logical* references only; the application keeps them consistent (SQL comments in the migrations say so).

## 9.3 Entity ⇄ table mapping and relationships

| Entity | Table | Relationships / special mappings |
|---|---|---|
| `Student` | `sms_students` | `email` UNIQUE. Index on status, on (last,first name). |
| `UserAccount` | `sms_users` | `student_id` → `sms_students.student_id` **FK `ON DELETE CASCADE`** (V2): deleting a student deletes the login. Not a JPA relationship; just a `Long studentId` column. |
| `RefreshToken` | `sms_refresh_tokens` | `user_id` → `sms_users` FK `ON DELETE CASCADE`. |
| `CourseCategory` | `sms_course_categories` | `name` UNIQUE. |
| `Course` | `sms_courses` | `@ManyToOne(LAZY) category` → `category_id` FK. `CHECK (available_seats >= 0 AND available_seats <= total_seats)`. `course_code` UNIQUE. |
| `SeatReservation` | `sms_seat_reservations` | `course_id` FK → `sms_courses`; `enrollment_id` UNIQUE (idempotency). |
| `Enrollment` | `sms_enrollments` | Generated column `active_key` (`student-course` only for PENDING/CONFIRMED) with a UNIQUE index → duplicate active enrolments impossible. `idempotency_key` UNIQUE. |
| `SagaInstance` | `sms_saga_instances` | `idempotency_key` UNIQUE; index (state, updated_at). |
| `OutboxEvent` | `sms_outbox_events` | `event_id` UNIQUE; index (status, next_attempt_at, outbox_id). |
| `Notification` | `sms_notifications` | UNIQUE (enrollment_id, notification_type): one notification per enrolment and type. |
| `InboxMessage` | `sms_inbox_messages` | UNIQUE (message_id, consumer_group). |

The **only** JPA association in the whole project is `Course → CourseCategory` (`@ManyToOne`). No `@OneToMany`, no `@ManyToMany`. Elsewhere, entities relate by plain id columns.

## 9.4 Lazy versus eager loading

- `@ManyToOne(fetch = LAZY)` on `Course.category`: the category row is loaded only when `getCategory()` is first used. `CourseMapper#toResponse` calls it inside the service's transaction, so the lazy load works. With `open-in-view: false`, calling it later in a controller would fail with `LazyInitializationException`; this is why mapping to DTOs happens **inside** service methods.
- All other fields are loaded eagerly with the row (basic columns are always eager).

## 9.5 Repositories and CRUD

`JpaRepository<T, ID>` already provides `save`, `findById`, `findAll`, `delete`, `existsById`, `count`, paging and sorting. Method names like `existsByEmailIgnoreCase(String)` are **derived queries**: Spring parses the name (`exists` + `By` + `Email` + `IgnoreCase`) and generates `SELECT ... WHERE lower(email) = lower(?)`. `JpaSpecificationExecutor<T>` adds `findAll(Specification, Pageable)` for dynamic filters (`StudentSpecifications`, `CourseSpecifications`, `EnrollmentSpecifications`).

| CRUD verb | Repository method | SQL (conceptual) |
|---|---|---|
| Create | `save(new entity)` | `INSERT` |
| Read | `findById`, `findAll(spec, pageable)` | `SELECT`, with `LIMIT/OFFSET`, plus a `COUNT` for the page total |
| Update | Change the loaded entity inside `@Transactional` (dirty checking), or `saveAndFlush` | `UPDATE` (Hibernate detects changed fields at flush) |
| Delete | `delete(entity)` | `DELETE` |

## 9.6 JPQL queries (no native SQL)

A search confirmed there is **no native SQL** (`nativeQuery = true`) in the Java code. JPQL, which uses class/field names instead of table/column names, appears in:

| Query | File | Purpose |
|---|---|---|
| `update Course c set c.availableSeats = c.availableSeats - 1, c.version = c.version + 1 where c.courseId = :id and c.availableSeats > 0 and c.status = :active` | `CourseRepository#reserveSeat` | **Atomic seat decrement**: returns the number of rows changed (1 or 0). |
| `update Course c set c.availableSeats = c.availableSeats + 1, ... where ... c.availableSeats < c.totalSeats` | `CourseRepository#releaseSeat` | Atomic increment, never above capacity. |
| `update Course c set c.availableSeats = c.availableSeats + (:total - c.totalSeats), c.totalSeats = :total, ... where ... >= 0` | `CourseRepository#changeCapacity` | Capacity change preserving reserved seats. MySQL evaluates SET assignments left to right, hence `availableSeats` is assigned **before** `totalSeats` (explained in the code comment). |
| `select e from OutboxEvent e where e.status = :status and e.nextAttemptAt <= :now order by e.outboxId` + `PESSIMISTIC_WRITE` | `OutboxEventRepository#lockDue` | Locks due rows with `FOR UPDATE SKIP LOCKED`. |
| `select n from Notification n where n.status = :status and (n.nextAttemptAt is null or n.nextAttemptAt <= :now) order by n.notificationId` | `NotificationRepository#findDue` | Notifications ready to send. |
| `select n from Notification n where (:studentId is null or n.studentId = :studentId) and (:status is null ...) and (:type is null ...)` | `NotificationRepository#search` | Optional filters in a single query. |

## 9.7 How Java objects become rows and back

**Save (Java → row):** `studentRepository.save(student)` → Hibernate sees a new `Student` (id `null`) → builds `INSERT INTO sms_students (address, created_at, date_of_birth, email, ...) VALUES (?, ?, ...)` using the `@Column` names → executes through the JDBC driver → MySQL generates `student_id` (`AUTO_INCREMENT`) → Hibernate reads the generated id and sets it into the object. `@Enumerated(STRING)` stores `"ACTIVE"`; `@CreationTimestamp` fills `created_at`; `hibernate.jdbc.time_zone: UTC` governs date-times.

**Load (row → Java):** `findById(5L)` → `SELECT ... FROM sms_students WHERE student_id = ?` → Hibernate creates a `Student` through its empty constructor (`@NoArgsConstructor`), sets each field from the result set, and keeps the object in the **persistence context** (the transaction's first-level cache). `StudentMapper#toResponse` then copies it into a `StudentResponse` record.

## 9.8 Transactions, commit and rollback — exactly where used

A transaction starts when a `@Transactional` method is entered (Spring's proxy borrows a connection and begins) and ends when it returns normally (**commit**) or throws a `RuntimeException` (**rollback**, all changes undone).

| Where | Setting | Why |
|---|---|---|
| `StudentService`, `AuthService`, `CourseService`, `CategoryService` write methods | default `@Transactional` (REQUIRED: join existing or start new) | One unit of work per request. |
| Read methods (`getById`, `search`, `list`, `me`, `EnrollmentQueryHandlers`, `NotificationQueryService` reads) | `readOnly = true` | Hint: no dirty checking, may use read optimisations. |
| `SeatService#reserve/release` | `@Transactional` | Seat update + reservation row + cache-eviction registration commit together. |
| `OutboxWriter#store`, `EnrollmentEventRecorder#record` | `propagation = MANDATORY` | **Must** run inside an existing transaction, otherwise Spring throws. This guarantees the event row can only be written together with the business change (the outbox pattern). |
| `NotificationProcessor#process` | `propagation = REQUIRES_NEW` | Each notification is processed in its own independent transaction so one failure does not roll back others. |
| `NotificationIngestService` | `@Transactional` | Inbox row + notification row are atomic. |
| `EnrollmentSagaOrchestrator`, `CancelEnrollmentCommandHandler`, `OutboxPublisher` | **programmatic**: `TransactionTemplate.execute(...)` | These make **remote HTTP calls**; holding a database transaction open during a network call would hold locks and a connection. The orchestrator therefore opens short transactions only around the local database work (steps 4, 6/7, compensation). |
| `UpdateEnrollmentCommandHandler#handle` | `@Transactional` | Single local update. |

**Self-invocation caveat:** Spring applies `@Transactional`/`@Cacheable` through a proxy around the bean. A call from one method to another method **of the same object** (`this.getById(...)`) bypasses the proxy, so the annotation on the callee does not run. Example in this project: `StudentService#eligibility` calls `getById` on itself, so that internal call is **not** cached (it still works; it simply queries the database). `AuthService#register` calls `students.create(...)`, which is a *different* bean, so it goes through the proxy and joins the register transaction.

## 9.9 Concurrency control in the database (three techniques)

| Technique | Where | What it prevents |
|---|---|---|
| **Atomic conditional UPDATE** | `CourseRepository#reserveSeat` | Overselling: InnoDB serialises the `UPDATE`s on the row, so 15 simultaneous requests for 4 seats yield exactly 4 successes (proved by `scripts/e2e.py`). |
| **Optimistic locking** (`@Version`) | `Course`, `Enrollment`, `SagaInstance`, `Notification` | Lost updates when two transactions edit the same row; the loser gets `OptimisticLockingFailureException` → 409. |
| **Unique constraints** | `active_key`, `idempotency_key`, `enrollment_id`, UNIQUE (enrollment_id, notification_type), inbox (message_id, group) | Duplicates even if the application check is raced (a `DataIntegrityViolationException` is turned into 409). A `CHECK` constraint on seats is the last line of defence. |
| **Pessimistic lock with SKIP LOCKED** | `OutboxEventRepository#lockDue` | Two Enrollment instances publishing the same outbox row. |

## 9.10 Redis caching (database-read shortcut)

`StudentService#getById` is `@Cacheable("students", key = "#id")`: the first call runs the method (SQL) and stores the `StudentResponse` JSON in Redis under `sms:students::<id>` with a 10-minute TTL (prefix `sms:` from `CacheConfig`); later calls return the stored JSON without touching MySQL. `update` and `updateStatus` use `@CachePut` (refresh the entry with the new result), `delete` uses `@CacheEvict`. Course Service evicts **after commit** through `CourseCacheEvictor` (a `TransactionSynchronization#afterCommit`), because evicting before commit would let a concurrent reader re-cache the old row. If Redis is down, `CacheErrorHandler` logs a warning and the call falls through to the database.

## 9.11 One complete database operation traced end to end

`POST /api/students` (create a student), the details of the other tracing examples are in section 16:

1. Client → gateway → `StudentController#create(@Valid @RequestBody StudentRequest)`.
2. `StudentService#create` (transaction begins; a connection is borrowed from Hikari).
3. `StudentRepository#existsByEmailIgnoreCase(email)` → `SELECT ... FROM sms_students WHERE lower(email)=lower(?) LIMIT 1`.
4. `StudentMapper#toEntity` builds a `Student` (trimmed names, lower-case e-mail, enrolment date = today, status ACTIVE).
5. `StudentRepository#save(student)` → `INSERT INTO sms_students ...`; MySQL assigns `student_id`.
6. Transaction commits when `create` returns (or rolls back on exception).
7. `StudentMapper#toResponse(saved)` → `StudentResponse` record (done inside the transaction, before the connection is released).
8. Jackson serialises the record as JSON; response `201 Created` with a `Location` header.

---

# 10. Dependency Injection and Bean Lifecycle

## 10.1 Beans and the ApplicationContext

A **Spring bean** is an object created and managed by the ApplicationContext. The context keeps a map *name → object* plus metadata (type, scope, dependencies, lifecycle callbacks). It performs the creation in this order: read definitions → resolve dependencies → instantiate (calling constructors) → inject → apply "post-processors" (these add the proxies for `@Transactional`, `@Cacheable`, `@PreAuthorize`, Resilience4j) → ready.

## 10.2 Constructor injection versus field injection

| | Constructor injection (used here) | Field injection (`@Autowired` on a field; **not used**) |
|---|---|---|
| Dependencies visible | In the constructor signature | Hidden inside the class |
| Fields can be `final` | Yes | No |
| Unit tests | `new StudentService(mockRepo, mockMapper)` | Needs reflection or Spring |
| Missing bean | Fails at startup with a clear message | Also at startup, but object can be half-built in tests |

## 10.3 How interfaces and implementations are injected

When a constructor asks for `StudentRepository` (an interface), Spring looks for a bean *assignable to that type*. Exactly one exists (the generated proxy), so it is injected. If two beans matched, Spring would need `@Primary` or `@Qualifier`; **neither is used** here because every injected type has exactly one candidate.

Real example in the enrollment saga: `EnrollmentSagaOrchestrator`'s constructor takes `StudentGateway`, `CourseGateway`, `EnrollmentRepository`, `SagaInstanceRepository`, `EnrollmentEventRecorder` and `TransactionTemplate`. The first two are our `@Component`s, the next two are generated repository proxies, the fifth is our `@Component`, and the last is created by Spring Boot's auto-configuration.

## 10.4 Scopes

The default scope is **singleton**: one instance per application context, shared by every request thread. All beans here are singletons, so they must be **stateless** (hold no per-request data in fields). That is why request-specific data is always passed as method parameters. **Prototype** (a new instance per injection) and request/session scopes are **not used** (no `@Scope`).

`FeignConfig` is deliberately **not** annotated `@Configuration`: it is referenced from `@FeignClient(configuration = FeignConfig.class)` so its beans apply only to that Feign client and do not leak into the main context.

## 10.5 Initialisation and destruction lifecycle

For each singleton: constructor → dependency injection → post-processors (proxy wrapping) → *ready* → ... → on shutdown, destruction callbacks → the object is discarded. The project does **not** use `@PostConstruct` / `@PreDestroy` or `InitializingBean`; it uses two other start-up hooks instead:

| Hook | Used by | When it runs |
|---|---|---|
| `ApplicationRunner#run` | `AdminBootstrap` | After the context is fully started. |
| `@Scheduled` methods | Outbox poller, saga recovery, notification dispatcher | Periodically after `@EnableScheduling` starts the scheduler. |
| `@KafkaListener` containers | `EventConsumers` | Started with the context; stopped on shutdown. |
| Constructor work | `JwtTokenService` | The constructor itself checks that the secret has at least 32 bytes and throws `IllegalStateException` so a mis-configured service never starts. `OutboxPublisher`'s constructor registers metrics. |

On **shutdown** (`SIGTERM`, which is what `scripts/stop-local.sh` sends with `kill`) Spring closes the context gracefully: stops Tomcat/consumers, closes the connection pool, deregisters from Eureka.

## 10.6 Circular dependencies

A **circular dependency** is A needs B and B needs A; with constructor injection Spring cannot create either first and throws `BeanCurrentlyInCreationException`. This project avoids cycles through its layering rule (controllers → services → repositories, never upwards). The one place that could have tempted a cycle is `AuthService` ⟷ `StudentService`: `AuthService` depends on `StudentService` (to create the student profile on registration), but `StudentService` does **not** depend on `AuthService`; the arrow points one way, so there is no cycle. Similarly `CourseCacheEvictor` is injected into both `CourseService` and `SeatService` while depending only on `CacheManager`.

---

# 11. API Request and Response Lifecycle

## 11.1 The generic path through this application

Every business request, regardless of service, passes the same stations. Station numbers are used in later sections.

1. **Client** sends `HTTP request` to the gateway (`http://localhost:8080/api/...`) with `Authorization: Bearer <jwt>` (except the four public auth calls).
2. **Gateway: Netty** receives the request.
3. **Gateway filter 1 — `CorrelationIdGlobalFilter`** (`api-gateway/.../filter/CorrelationIdGlobalFilter.java`): reads or generates `X-Correlation-Id`, copies it onto the forwarded request and the response.
4. **Gateway filter 2 — `JwtAuthGlobalFilter`** (`.../filter/JwtAuthGlobalFilter.java`): if the path is public, continue; otherwise `JwtTokenService#parse` must succeed (signature, issuer, expiry) or the gateway answers `401` itself and **the service is never called**.
5. **Gateway routing**: the first route whose `Path` predicate matches decides the target (`lb://student-service` etc.). The **CircuitBreaker** filter wraps the call (fallback `/fallback/<service>` → 503). The load balancer asks Eureka's list for a live instance and the HTTP call is forwarded with the original `Authorization` header.
6. **Service: Tomcat** accepts the connection (platform thread per request).
7. **Servlet filter chain** (order matters): tracing (`ServerHttpObservationFilter`), `CorrelationIdFilter` (MDC + request log line), then **Spring Security's `FilterChainProxy`** containing, among others, our `JwtAuthenticationFilter` placed *before* `UsernamePasswordAuthenticationFilter`. It reads the Bearer token, `JwtTokenService#parse`, and sets an `Authentication` whose principal is `AuthenticatedUser` and whose authorities are `ROLE_<role>`. An invalid token simply leaves the request **anonymous**.
8. **Authorization rules of the filter chain** (`SecurityConfig#filterChain`): public paths are `permitAll()`; everything else `authenticated()`. Anonymous on a protected path → `JsonSecurityHandlers.entryPoint()` → `401` JSON.
9. **`DispatcherServlet`** (Spring MVC front controller) maps URL + HTTP verb to a controller method using `@RequestMapping` metadata (`HandlerMapping`).
10. **Argument resolving (before the controller method is invoked):** Jackson converts the JSON body into the DTO record, `@Valid` runs Bean Validation (failure → `MethodArgumentNotValidException` → `400` with field errors), `@PathVariable`/`@RequestParam` are converted (wrong type → `400`), `@AuthenticationPrincipal` supplies the user.
11. **Method security proxy:** the controller bean is wrapped by a proxy; when MVC invokes the method, `@PreAuthorize` is evaluated first. Failure → `AccessDeniedException` → `GlobalExceptionHandler` → `403`. (Consequence: because arguments are resolved *before* this proxy runs, a caller who lacks the role **and** sends an invalid body receives `400`, not `403`; a valid body gives `403`.)
12. **Controller method** runs (thin: calls exactly one service/handler).
13. **Service method** runs inside a transaction/cache proxy; it applies business rules and calls repositories (and, in Enrollment, remote services).
14. **Repository → Hibernate → JDBC → MySQL**; results come back as entities.
15. **Mapper** converts entities to response DTOs (inside the transaction).
16. **Return path:** the transaction commits; the controller returns the DTO (or `ResponseEntity` with a status); Jackson writes JSON; filters unwind (`CorrelationIdFilter` logs `METHOD path -> status (n ms)` and clears the MDC); Tomcat sends the response.
17. **Gateway** streams the response back to the client, adds `X-Correlation-Id`, logs its own line.

For each station: *what* happens is listed above; *why it is required* is: station 4 saves resources by rejecting anonymous traffic early; 7-8 protect each service even when called directly (defence in depth: the gateway is **not** the only guard); 10 makes sure the service layer only sees valid data; 11 enforces roles; 13 is the only place business rules live; 15 stops entities leaking; 16 guarantees a transaction commits before the client sees success.

## 11.2 Which components are *different* for non-standard requests

| Request kind | Difference |
|---|---|
| `POST /api/auth/login`, `register`, `refresh`, `logout` | Station 4 and the filter chain treat them as public. `register` still inspects an optional token to know whether an ADMIN is calling. |
| `GET /api/courses/{id}` and `/availability`, `GET /api/students/{id}` | Station 13 is wrapped by a Redis `@Cacheable`: a cache hit skips stations 14-15. |
| `POST /api/enrollments` | Station 13 is the **saga** which itself calls Student and Course services synchronously (section 14.7). |
| `/fallback/**`, `/actuator/**`, `/swagger-ui/**`, `/v3/api-docs/**` | Public in the gateway filter. |
| Kafka consumption | Not an HTTP request at all (section 14.9). |

---

# 12. Every Endpoint and Its Complete Execution Flow

## 12.1 Endpoint catalogue (36 business endpoints)

All paths are called through the gateway at `http://localhost:8080`. The gateway route that carries each group is in the "Service" column. "Roles" are enforced twice: the gateway requires only a *valid token*; the **service** enforces the role with `@PreAuthorize` (defence in depth). `ADMIN`, `STAFF`, `STUDENT` are user roles; `SERVICE` is an internal role carried by tokens that services create for each other.

| # | Method + path | Service | Roles | Controller method | Success status |
|---|---|---|---|---|---|
| 1 | `POST /api/auth/register` | student | public (ADMIN token needed to create STAFF/ADMIN) | `AuthController#register` | 201 |
| 2 | `POST /api/auth/login` | student | public | `AuthController#login` | 200 |
| 3 | `POST /api/auth/refresh` | student | public | `AuthController#refresh` | 200 |
| 4 | `POST /api/auth/logout` | student | public | `AuthController#logout` | 204 |
| 5 | `GET /api/auth/me` | student | any authenticated | `AuthController#me` | 200 |
| 6 | `POST /api/students` | student | ADMIN, STAFF | `StudentController#create` | 201 |
| 7 | `GET /api/students` | student | ADMIN, STAFF | `StudentController#search` | 200 |
| 8 | `GET /api/students/{id}` | student | ADMIN, STAFF, SERVICE, or STUDENT for own id | `StudentController#get` | 200 |
| 9 | `GET /api/students/{id}/eligibility` | student | ADMIN, STAFF, SERVICE | `StudentController#eligibility` | 200 |
| 10 | `PUT /api/students/{id}` | student | ADMIN, STAFF, or STUDENT own id | `StudentController#update` | 200 |
| 11 | `PATCH /api/students/{id}/status` | student | ADMIN, STAFF | `StudentController#updateStatus` | 200 |
| 12 | `DELETE /api/students/{id}` | student | ADMIN | `StudentController#delete` | 204 |
| 13 | `POST /api/courses/categories` | course | ADMIN, STAFF | `CategoryController#create` | 201 |
| 14 | `GET /api/courses/categories` | course | any authenticated | `CategoryController#list` | 200 |
| 15 | `PUT /api/courses/categories/{id}` | course | ADMIN, STAFF | `CategoryController#update` | 200 |
| 16 | `DELETE /api/courses/categories/{id}` | course | ADMIN | `CategoryController#delete` | 204 |
| 17 | `POST /api/courses` | course | ADMIN, STAFF | `CourseController#create` | 201 |
| 18 | `GET /api/courses` | course | any authenticated | `CourseController#search` | 200 |
| 19 | `GET /api/courses/{id}` | course | any authenticated | `CourseController#get` | 200 |
| 20 | `GET /api/courses/{id}/availability` | course | any authenticated | `CourseController#availability` | 200 |
| 21 | `PUT /api/courses/{id}` | course | ADMIN, STAFF | `CourseController#update` | 200 |
| 22 | `PATCH /api/courses/{id}/status` | course | ADMIN, STAFF | `CourseController#status` | 200 |
| 23 | `DELETE /api/courses/{id}` | course | ADMIN | `CourseController#delete` | 204 |
| 24 | `POST /api/courses/{id}/seats/reserve` | course | ADMIN, SERVICE | `CourseController#reserve` | 200 |
| 25 | `POST /api/courses/{id}/seats/release` | course | ADMIN, SERVICE | `CourseController#release` | 200 |
| 26 | `POST /api/enrollments` | enrollment | ADMIN, STAFF, STUDENT (self only) | `EnrollmentController#enroll` | 201 / 202 / 422 |
| 27 | `POST /api/enrollments/{id}/cancel` | enrollment | ADMIN, STAFF, STUDENT (own) | `EnrollmentController#cancel` | 200 |
| 28 | `PUT /api/enrollments/{id}` | enrollment | ADMIN, STAFF | `EnrollmentController#update` | 200 |
| 29 | `GET /api/enrollments/{id}` | enrollment | ADMIN, STAFF, STUDENT (own) | `EnrollmentController#get` | 200 |
| 30 | `GET /api/enrollments` | enrollment | ADMIN, STAFF | `EnrollmentController#search` | 200 |
| 31 | `GET /api/enrollments/student/{studentId}` | enrollment | ADMIN, STAFF, STUDENT (own) | `EnrollmentController#history` | 200 |
| 32 | `GET /api/enrollments/course/{courseId}` | enrollment | ADMIN, STAFF | `EnrollmentController#forCourse` | 200 |
| 33 | `GET /api/notifications` | notification | ADMIN, STAFF | `NotificationController#search` | 200 |
| 34 | `GET /api/notifications/{id}` | notification | ADMIN, STAFF | `NotificationController#get` | 200 |
| 35 | `GET /api/notifications/student/{studentId}` | notification | ADMIN, STAFF, or STUDENT own | `NotificationController#forStudent` | 200 |
| 36 | `POST /api/notifications/{id}/retry` | notification | ADMIN, STAFF | `NotificationController#retry` | 200 |

Route note: `/api/courses/categories` and `/api/courses/{id}` both start with `/api/courses/`. Spring MVC prefers the **literal** path `categories` over the `{id}` pattern, so `GET /api/courses/categories` reaches `CategoryController#list`, not `CourseController#get`.

## 12.2 Infrastructure endpoints (not business logic)

| Endpoint | Where | Access | Purpose |
|---|---|---|---|
| `GET/POST/PUT/PATCH/DELETE/... /fallback/{service}` | gateway `FallbackController#fallback` | public | 503 JSON when a circuit breaker is open or a service is down. |
| `GET /actuator/health`, `/health/liveness`, `/health/readiness`, `/actuator/info`, `/actuator/prometheus` | every program | public (services' security config `permitAll` for health/info/prometheus) | Health checks, metrics. `/actuator/metrics` is exposed but not on the permit list of the services (needs a token). |
| `GET /actuator/circuitbreakers`, `/retries`, `/bulkheads` | enrollment | token | Resilience4j state. |
| `GET /actuator/gateway/**` | gateway | public via the gateway's `/actuator/**` rule | Route inspection. |
| `GET /swagger-ui.html`, `/swagger-ui/**`, `/v3/api-docs/**` | every program | public | Swagger UI (gateway aggregates the four services). |
| `GET /docs/<name>/v3/api-docs (name = student, course, enrollment or notification)` | gateway routes `docs-*` | public | Rewrites the path (`RewritePath`) to each service's OpenAPI JSON. |
| `GET http://localhost:8761/` and `/eureka/**` | eureka-server | open | Registry dashboard and the registration protocol used by every client. |

## 12.3 The common prefix and suffix of every flow

To avoid repeating 17 stations 36 times, each flow below says "**Prefix P**" and "**Suffix S**":

**Prefix P** = section 11.1 stations 1-12: gateway correlation filter → gateway JWT filter (401 if invalid) → route → service Tomcat → servlet filters → Spring Security (JWT → `SecurityContext`) → `DispatcherServlet` → Jackson + `@Valid` (400) → `@PreAuthorize` (403) → controller method.

**Suffix S** = stations 15-17: mapper output → commit → Jackson JSON → filters unwind → gateway forwards.

**Standard failures** (not repeated): no/invalid token → `401` from the gateway; wrong role → `403`; validation → `400` with `fieldErrors`; unknown id → `404`; uniqueness/optimistic-lock → `409`; business rule → `422`; unexpected → `500` (`GlobalExceptionHandler`).

## 12.4 Student Service endpoints (`/api/auth`, `/api/students`)

Base paths: `services/student-service/src/main/java/com/example/student/` (controller `controller/`, service `service/`, repository `repository/`).

### 12.4.1 `POST /api/auth/register`

- **Request:** `{"username":"stu1","email":"stu1@example.com","password":"********","firstName":"Self","lastName":"Serve"}` (`AuthDtos.RegisterRequest`: username 3-50 chars of `[A-Za-z0-9._-]`, e-mail, password 8-72, optional `role`, names ≤ 50, optional `@ValidPhoneNumber`).
- **Flow:** Prefix P (public) → `AuthController#register`: reads `SecurityContextHolder` to see whether an `AuthenticatedUser` (an ADMIN token) was supplied → `AuthService#register(request, caller)` (transaction):
  1. Role defaults to `STUDENT`. If the role is not STUDENT and the caller is not ADMIN → `AccessDeniedException` (403).
  2. `UserAccountRepository#existsByUsernameIgnoreCase`, `#existsByEmailIgnoreCase` → `ConflictException` (409) if taken.
  3. For a STUDENT: `firstName`/`lastName` required (else `IllegalArgumentException` → 400). Calls **`StudentService#create`** (another bean, joins the transaction) which checks e-mail uniqueness in `sms_students` and inserts the profile.
  4. Builds `UserAccount`; password stored as **BCrypt hash** (`PasswordEncoder#encode`); `studentId` linked; `UserAccountRepository#save` → `INSERT INTO sms_users`.
- **Tables:** `sms_students` (STUDENT only), `sms_users`.
- **Response 201:** `UserResponse{userId, username, email, role, studentId}`. Suffix S.

### 12.4.2 `POST /api/auth/login`

- **Request:** `{"username":"admin","password":"********"}` (`username` may also be the e-mail).
- **Flow:** Prefix P (public) → `AuthController#login` → `AuthService#login` (transaction): `findByUsernameIgnoreCase` or else `findByEmailIgnoreCase`; user missing → `UnauthorizedException` (401, deliberately same message as bad password); `enabled` false or `PasswordEncoder#matches(raw, hash)` false → 401; success → private `issue(user)`:
  1. `JwtTokenService#createAccessToken(userId, username, [role], studentId)` → signed HS256 JWT (15 min).
  2. 48 random bytes (`SecureRandom`) → Base64-URL string = the **refresh token** (shown to the client once).
  3. SHA-256 of that string is saved in `sms_refresh_tokens` (`token_hash`, `expires_at` = now + 7 days) — the raw refresh token is **never stored**.
- **Response 200:** `TokenResponse{accessToken, refreshToken, tokenType:"Bearer", expiresInSeconds, username, role, studentId}`.

### 12.4.3 `POST /api/auth/refresh`

- **Request:** `{"refreshToken":"..."}`. **Flow:** `AuthService#refresh`: hash the presented token → `RefreshTokenRepository#findByTokenHash` (missing → 401); already `revoked` or expired → 401; **set `revoked = true`** (rotation: each refresh token works once); load the user (`findById`, must be enabled) → `issue(user)` creates a **new pair**. Reusing the old token later gives 401 (checked in `e2e.py`).
- **Tables:** `sms_refresh_tokens` (update + insert), `sms_users` (read).

### 12.4.4 `POST /api/auth/logout`

- **Request:** `{"refreshToken":"..."}`. **Flow:** `AuthService#logout`: finds the hash and, if present, marks it revoked (the dirty-checked entity is updated at commit). Unknown tokens are silently ignored. **Response 204** (no body). The access token itself cannot be revoked (it expires in 15 min); **token blacklisting is not implemented**.

### 12.4.5 `GET /api/auth/me`

- Needs a token (all non-public paths do). `AuthController#me(@AuthenticationPrincipal AuthenticatedUser)` → `AuthService#me` (read-only transaction): `UserAccountRepository#findById(user.userId())` → `UserResponse`. Unknown user → 401.

### 12.4.6 `POST /api/students`

- **Roles:** ADMIN, STAFF. **Request:** `StudentRequest` — `firstName`, `lastName`, `email` mandatory; optional `phoneNumber` (custom validator), `dateOfBirth` (`@Past`), `gender` (`MALE/FEMALE/OTHER`), `address`, `enrollmentDate`, `status`.
- **Flow:** Prefix P → `StudentController#create` → `StudentService#create` → `existsByEmailIgnoreCase` (409 if used) → `StudentMapper#toEntity` → `StudentRepository#save` → `StudentMapper#toResponse`. Controller builds `ResponseEntity.created(URI "/api/students/{id}")`.
- **Table:** `sms_students`. **Response 201:** `StudentResponse` + `Location` header.

### 12.4.7 `GET /api/students`

- **Roles:** ADMIN, STAFF. **Query:** `search` (matches first name, last name or e-mail, case-insensitive), `status`, `gender`, `page` (0), `size` (10, capped at 100), `sort` (default `studentId,asc`; allowed columns: `studentId, firstName, lastName, email, status, gender, enrollmentDate, createdAt`; others → `IllegalArgumentException` → 400).
- **Flow:** Prefix P → `StudentController#search` → static `pageable(...)` builds a `PageRequest` → `StudentService#search` (read-only) → `StudentRepository#findAll(StudentSpecifications.filter(...), pageable)` (dynamic `WHERE` + `LIMIT` + a count query) → `.map(mapper::toResponse)`.
- **Response 200:** Spring Data `Page` JSON (`content[]`, `totalElements`, `totalPages`, `number`, `size`...).

### 12.4.8 `GET /api/students/{id}`

- **Roles:** ADMIN/STAFF/SERVICE, or STUDENT whose token `studentId` equals `{id}` (`#user.studentId == #id`). **Flow:** Prefix P → `StudentController#get` → `StudentService#getById` — wrapped by the cache proxy: **hit** → Redis JSON returned immediately; **miss** → `findById` → `mapper.toResponse` → value stored under key `sms:students::<id>` (TTL 10 min). Unknown id → `ResourceNotFoundException` → 404. A student asking for another id → 403.

### 12.4.9 `GET /api/students/{id}/eligibility`

- **Roles:** ADMIN, STAFF, SERVICE (called by Enrollment Service). `StudentService#eligibility` → `getById(id)` (a self-call, not cached, section 9.8) → `EligibilityResponse{studentId, eligible, reason}`; eligible only when `status == ACTIVE` (reason `"Student is INACTIVE"` otherwise).

### 12.4.10 `PUT /api/students/{id}`

- **Roles:** ADMIN/STAFF, or STUDENT own id. **Extra rule in the controller:** a non-staff caller sending `status` → `AccessDeniedException` (403). `StudentService#update` (`@CachePut`): `find(id)` (404) → e-mail uniqueness against *other* students (`existsByEmailIgnoreCaseAndStudentIdNot`, 409) → `mapper.apply` (copy fields; `null` status/enrolment date leave old values) → `saveAndFlush` → response; `@CachePut` overwrites the cached copy with the result.

### 12.4.11 `PATCH /api/students/{id}/status`

- **Roles:** ADMIN, STAFF. **Request:** `{"status":"INACTIVE"}` (`@NotNull`). `StudentService#updateStatus` (`@CachePut`): `find` → `setStatus` → `saveAndFlush`. This is what makes a student ineligible for enrolment.

### 12.4.12 `DELETE /api/students/{id}`

- **Role:** ADMIN. `StudentService#delete` (`@CacheEvict`): `find` (404) → `repository.delete`. The database FK with `ON DELETE CASCADE` (migration V2) removes the student's `sms_users` row and, by a second cascade, its `sms_refresh_tokens`. **Response 204.** Enrolments in EnrollmentDB are **not** touched (no cross-database relation).

## 12.5 Course Service endpoints (`/api/courses`)

Base path: `services/course-service/src/main/java/com/example/course/`.

### 12.5.1 Categories (`CategoryController` → `CategoryService` → `CourseCategoryRepository`)

| Endpoint | Flow beyond Prefix P | Table |
|---|---|---|
| `POST /api/courses/categories` body `{"name","description"}` | `create`: `existsByNameIgnoreCase` (409) → `save` → `CourseMapper#toResponse` | `sms_course_categories` |
| `GET /api/courses/categories` | `list`: `findAll()` → stream → `mapper::toResponse` | same |
| `PUT /api/courses/categories/{id}` | `update`: `findById` (404) → name clash check when the name changed (409) → `save` | same |
| `DELETE /api/courses/categories/{id}` (ADMIN) | `delete`: `findById` (404) → `CourseRepository#existsByCategory_CategoryId(id)` → 409 "used by existing courses" → `delete` | `sms_courses` (read), categories |

### 12.5.2 `POST /api/courses`

- **Request:** `CourseRequest{courseName ≤120, courseCode (ValidCourseCode), description, categoryId, durationWeeks 1-520, fees ≥ 0 with ≤ 8 integer + 2 fraction digits, totalSeats 0-100000, status}`.
- **Flow:** Prefix P → `CourseController#create` → `CourseService#create`: `existsByCourseCodeIgnoreCase` (409) → `category(categoryId)` (`CourseCategoryRepository#findById`; unknown → `BusinessRuleException` 422) → `CourseMapper#toEntity` (**`availableSeats = totalSeats`**) → `CourseRepository#save` → `INSERT INTO sms_courses` (the DB `CHECK` guards the seat range) → response 201 with `Location`.

### 12.5.3 `GET /api/courses`

- **Query:** `search` (name/code/description), `categoryId`, `status`, `minFees`, `maxFees`, `availableOnly`, `page`, `size`, `sort` (default `courseId,asc`; allowed `courseId, courseName, courseCode, fees, durationWeeks, totalSeats, availableSeats, status, createdAt`). `CourseService#search` → `courses.findAll(CourseSpecifications.filter(...), pageable)`. Not cached (cache would be hard to invalidate for arbitrary filters).

### 12.5.4 `GET /api/courses/{id}` and `/availability`

- Both wrapped by `@Cacheable`: `getById` (cache `courses`, 10 min) and `availability` (cache `courseAvailability`, **1 min**). On a miss, `find(id)` (404 if absent) then `CourseMapper#toResponse` / `toAvailability` (available = ACTIVE and seats > 0). `CourseCacheEvictor#evictAfterCommit` removes both entries after every course/seat change, so the 1-minute TTL is only a safety net.

### 12.5.5 `PUT /api/courses/{id}`

- `CourseService#update`: `find` → duplicate code check against other ids (409) → `CourseMapper#apply` (never seat counts) → `saveAndFlush` (optimistic `@Version`: a concurrent write causes 409). **If `totalSeats` changed:** `CourseRepository#changeCapacity(id, total)`; it returns `0` when the new capacity would be below the already reserved seats → `BusinessRuleException` "below the number of seats already reserved" (422). Then `evictor.evictAfterCommit(id)` and a fresh `find` is returned.

### 12.5.6 `PATCH /api/courses/{id}/status`, `DELETE /api/courses/{id}`

- `updateStatus`: `find` → `setStatus` → `saveAndFlush` → evict after commit. An INACTIVE course makes `reserveSeat` fail (its `WHERE` requires `status = ACTIVE`). `delete` (ADMIN): `repository.delete(find(id))` + `flush()` (forces the FK violation now, e.g. when seat reservations exist → `DataIntegrityViolationException` → 409) + evict after commit.

### 12.5.7 `POST /api/courses/{id}/seats/reserve`  (called by Enrollment Service; roles ADMIN, SERVICE)

- **Request:** `{"enrollmentId": 123}`. **Flow:** `CourseController#reserve` → `SeatService#reserve(courseId, enrollmentId)` (one transaction):
  1. `findById(courseId)` (404).
  2. `SeatReservationRepository#findByEnrollmentId`: if a row exists → **idempotent replay**: same course & status RESERVED → returns `replayed=true` without touching seats; RELEASED → 409; other course → 409.
  3. `CourseRepository#reserveSeat(courseId, ACTIVE)` — the atomic UPDATE. Result `0` → `ConflictException` ("not active" or "No seats available") → 409.
  4. Inserts `SeatReservation(enrollmentId, courseId, RESERVED)` (the UNIQUE `enrollment_id` is the idempotency guard).
  5. Reloads the course; `CourseCacheEvictor#evictAfterCommit`; if `availableSeats ≤ threshold (5)` publishes the Spring event `LowAvailabilityDetected`.
  6. After commit, `LowAvailabilityPublisher#onLowAvailability` (`AFTER_COMMIT`) sends `LowCourseAvailabilityEvent` to Kafka topic `course.low-availability` (key = courseId).
- **Response 200:** `SeatResponse{courseId, enrollmentId, reservationStatus, availableSeats, replayed}`.

### 12.5.8 `POST /api/courses/{id}/seats/release`  (compensation / cancel; ADMIN, SERVICE)

- `SeatService#release`: a missing or already RELEASED reservation is a **successful no-op** (`replayed=true`); otherwise `CourseRepository#releaseSeat` (increment, bounded by capacity), reservation → RELEASED, evict after commit.

## 12.6 Enrollment Service endpoints (`/api/enrollments`)

Base path: `services/enrollment-service/src/main/java/com/example/enrollment/`. This service uses **CQRS**: commands that change state go to `command/*Handler`, reads go to `query/EnrollmentQueryHandlers`.

### 12.6.1 `POST /api/enrollments` — the saga

- **Request:** `{"studentId":1,"courseId":1}` plus optional header `Idempotency-Key` (≤ 64 chars; generated as a UUID if absent).
- **Flow:** Prefix P → `EnrollmentController#enroll`:
  1. `requireSelfOrStaff(user, request.studentId())`: a STUDENT may only enroll themselves (403).
  2. Determine the idempotency key; `MDC.get("correlationId")` is passed along.
  3. `CreateEnrollmentCommandHandler#handle(CreateEnrollmentCommand)`: if the key was never seen **and** `EnrollmentRepository#existsByStudentIdAndCourseIdAndStatusIn(student, course, [PENDING, CONFIRMED])` → `ConflictException` 409.
  4. `EnrollmentSagaOrchestrator#start` → persist `SagaInstance` (state `STARTED`; a duplicate key returns the stored saga) → `run(sagaId)` executes the steps (section 14.7 explains each in detail).
  5. The handler converts the final `SagaState` into `EnrollmentOutcome`: `COMPLETED → CONFIRMED`, `REJECTED → REJECTED`, otherwise `IN_PROGRESS`.
  6. Controller maps result → HTTP status: **201** CONFIRMED, **422** REJECTED, **202** IN_PROGRESS.
- **Tables:** `sms_saga_instances`, `sms_enrollments`, `sms_outbox_events` (Enrollment); reads Student/Course via HTTP; Course writes `sms_courses`, `sms_seat_reservations`.
- **Response body:** `EnrollmentOutcome{result, message, enrollment{enrollmentId, studentId, courseId, studentName, courseName, enrollmentDate, enrollmentStatus, remarks, createdAt, updatedAt}}`.

### 12.6.2 `POST /api/enrollments/{id}/cancel`

- **Request:** optional `{"reason":"..."}` (≤ 500). **Flow:** `EnrollmentController#cancel`: loads the enrolment through the query handler (404) to get its `studentId`, `requireSelfOrStaff` (403) → `CancelEnrollmentCommandHandler#handle`:
  1. `findById` (404). `PENDING` → `ConflictException` 409 ("still being processed"); anything but `CONFIRMED` → `BusinessRuleException` 422.
  2. **Remote step first:** `CourseGateway#releaseSeat` (+ `RemoteCall#await`), wrapped by Resilience4j. A not-found/conflict answer is logged and ignored (nothing to release). If Course Service is *unavailable* the call throws `ServiceUnavailableException` (503) **before** any local change, so the client can simply retry.
  3. **Local step:** `TransactionTemplate`: reload → `Enrollment#transitionTo(CANCELLED)` (state-machine guard) → remarks → `saveAndFlush` → `EnrollmentEventRecorder#record(EnrollmentCancelled)` → outbox row, committed together.
- **Response 200:** `EnrollmentResponse` (status `CANCELLED`).

### 12.6.3 `PUT /api/enrollments/{id}`

- **Roles:** ADMIN, STAFF. Only **remarks** can be edited (`EnrollmentUpdateRequest{remarks ≤ 500}`); status belongs to the saga/cancel. `UpdateEnrollmentCommandHandler#handle` (`@Transactional`): `findById` (404) → `setRemarks` → `saveAndFlush`.

### 12.6.4 Queries — `GET /api/enrollments/{id}`, `/api/enrollments`, `/student/{studentId}`, `/course/{courseId}`

All four call `EnrollmentQueryHandlers` (class-level `@Transactional(readOnly = true)`; never mutates, never calls other services):

| Endpoint | Query object → handler | Repository call | Notes |
|---|---|---|---|
| `GET /api/enrollments/{id}` | `GetEnrollmentQuery` | `findById` | 404 if missing; STUDENT own only (`requireSelfOrStaff` on `e.studentId()`). |
| `GET /api/enrollments?studentId&courseId&status&from&to&page&size&sort` | `SearchEnrollmentsQuery` | `findAll(EnrollmentSpecifications.filter(...), pageable)` | ADMIN/STAFF. `from`/`to` are `yyyy-MM-dd`; `to` is inclusive (`< to + 1 day`). Default sort `enrollmentId,desc`; allowed `enrollmentId, studentId, courseId, status, enrollmentDate, createdAt`. |
| `GET /api/enrollments/student/{studentId}` | `StudentEnrollmentHistoryQuery` | filter by student | STUDENT own only. |
| `GET /api/enrollments/course/{courseId}?status=` | `CourseEnrollmentsQuery` | filter by course (+ status) | ADMIN/STAFF. |

## 12.7 Notification Service endpoints (`/api/notifications`)

Base path: `services/notification-service/src/main/java/com/example/notification/`. Notifications are **never created by an API call**; they appear when Kafka events are consumed (section 14.9). The API only reads them and can re-queue failures.

| Endpoint | Flow beyond Prefix P |
|---|---|
| `GET /api/notifications?studentId&status&type&page&size` | `NotificationController#search` → `NotificationQueryService#search` (read-only) → `NotificationRepository#search` (JPQL with optional filters, `Sort DESC notificationId`, size ≤ 100) → `NotificationMapper#toResponse`. |
| `GET /api/notifications/{id}` | `NotificationQueryService#get` → `findById` (404) → mapper. |
| `GET /api/notifications/student/{studentId}` | `@PreAuthorize` allows ADMIN/STAFF or STUDENT with matching `studentId` → `findByStudentId(studentId, pageable)`. |
| `POST /api/notifications/{id}/retry` | `NotificationQueryService#retry` (writes): `find` (404) → status must be `FAILED` else `BusinessRuleException` 422 → set `PENDING`, `retryCount=0`, `nextAttemptAt=null`, `processedAt=null` → `save`. The scheduled dispatcher picks it up within about 2 s. |

**Response shape:** `NotificationResponse{notificationId, studentId, enrollmentId, notificationType, recipientEmail, message, status, retryCount, lastError, createdAt, processedAt}`.

## 12.8 Gateway-only endpoint: `/fallback/{service}`

When the `CircuitBreaker` route filter trips (open circuit, timeout 20 s, or the target is unreachable), it `forward:`s the request internally to `/fallback/student-service` (etc.). `FallbackController#fallback(@PathVariable String service)` logs a warning and returns HTTP 503 with `{timestamp, status:503, error:"Service Unavailable", message:"<service> is currently unavailable. Please retry shortly."}`.

---

# 13. Authentication and Authorization Flow

## 13.1 What is implemented and what is not

| Feature | Status | Where |
|---|---|---|
| Login API | **Implemented** | `AuthController#login` → `AuthService#login` |
| Password encoding / verification | **Implemented** (BCrypt) | `SecurityConfig#passwordEncoder`; `PasswordEncoder#encode` on registration, `#matches` on login |
| JWT generation (HS256) | **Implemented** | `JwtTokenService#createAccessToken`, `#createServiceToken` (`common-web`) |
| JWT validation | **Implemented**, twice (gateway + each service) | `JwtAuthGlobalFilter`, `JwtAuthenticationFilter`, both calling `JwtTokenService#parse` |
| `SecurityFilterChain` | **Implemented** in each of the four services | `config/SecurityConfig.java` |
| `SecurityContext` | **Implemented** | filled by `JwtAuthenticationFilter` |
| Role-based access control | **Implemented** | `@EnableMethodSecurity` + `@PreAuthorize` |
| Refresh tokens with rotation | **Implemented** | `AuthService#refresh`, `sms_refresh_tokens` |
| Logout (refresh-token revocation) | **Implemented** | `AuthService#logout` |
| `AuthenticationManager` / `AuthenticationProvider` / `UserDetailsService` | **Not used.** Credentials are checked by hand in `AuthService#login`; Spring's username/password authentication machinery is not involved. | — |
| Access-token revocation / blacklist | **Not implemented** (15-minute expiry is the only limit) | — |
| OAuth2 / OpenID Connect / external identity provider | **Not implemented** | — |
| Account lock-out after failed attempts | **Not implemented** (failed logins are logged only) | — |
| HTTPS / TLS | **Not configured** in the source (plain HTTP on localhost) | — |

## 13.2 Roles

| Role | Created how | Meaning |
|---|---|---|
| `ADMIN` | Seeded by `AdminBootstrap` at first start; later only by an ADMIN | Everything including deletes. |
| `STAFF` | Only by an ADMIN through `POST /api/auth/register` with `"role":"STAFF"` | Manage students, courses, enrolments, notifications (no deletes). |
| `STUDENT` | Public registration; linked to a `sms_students` profile | Own profile, browse courses, enroll/cancel own, own history and notifications. |
| `SERVICE` | **Not a database role**: only appears in tokens minted by `JwtTokenService#createServiceToken` (5-minute lifetime, `userId` "0") | Lets Enrollment Service call Student/Course endpoints. |

## 13.3 Token contents

A JWT is three Base64 sections separated by dots: header, payload (claims), signature. The signature is an HMAC-SHA-256 over header+payload with the shared secret; any change to the text breaks it.

| Claim | Source | Used for |
|---|---|---|
| `iss` | `app.security.jwt.issuer` (`student-management`) | `requireIssuer` check in `parse` |
| `sub` | user id as text | `AuthenticatedUser.userId` |
| `username`, `roles` (list), `studentId` (only for STUDENT) | `createAccessToken` | `AuthenticatedUser`, ownership checks |
| `iat`, `exp` | now / now + TTL | expiry (15 min access, 5 min service) |

## 13.4 Login flow, step by step

1. Client: `POST /api/auth/login` with JSON credentials (no token).
2. Gateway: `CorrelationIdGlobalFilter`; `JwtAuthGlobalFilter` sees the path/method pair `POST /api/auth/login` in `PUBLIC_POST` → continue.
3. Route `student-service` (`Path=/api/students/**,/api/auth/**`) → load-balanced to Student Service.
4. Student Service filters: `CorrelationIdFilter`; Spring Security chain; `JwtAuthenticationFilter` finds no header → request stays anonymous; the rule `requestMatchers(POST, "/api/auth/login", ...).permitAll()` lets it through.
5. `AuthController#login` → `AuthService#login`: look up the user, verify BCrypt hash, issue tokens (section 12.4.2).
6. Response 200 with `accessToken` and `refreshToken`.

## 13.5 Protected request flow

1. Client sends `Authorization: Bearer <accessToken>`.
2. **Gateway** `JwtAuthGlobalFilter`: `tokens.parse(...)` valid → forward; otherwise 401 JSON (`"Missing, invalid or expired token"`).
3. **Service** `JwtAuthenticationFilter#doFilterInternal`: extracts the token, `parse` → `AuthenticatedUser`; creates `UsernamePasswordAuthenticationToken(user, null, authorities=[ROLE_<role>...])`; stores it in `SecurityContextHolder`.
4. `authorizeHttpRequests`: `anyRequest().authenticated()`.
5. `@PreAuthorize` on the controller method (e.g. `hasAnyRole('ADMIN','STAFF')`; Spring adds the `ROLE_` prefix automatically).
6. Inside the controller `@AuthenticationPrincipal AuthenticatedUser` is that same object, used for "own data only" checks (`user.studentId()`).

## 13.6 Filters that run before the controller (in order)

| Order | Program | Filter | Result |
|---|---|---|---|
| 1 | Gateway | `CorrelationIdGlobalFilter` (`HIGHEST_PRECEDENCE`) | correlation id |
| 2 | Gateway | `JwtAuthGlobalFilter` (`HIGHEST_PRECEDENCE + 10`) | 401 or pass |
| 3 | Service | tracing observation filter (Spring, `HIGHEST_PRECEDENCE + 1`) | trace/span ids in MDC |
| 4 | Service | `CorrelationIdFilter` (`HIGHEST_PRECEDENCE + 10`) | `correlationId` in MDC; log line |
| 5 | Service | Spring Security filters, with `JwtAuthenticationFilter` before `UsernamePasswordAuthenticationFilter` | `SecurityContext` |
| 6 | Service | `ExceptionTranslationFilter` (Spring Security) | converts auth failures into `entryPoint` (401) / `accessDeniedHandler` (403) JSON bodies |
| 7 | Service | `DispatcherServlet` → method security proxy → controller | `@PreAuthorize` |

CSRF protection is **disabled** and sessions are `STATELESS` (`SecurityConfig`): the API uses bearer tokens instead of cookies, so there is no session to hijack and no server-side session storage.

## 13.7 Token expiry and refresh

- Access token valid 15 minutes (`JwtProperties#accessTokenTtl`). After that the gateway returns 401.
- Client calls `POST /api/auth/refresh` with its refresh token: the old one is marked `revoked`, a **new access + refresh pair** is issued (**rotation**). A refresh token can be used once; a second use gives 401.
- Refresh tokens live 7 days; they are random strings (not JWTs), stored only as SHA-256 hashes, so a database leak does not reveal usable tokens.

## 13.8 Passwords

Passwords are never stored or logged. `BCryptPasswordEncoder` salts and hashes (the hash length is within the 100-char column). Registration requires 8-72 characters (72 = BCrypt's input limit).

---

# 14. Multi-Microservice Architecture

## 14.1 What exists (and what does not)

| Capability | Implemented? | Evidence |
|---|---|---|
| Four independently deployable Spring Boot services, each with its own `main()` and database | **Yes** | section 2 |
| Service discovery (Eureka) | **Yes** | `eureka-server`; every client has `spring-cloud-starter-netflix-eureka-client` |
| API Gateway | **Yes** (Spring Cloud Gateway) | `api-gateway` |
| Client-side load balancing | **Yes** (Spring Cloud LoadBalancer via `lb://` and Feign names). Locally only one instance of each service runs, so no real balancing is *observed*. | `application.yml` routes |
| Synchronous service-to-service REST | **Yes**, Enrollment → Student/Course via OpenFeign | `client/*` |
| Asynchronous messaging | **Yes**, Kafka | `outbox/`, `consumer/` |
| Distributed transaction | **Yes**, orchestrated **saga** with compensation | `saga/` |
| RabbitMQ / other brokers | **No** | — |
| Central config server (Spring Cloud Config) | **No** | — |
| Shared database between services | **No** (strict database-per-service) | — |
| Service mesh | **No** | — |

## 14.2 Eureka (service discovery)

1. `eureka-server` starts with `@EnableEurekaServer` on port 8761.
2. When each other program starts, the Eureka client sends a **registration** (name from `spring.application.name`, IP and port) and then a heartbeat roughly every 30 seconds (library default).
3. Each client downloads the registry and refreshes it periodically.
4. With `lb://student-service` or Feign's `name = "student-service"`, the load balancer replaces the name with a registered instance address.
5. Dead instances are removed (eviction every 5 s as configured; self-preservation is off).

Order consequence: **Eureka first, gateway last** (`start-local.sh`), otherwise the gateway cannot resolve `lb://` names yet.

## 14.3 API Gateway routing table

Defined in `api-gateway/src/main/resources/application.yml`:

| Route id | Predicate (`Path=`) | Target | Filters |
|---|---|---|---|
| `student-service` | `/api/students/**`, `/api/auth/**` | `lb://student-service` | `CircuitBreaker` `studentCB`, fallback `/fallback/student-service` |
| `course-service` | `/api/courses/**` | `lb://course-service` | CircuitBreaker `courseCB` |
| `enrollment-service` | `/api/enrollments/**` | `lb://enrollment-service` | CircuitBreaker `enrollmentCB` |
| `notification-service` | `/api/notifications/**` | `lb://notification-service` | CircuitBreaker `notificationCB` |
| `docs-student`, `docs-course`, `docs-enrollment`, `docs-notification` | `/docs/<name>/v3/api-docs` | the same services | `RewritePath=/docs/<name>/(?<p>.*), /${p}` |

Routes are evaluated in order; the first matching predicate wins. Global filters (`CorrelationIdGlobalFilter`, `JwtAuthGlobalFilter`) run for every route. The gateway is **reactive** (Netty, `Mono<Void>`), so its filters have a different shape from servlet filters: `filter(exchange, chain)` returns a `Mono` and `chain.filter(exchange)` continues the pipeline.

## 14.4 Synchronous communication: OpenFeign

`StudentClient` and `CourseClient` (`client/`) are **interfaces only**:

```java
@FeignClient(name = "student-service", url = "${clients.student-service.url:}", configuration = FeignConfig.class)
public interface StudentClient {
    @GetMapping("/api/students/{id}")             StudentInfo get(@PathVariable("id") Long id);
    @GetMapping("/api/students/{id}/eligibility") EligibilityInfo eligibility(@PathVariable("id") Long id);
}
```

At startup `@EnableFeignClients` generates an implementation: calling `eligibility(7L)` builds `GET http://<student-service instance>/api/students/7/eligibility`, adds headers, sends it and parses the JSON into the record. An empty `url` property means "use the name via Eureka/LoadBalancer".

| Feign client | Calls (endpoint #) |
|---|---|
| `StudentClient#get` | `GET /api/students/{id}` (#8) |
| `StudentClient#eligibility` | `GET /api/students/{id}/eligibility` (#9) |
| `CourseClient#get` | `GET /api/courses/{id}` (#19) |
| `CourseClient#availability` | `GET /api/courses/{id}/availability` (#20) |
| `CourseClient#reserve` | `POST /api/courses/{id}/seats/reserve` (#24) |
| `CourseClient#release` | `POST /api/courses/{id}/seats/release` (#25) |

`RemoteDtos` keeps **consumer-side** copies of the response shapes with `@JsonIgnoreProperties(ignoreUnknown = true)`: Enrollment reads only the fields it needs and does not break when Student/Course add fields; it never imports another service's entity classes.

## 14.5 Service-to-service authentication and correlation

`FeignConfig#serviceAuthInterceptor` runs on **every** Feign request: it adds `Authorization: Bearer <service JWT>` (role `SERVICE`, 5 minutes, created with the shared secret) and copies `correlationId` from the logging MDC into `X-Correlation-Id`, so one customer action can be traced across logs of all services. `FeignConfig#remoteErrorDecoder` converts HTTP status codes: 404 → `RemoteNotFoundException`; 409 → `RemoteConflictException`; 400/401/403/422 → `RemoteRejectedException`; anything else (5xx, network) → `RemoteUnavailableException`. Calls go **directly service-to-service** (via Eureka), not back through the gateway.

## 14.6 Resilience4j around every remote call

`StudentGateway` and `CourseGateway` wrap each Feign call in four annotations (the Spring AOP proxy applies them from the outside in, in this order):

1. **`@Retry`** (outermost): up to 3 attempts, wait 300 ms then doubled (exponential, multiplier 2). Business exceptions are in `ignore-exceptions` and are **not** retried.
2. **`@CircuitBreaker`**: sliding window of 10 calls, needs at least 5, opens at ≥ 50 % failures, stays open 10 s, then lets 3 trial calls (half-open) and closes if they succeed. While open, calls fail instantly with `CallNotPermittedException`. Business answers are ignored (they do not count as failures).
3. **`@TimeLimiter`**: 4 seconds per call; cancels the running future.
4. **`@Bulkhead(type = THREADPOOL)`** (innermost): the call runs on a separate pool (core 10, max 20, queue 50). If it is full, `BulkheadFullException`. `TracingContextPropagator` copies the trace context and MDC onto the pool threads.

Because `TimeLimiter` and thread-pool `Bulkhead` require asynchronous methods, each gateway method returns a `CompletableFuture`; `RemoteCall#await(future, serviceName)` waits at most 15 s and translates the failure:

| Cause | Exception raised to the caller |
|---|---|
| 404 / 409 / other 4xx from the dependency | the same `Remote*Exception` (a business answer) |
| `CallNotPermittedException` | `ServiceUnavailableException` "circuit breaker is OPEN" |
| `BulkheadFullException` | `ServiceUnavailableException` "overloaded (bulkhead full)" |
| timeout / any other error | `ServiceUnavailableException` |

`ServiceUnavailableException` becomes HTTP 503 in `GlobalExceptionHandler` when it escapes a controller; inside the saga it is caught and turns into a rejection or a **paused** saga.

## 14.7 The enrollment saga (distributed transaction)

**Why a saga:** the enrolment touches three databases (Student read, Course seats, Enrollment rows). A single database transaction cannot span them, so the work is split into local steps, each durable and idempotent, with **compensation** (undo) if a later step fails.

**Orchestrator:** `EnrollmentSagaOrchestrator` is the conductor. It stores progress in `sms_saga_instances` after every step, so if the JVM dies mid-way it can resume.

| State (after the step) | Step method | What it does | Failure result |
|---|---|---|---|
| `STARTED` | `start` | Inserts the saga row with the idempotency key (unique). A second request with the same key returns the existing saga (**idempotent replay**). | — |
| `STUDENT_VALIDATED` | `validateStudent` | `StudentGateway#eligibility` (must be ACTIVE) then `getStudent` (name + e-mail snapshot). | `fail(...)` → `COMPENSATING` ("Student X does not exist", "not eligible", "validation failed") |
| `COURSE_VALIDATED` | `validateCourse` | `CourseGateway#getCourse` (ACTIVE) then `availability` (must be available). | `fail(...)` |
| `PENDING_CREATED` | `createPendingEnrollment` | **One local transaction:** insert `Enrollment` PENDING + `EnrollmentRequested` outbox row + update saga. Unique `active_key` rejects a duplicate active enrolment. | `DataIntegrityViolationException` → `fail("already has an active enrollment")` |
| `SEAT_RESERVED` | `reserveSeat` | `CourseGateway#reserveSeat(courseId, enrollmentId)` (Course Service atomic UPDATE; idempotent per enrollmentId). | 409 → `fail("no seats available")`; other errors → `fail` |
| `COMPLETED` | `confirm` | **One local transaction:** Enrollment PENDING → CONFIRMED + `EnrollmentConfirmed` outbox row + saga COMPLETED. | exception → `fail(...)` (the seat is returned by `compensate`) |
| `COMPENSATING` → `REJECTED` | `compensate` | Release the seat remotely (idempotent no-op if none); then **one local transaction**: create a REJECTED enrolment (if none yet) or move PENDING → REJECTED, outbox row `EnrollmentRejected`, saga REJECTED. If Course Service is unavailable → `SagaPausedException`; the saga stays and is retried. | — |

`run(sagaId)` loops `step(...)` until the state is terminal (`COMPLETED`/`REJECTED`) or paused, with a guard of 12 iterations. Every `save(...)` is a `saveAndFlush`, so the database always reflects the last completed step.

**Recovery:** `SagaRecoveryJob#recover` runs every 15 s; it loads up to 50 sagas that are not terminal and not updated for 30 s (`findTop50ByStateNotInAndUpdatedAtBeforeOrderByUpdatedAt`) and calls `orchestrator.run(id)` for each. `OptimisticLockingFailureException` (another worker is already running it, thanks to the `@Version` column) is logged and skipped.

**HTTP view of the result:** CONFIRMED → 201; REJECTED → 422 with the reason in `message`; still moving or paused → 202 `IN_PROGRESS`.

## 14.8 Transactional outbox and the Kafka producer

**Problem solved:** "update the database *and* publish to Kafka" cannot be atomic across two systems. If the app crashed between the two, state and event would disagree.

**Solution in this code:**

1. Inside the **same local transaction** that changes the enrolment, `EnrollmentEventRecorder#record` builds an `EnrollmentEvent` (random `eventId`) and `OutboxWriter#store` inserts a row into `sms_outbox_events` (`status = PENDING`, JSON payload). Both classes use `Propagation.MANDATORY`, so calling them outside a transaction fails fast.
2. `OutboxPublisher#publishPending` (`@Scheduled`, every second) opens a transaction and calls `publishBatch`: `OutboxEventRepository#lockDue` fetches up to 50 due rows with `SELECT ... FOR UPDATE SKIP LOCKED` ordering by `outbox_id`.
3. For each row: `kafka.send(record).get(5 s)` — waits for the broker's acknowledgement (`acks=all`) — then marks it `PUBLISHED`, sets `publishedAt`. The record key is the enrolment id (all events of one enrolment go to the same partition, so their order is kept) and headers carry `eventId` and `eventType`.
4. On failure: `attempts++`, `nextAttemptAt = now + min(60, 2^attempts) s`, `lastError` stored, and that aggregate's later events are **skipped in this batch** (to keep order). Nothing is dropped.
5. Meters `outbox.events.published`, `outbox.events.failed`, gauge `outbox.events.pending` expose health to Prometheus.

**Delivery guarantee:** *at least once*. A crash after the broker ack but before the commit re-sends the row, so consumers must de-duplicate (the inbox, below).

**Topics** (all 3 partitions, 1 replica, created at startup by `KafkaAdmin.NewTopics`): `enrollment.requested`, `enrollment.confirmed`, `enrollment.rejected`, `enrollment.cancelled`, `course.low-availability`, plus a `.DLT` twin for each declared by Notification Service.

Course Service's low-seat alert does **not** use the outbox: it uses `@TransactionalEventListener(AFTER_COMMIT)` and a direct `KafkaTemplate#send`, with only a logged error on failure (a **best-effort** notification; this difference is deliberate and visible in `LowAvailabilityPublisher`).

## 14.9 Consuming events: inbox, notification, dispatcher, dead letters

1. `EventConsumers#onEnrollmentEvent` (`@KafkaListener` id `enrollment-events`, four topics) receives a `ConsumerRecord<String, EnrollmentEvent>`. JSON is converted by `JsonDeserializer` (type forced by `spring.json.value.default.type`).
2. `NotificationIngestService#handleEnrollmentEvent(event, topic)` (one transaction):
   1. `InboxMessageRepository#existsByMessageIdAndConsumerGroup(eventId, "notification-service")` → duplicate → ignore. This is the **inbox pattern**.
   2. `saveAndFlush(new InboxMessage(...))`. If two consumers race, the UNIQUE (message_id, consumer_group) constraint fails one of them and Kafka redelivers.
   3. Maps the event type: Confirmed → `ENROLLMENT_CONFIRMED`; Rejected → `ENROLLMENT_REJECTED`; Cancelled → `ENROLLMENT_CANCELLED`; **Requested → no notification** (recorded in the inbox only).
   4. A second guard `existsByEnrollmentIdAndNotificationType` plus the unique index prevent a duplicate notification for the same enrolment and type.
   5. Inserts a `Notification` (`PENDING`, recipient = `studentEmail` from the event, text built by `message(type, event)`).
3. `onLowAvailability` → `handleLowAvailability`: inbox check, then a `COURSE_LOW_AVAILABILITY` notification addressed to `notification.admin-email`.
4. After the listener returns normally, Spring commits the Kafka offset (`ack-mode: record`).
5. **Sending:** `NotificationDispatcher#dispatch` (every 2 s) → `NotificationRepository#findDue(PENDING, now, 50)` → for each id `NotificationProcessor#process(id)` (new transaction): `EmailSimulator#send` logs `EMAIL SENT ...` → status `SENT`, `processedAt` set. On failure: `retryCount++`; permanent problems (`NonRetryableNotificationException`, e.g. no recipient) or 5 attempts → `FAILED`; otherwise `nextAttemptAt = now + 5 s × 2^(retryCount-1)`.
6. **Listener failures:** `KafkaConfig#kafkaErrorHandler` (`DefaultErrorHandler`): retries with exponential back-off (1 s, ×2, up to 15 s total) then `DeadLetterPublishingRecoverer` publishes to `<topic>.DLT` on the same partition. Records that cannot be deserialised go to the DLT immediately.
7. Real e-mail sending is **not implemented**; `EmailSimulator` is a simulation (test addresses ending `@fail.test` always fail, `@flaky.test` fail twice).

## 14.10 CQRS in Enrollment Service

**CQRS** (Command Query Responsibility Segregation) separates "do something" from "ask something":

| | Write side | Read side |
|---|---|---|
| Objects | `CreateEnrollmentCommand`, `CancelEnrollmentCommand`, `UpdateEnrollmentCommand` (records) | `GetEnrollmentQuery`, `SearchEnrollmentsQuery`, `StudentEnrollmentHistoryQuery`, `CourseEnrollmentsQuery` |
| Handlers | `*CommandHandler` classes (may call other services, write events) | `EnrollmentQueryHandlers` (`readOnly`, no remote calls) |
| Store | Same MySQL tables | Same MySQL tables |

This is the *lightweight* form: one database, no separate read model or event sourcing (**not implemented**).

## 14.11 Error handling between services

- A downstream HTTP failure is classified by `FeignConfig#remoteErrorDecoder` (business vs. technical) and made safe by Resilience4j and `RemoteCall#await`.
- Inside the saga, *business* answers become a clean **REJECTED** result with a reason; *technical* outages at the compensation step **pause** the saga (a retry later), never lose it.
- Idempotent endpoints (`seats/reserve`, `seats/release`) make retries safe.
- Asynchronous failures are handled by outbox retry (producer side) and error handler + DLT (consumer side).
- The gateway returns 503 `fallback` JSON when a whole service is unreachable.

## 14.12 One complete multi-service business transaction

**Scenario:** an ADMIN enrolls student 12 in course 5 (course has 3 seats left; threshold 5).

1. **Client → Gateway** `POST /api/enrollments` `{"studentId":12,"courseId":5}`; Idempotency-Key `K1`. Gateway validates the JWT, routes to Enrollment Service.
2. **Enrollment Service** `EnrollmentController#enroll` → `CreateEnrollmentCommandHandler#handle` (no duplicate) → `EnrollmentSagaOrchestrator#start`: inserts `sms_saga_instances` (key `K1`, `STARTED`).
3. `validateStudent`: Feign `GET /api/students/12/eligibility` → Student Service answers `{eligible:true}` (cached or `SELECT`), then `GET /api/students/12` → name/e-mail stored in the saga row. State `STUDENT_VALIDATED`.
4. `validateCourse`: Feign `GET /api/courses/5` (ACTIVE) and `GET /api/courses/5/availability` (available). State `COURSE_VALIDATED`.
5. `createPendingEnrollment`: **local transaction** → `sms_enrollments` row (PENDING) + `sms_outbox_events` (`EnrollmentRequested`) + saga `PENDING_CREATED`.
6. `reserveSeat`: Feign `POST /api/courses/5/seats/reserve {enrollmentId}` → **Course Service** `SeatService#reserve`: atomic `UPDATE sms_courses ... available_seats - 1 WHERE available_seats > 0` → insert `sms_seat_reservations` → caches evicted after commit → seats left 2 ≤ 5 → after commit a `LowCourseAvailabilityEvent` goes to Kafka. State `SEAT_RESERVED`.
7. `confirm`: **local transaction** → Enrollment CONFIRMED + outbox `EnrollmentConfirmed` + saga `COMPLETED`.
8. Controller returns **201** `{result: CONFIRMED, enrollment: {...}}` to the client.
9. **Asynchronously** (within ~1-3 s): `OutboxPublisher` sends `EnrollmentRequested` and `EnrollmentConfirmed` to Kafka → Notification Service consumes them → inbox rows; `EnrollmentRequested` is recorded only; `EnrollmentConfirmed` creates a `PENDING` notification → `NotificationDispatcher` → `EmailSimulator` logs "EMAIL SENT" → status `SENT`. The low-seat event creates an admin notification the same way.
10. **If step 6 had failed** with "no seats" (409): `fail(...)` → `COMPENSATING` → `compensate` releases (no-op) and marks the enrolment REJECTED with an `EnrollmentRejected` outbox row → client gets **422** with the reason, a rejection e-mail is later "sent", and Course Service's seat count is unchanged.
11. **If Course Service were down at step 6:** retries (3×), then circuit breaker/timeout → `ServiceUnavailableException` → `fail` → `compensate` → release also unavailable → `SagaPausedException` → HTTP **202** `IN_PROGRESS`; `SagaRecoveryJob` resumes it within about 30-45 s once the service is back.

---

# 15. Scripts and Execution Commands

All four scripts are in `scripts/`. Nothing in them changes application source code. They are the "how do I run it" layer.

## 15.1 `scripts/start-local.sh` — start the whole stack as local JVMs

**Purpose:** start Eureka, the four services and the gateway in the correct order as background Java processes on the host, wait for each to become healthy, then print the URLs. **Prerequisites:** infrastructure is already up (`docker compose up -d kafka redis jaeger`), MySQL is running on the host, and jars exist (`mvn -DskipTests package`).

Line-by-line:

| Lines | Code | Explanation |
|---|---|---|
| 1 | `#!/usr/bin/env bash` | Run with Bash. |
| 2-3 | comments | Usage notes. |
| 4 | `set -euo pipefail` | `-e` stop on the first failing command; `-u` error on unset variables; `pipefail` a pipeline fails if any part fails. |
| 5 | `cd "$(dirname "$0")/.."` | Go to the project root regardless of where the script is launched from (`$0` = script path). |
| 6 | `mkdir -p logs` | Create the `logs/` folder if missing; every service writes `logs/<name>.log`. |
| 7-11 | `start() { name jar port }` | Helper function. **Line 8:** `(echo > /dev/tcp/127.0.0.1/$3) 2>/dev/null` tries to open a TCP connection to the port using Bash's built-in `/dev/tcp`; success means something already listens, so it prints "already listening" and `return`s (idempotent start). **Line 9:** `nohup java -jar "$2" > "logs/$1.log" 2>&1 &` runs the JAR immune to terminal hang-up, sends stdout+stderr to the log, in the background. **Line 10:** prints the PID (`$!`), port and log path. |
| 12-18 | `wait_up() { name port }` | Helper that polls health. `for _ in $(seq 1 90)` up to 90 tries; `curl -fs http://localhost:$2/actuator/health` (`-f` fail on HTTP errors, `-s` silent) succeeds only when the status is 2xx (health `UP`); prints "UP" and returns; else `sleep 2`. After 90 × 2 s = 3 minutes it prints a failure message pointing to the log and `return 1` (and `set -e` aborts the script). |
| 19 | `start eureka-server ... 8761; wait_up eureka-server 8761` | **First**: the registry must exist before others register. Waits until healthy. |
| 20-23 | `start` student (8081), course (8082), enrollment (8083), notification (8084) | The four JVMs are launched back-to-back **without waiting** so they boot in parallel (JVM start-up is slow). |
| 24 | `for p in "student-service 8081" ...; do wait_up $p; done` | Now wait for each in turn. `$p` is intentionally unquoted so it splits into the two arguments (name, port). |
| 25 | `start api-gateway ... 8080; wait_up api-gateway 8080` | **Last**: by now all services are registered with Eureka. |
| 26 | `echo "All up. Gateway ... Eureka ... Swagger ..."` | Prints `http://localhost:8080`, `:8761`, and `/swagger-ui.html`. |

**What happens next:** the JVMs run until stopped. Each service performs the startup sequence from section 4 (Flyway, JPA, Kafka, Eureka registration). The script exits as soon as the gateway is healthy; the services keep running in the background. **Caveat recorded in the README:** if you rebuild jars while these JVMs run, restart them.

## 15.2 `scripts/stop-local.sh` — stop by port

| Line | Code | Explanation |
|---|---|---|
| 2 | comment | "never uses `pkill -f`" (a pattern kill could hit unrelated Java processes). |
| 3 | `for port in 8080 8081 8082 8083 8084 8761; do` | Gateway, four services, Eureka. |
| 4 | `pid=$(lsof -ti tcp:$port -sTCP:LISTEN 2>/dev/null ...)` followed by the OR operator and `true` | `lsof -t` prints only the PID, `-i tcp:$port` selects that port, `-sTCP:LISTEN` only the listening socket. The trailing OR-`true` keeps the loop alive when nothing is listening: the variable is simply empty and the next line skips the kill. |
| 5 | `[ -n "$pid" ] && { kill $pid && echo "stopped :$port (pid $pid)"; }` | If a PID was found send `SIGTERM` (graceful shutdown: Spring closes Tomcat, Kafka consumers, DB pool and deregisters from Eureka) and print a line. |

It only stops the six JVMs; Docker containers (Kafka, Redis, Jaeger) are stopped with `docker compose down` (or left running).

## 15.3 `scripts/e2e.py` — end-to-end verification through the gateway

**Purpose:** a Python script (standard library only: `urllib`, `json`, `concurrent.futures`) that exercises the **whole running system** the way a real client would, and prints `PASS`/`FAIL` for 43 assertions. Exit code 0 = all passed, 1 = something failed. It needs the stack from `start-local.sh`.

### Helper functions (lines 1-35)

| Part | Explanation |
|---|---|
| `GW`, `ADMIN_PW`, `RUN` | Gateway URL (env `GATEWAY`, default `http://localhost:8080`), admin password (env `ADMIN_PASSWORD`, falling back to the development default; not shown here) and a random 6-hex-digit `RUN` id appended to usernames/emails/course codes so the script can be re-run without unique-constraint clashes. |
| `call(method, path, body, token, headers)` | Builds an HTTP request, adds JSON and Bearer headers, sends it, and **returns `(status, parsed_json)` even for HTTP errors** (it catches `HTTPError` and still reads the body). 60-second timeout. |
| `check(name, cond, detail)` | Prints `PASS`/`FAIL`, remembers failures in `FAILS`. |
| `poll(fn, timeout=40, every=1.0)` | Repeats a function until it returns something truthy; used for asynchronous (Kafka) effects. |

### Test phases (what is called and what is expected)

| Phase (lines) | Calls | Assertions |
|---|---|---|
| **Auth** (38-44) | `GET /api/students` without token; login as `admin`; refresh; refresh again with the old token; login with a wrong password; `GET /api/auth/me` | No token → **401** from the gateway. Admin login 200. Refresh returns a **new** refresh token. Old refresh token → **401** (rotation). Wrong password → 401. `/me` role = ADMIN. |
| **Master data** (47-55) | Create a category; create a **2-seat** course; create 4 students | All 201; 4 students have ids. |
| **Role checks** (58-68) | Public registration (STUDENT) ; anonymous registration with `role: ADMIN`; ADMIN creates STAFF; student logs in; student lists students; reads own profile; reads another; creates a course; lists courses; enrolls someone else | STUDENT created (201, role STUDENT). Anonymous ADMIN → **403**. ADMIN can create STAFF (201). STUDENT: list students **403**; own profile 200; other profile **403**; create course **403**; browse courses 200; enroll another student **403**. |
| **Enrollment workflows** (71-91) | Enroll student 1 (key `k1`); replay with same key; enroll again with a new key; check availability; unknown student; unknown course; deactivate student 3 then enroll; student 2 fills the course; student 4 when full; availability; history; course list; search; cancel; availability; cancel again; re-enroll | 201 `CONFIRMED`; replay returns the **same** enrolment id; duplicate active enrolment **409**; seats 1 of 2 left; unknown student **422** ("does not exist"); unknown course **422**; inactive student **422** ("not eligible"); second student **201**; full course **422** ("no seats"); availability 0 (never negative); student history contains the enrolment; course list with `status=CONFIRMED` has 2; search by `studentId`+`REJECTED` has 1; cancel → `CANCELLED`; seat released (1); second cancel **422**; re-enroll after cancel **201**. |
| **Asynchronous notifications** (94-106) | Polls `GET /api/notifications/student/{id}` for up to 40 s | `ENROLLMENT_CONFIRMED`/`SENT` for student 2; confirmation **and** cancellation for student 1; rejection for student 4; a search for all confirmations shows at most **one** notification per enrolment (inbox/unique constraint proof). |
| **Concurrency** (109-116) | Create a 4-seat course and 15 students; fire 15 simultaneous enrollment requests with a `ThreadPoolExecutor(max_workers=15)` | Exactly **4** × 201 and **11** × 422; final availability exactly **0** of 4 — never oversold. |
| **Summary** (118-119) | Prints "ALL CHECKS PASSED" or the failed list and exits 0/1. | — |

**What the script proves about the architecture:** gateway authentication, role enforcement in services, JWT refresh rotation, saga success and each compensation path, idempotency, Course Service's atomic seat logic under real concurrency, and the Kafka → inbox → dispatcher pipeline. **Side effects:** it creates test rows with a `RUN` suffix in the `sms_*` tables (categories, courses, students, enrolments, notifications) and does not delete them.

## 15.4 `scripts/verify-db.sh` — read-only database check

Not one of the three scripts you asked about, but included for completeness: it loads `MYSQL_USER`/`MYSQL_PASSWORD` from `.env` (only those two keys; `sed` removes trailing comments), requires them to be set (`: "${VAR:?message}"`), then for each of the four databases lists (1) the **original** tables with their row counts, (2) the tables added by Flyway (`sms_%` and `flyway_schema_history`) and (3) the Flyway history (`V<version> description success=`). Every query is `SELECT`; it modifies nothing. Its purpose is to demonstrate that existing tables/data are untouched.

## 15.5 Maven, Docker and run commands

All commands run from the project root.

| Goal | Command | Notes |
|---|---|---|
| Build everything, no tests | `mvn -DskipTests package` | Produces `<module>/target/<name>-1.0.0.jar`. |
| Build one service and what it needs | `mvn -pl services/student-service -am -DskipTests package` | `-pl` project list, `-am` also-make (builds `common-web` first). |
| Unit tests | `mvn test` | JUnit 5 + Mockito. |
| Unit + integration tests | `mvn verify` | Failsafe runs `*IT` classes with Testcontainers; needs Docker. |
| Infrastructure only | `docker compose up -d kafka redis jaeger` | Host ports 9092, 6379, 16686/4318. |
| Start the stack (local JVMs) | `scripts/start-local.sh` | section 15.1. |
| Run **one** service from its JAR | `java -jar services/enrollment-service/target/enrollment-service-1.0.0.jar` | Needs Eureka/DB/Kafka/Redis it uses. |
| Run one service from source | `mvn -pl services/student-service spring-boot:run` | Compiles and starts without packaging. |
| Change port / any setting | `java -jar ... --server.port=9090` or `SERVER_PORT=9090 java -jar ...` | Precedence in section 8.2. |
| Supply secrets for a real deployment | `MYSQL_USER=... MYSQL_PASSWORD=... JWT_SECRET=... java -jar ...` | Same JWT secret for **all** programs. |
| Select a Spring profile | `java -jar ... --spring.profiles.active=<name>` | Allowed, but no profile files exist (section 8.6). |
| Verify end to end | `python3 scripts/e2e.py` | section 15.3. |
| Stop JVMs | `scripts/stop-local.sh` | section 15.2. |
| Containerised app stack | `docker compose --profile mysql-proxy up -d --build` | **Not executed/verified in this project's history** (listed as an open gap, section 21.3). |
| Kubernetes | `kubectl apply -k kubernetes/` | Manifests exist; **never applied** (open gap). |
| Package as a runnable JAR | `mvn -DskipTests package` | The `spring-boot-maven-plugin` creates the executable "fat" JAR; a plain `java -jar` is enough, no application server. |

## 15.6 Useful URLs while running

| URL | What |
|---|---|
| `http://localhost:8080/swagger-ui.html` | Swagger UI for all four services (dropdown). |
| `http://localhost:8761` | Eureka dashboard (registered services). |
| `http://localhost:16686` | Jaeger traces. |
| `http://localhost:8080/actuator/health` | Gateway health. |
| `http://localhost:808x/actuator/health` | Each service health. |
| `http://localhost:808x/actuator/prometheus` | Metrics text. |

---

# 16. Real Code Tracing Examples

Four complete traces follow the **actual** classes and methods. Paths are relative to the project root; `S/`, `C/`, `E/`, `N/` abbreviate the service source roots:

- `S/` = `services/student-service/src/main/java/com/example/student/`
- `C/` = `services/course-service/src/main/java/com/example/course/`
- `E/` = `services/enrollment-service/src/main/java/com/example/enrollment/`
- `N/` = `services/notification-service/src/main/java/com/example/notification/`
- `G/` = `api-gateway/src/main/java/com/example/gateway/`
- `W/` = `common/common-web/src/main/java/com/example/common/`

## 16.1 Use case A — Create a student (`POST /api/students`)

Input:

```http
POST http://localhost:8080/api/students
Authorization: Bearer <ADMIN access token>
Content-Type: application/json

{"firstName":"Asha","lastName":"Rao","email":"Asha.Rao@Example.com","phoneNumber":"+91 9876543210","dateOfBirth":"2002-05-14","gender":"FEMALE"}
```

| Step | Who | File → method | What happens |
|---|---|---|---|
| 1 | Client | — | Sends the request to port 8080. |
| 2 | Gateway | `G/filter/CorrelationIdGlobalFilter.java` → `filter` | No `X-Correlation-Id` header → generates a UUID, sets it on request and response. |
| 3 | Gateway | `G/filter/JwtAuthGlobalFilter.java` → `filter`, `isPublic` | Path is not public; `Authorization` header present; `JwtTokenService#parse` succeeds → continue. |
| 4 | Gateway | `api-gateway/src/main/resources/application.yml` route `student-service` | `Path=/api/students/**` matches → `lb://student-service`; Eureka list → `localhost:8081`. |
| 5 | Student Service | `W/web/CorrelationIdFilter.java` → `doFilterInternal` | Puts `correlationId` into MDC. |
| 6 | Student Service | `W/security/JwtAuthenticationFilter.java` → `doFilterInternal` | Token parsed → `AuthenticatedUser(role ADMIN)` stored in `SecurityContext`. |
| 7 | Student Service | `S/config/SecurityConfig.java` → `filterChain` | `anyRequest().authenticated()` satisfied. |
| 8 | Spring MVC | `DispatcherServlet` | `POST /api/students` → `StudentController#create`. |
| 9 | Jackson + Validator | `S/dto/StudentRequest.java` | JSON → record; `@NotBlank/@Email/@Size/@Past`, `@ValidPhoneNumber` (`S/validation/PhoneNumberValidator.java#isValid`: 7-15 digits) pass. |
| 10 | Method security | `S/controller/StudentController.java` → `create` (`@PreAuthorize("hasAnyRole('ADMIN','STAFF')")`) | ADMIN → allowed. |
| 11 | Controller | `StudentController#create` | Calls `service.create(request)`. |
| 12 | Service | `S/service/StudentService.java` → `create` (`@Transactional`) | Transaction begins. |
| 13 | Repository | `S/repository/StudentRepository.java` → `existsByEmailIgnoreCase("Asha.Rao@Example.com")` | `SELECT ... FROM sms_students WHERE lower(email)=lower(?)` → false. |
| 14 | Mapper | `S/mapper/StudentMapper.java` → `toEntity` → `apply` | Trim names, **e-mail lower-cased** to `asha.rao@example.com`, `enrollmentDate = today`, `status = ACTIVE`. |
| 15 | Repository / Hibernate | `StudentRepository#save` (`SimpleJpaRepository`) | `INSERT INTO sms_students (...)`; MySQL `AUTO_INCREMENT` id returned, set on the entity; `createdAt/updatedAt` auto-filled. |
| 16 | Mapper | `StudentMapper#toResponse` | Entity → `StudentResponse` record. |
| 17 | Service | `create` returns | Transaction **commits**; connection returned to the pool. Log: `Created student id=...`. |
| 18 | Controller | `ResponseEntity.created(URI.create("/api/students/" + id)).body(created)` | 201 + `Location`. |
| 19 | Filters unwind | `CorrelationIdFilter` | Logs `POST /api/students -> 201 (n ms)`; MDC cleared. |
| 20 | Gateway → Client | `CorrelationIdGlobalFilter` doFinally | Logs the gateway line; client receives the body. |

Output (201):

```json
{"studentId":42,"firstName":"Asha","lastName":"Rao","email":"asha.rao@example.com","phoneNumber":"+91 9876543210",
 "dateOfBirth":"2002-05-14","gender":"FEMALE","address":null,"enrollmentDate":"2026-11-10","status":"ACTIVE",
 "createdAt":"2026-11-10T12:00:00","updatedAt":"2026-11-10T12:00:00"}
```

(Values illustrative; field names and shape are exactly `StudentResponse`.)

## 16.2 Use case B — Enroll a student (`POST /api/enrollments`)

Input: `{"studentId":42,"courseId":5}`, header `Idempotency-Key: demo-1`, ADMIN token.

| Step | File → method | What happens |
|---|---|---|
| 1-3 | Gateway filters + route `enrollment-service` | Correlation id, JWT check, `lb://enrollment-service` → `localhost:8083`. |
| 4 | `E/controller/EnrollmentController.java` → `enroll` | Validated `EnrollmentRequest` (`@NotNull @Positive`); `requireSelfOrStaff` passes for ADMIN; key = `demo-1`. |
| 5 | `E/command/CreateEnrollmentCommandHandler.java` → `handle` | New key + no active duplicate (`EnrollmentRepository#existsByStudentIdAndCourseIdAndStatusIn`). |
| 6 | `E/saga/EnrollmentSagaOrchestrator.java` → `start` | `SagaInstanceRepository#saveAndFlush` → row `STARTED`. |
| 7 | `run` → `step` → `validateStudent` | `E/client/StudentGateway.java#eligibility` → Resilience4j → `StudentClient#eligibility` (Feign) → `FeignConfig#serviceAuthInterceptor` adds service JWT → **Student Service** `StudentController#eligibility` → `StudentService#eligibility` → `{eligible:true}`. Then `getStudent` → name/e-mail. State `STUDENT_VALIDATED`. |
| 8 | `validateCourse` | `CourseGateway#getCourse` → **Course Service** `CourseController#get` → `CourseService#getById` (cache or DB); `availability` likewise. State `COURSE_VALIDATED`. |
| 9 | `createPendingEnrollment` | `TransactionTemplate`: `EnrollmentRepository#saveAndFlush(Enrollment PENDING)` → `INSERT INTO sms_enrollments` (the generated `active_key` = `42-5`); `E/event/EnrollmentEventRecorder.java#record(EnrollmentRequested)` → `E/outbox/OutboxWriter.java#store` → `INSERT INTO sms_outbox_events`; saga → `PENDING_CREATED`. Commit. |
| 10 | `reserveSeat` | `CourseGateway#reserveSeat` → **Course Service** `CourseController#reserve` → `C/service/SeatService.java#reserve` → `C/repository/CourseRepository.java#reserveSeat` (atomic UPDATE) → insert `sms_seat_reservations` → evict caches after commit. Saga `SEAT_RESERVED`. |
| 11 | `confirm` | `TransactionTemplate`: `Enrollment#transitionTo(CONFIRMED)`; outbox `EnrollmentConfirmed`; saga `COMPLETED`. Commit. |
| 12 | `CreateEnrollmentCommandHandler#handle` | Loads the enrolment → `EnrollmentOutcome(CONFIRMED, "Enrollment confirmed", ...)`. |
| 13 | `EnrollmentController#enroll` | `switch` → `HttpStatus.CREATED`. |
| 14 | Background | `E/outbox/OutboxPublisher.java#publishPending` publishes the two events (section 16.3). |

Output (201):

```json
{"result":"CONFIRMED","message":"Enrollment confirmed",
 "enrollment":{"enrollmentId":77,"studentId":42,"courseId":5,"studentName":"Asha Rao","courseName":"Java Microservices",
  "enrollmentDate":"2026-11-10T12:01:02","enrollmentStatus":"CONFIRMED","remarks":null,"createdAt":"...","updatedAt":"..."}}
```

Failure variant (course full) → step 10 returns 409 → `RemoteConflictException` → `fail("Seat reservation failed: no seats available")` → `compensate` → REJECTED enrolment + `EnrollmentRejected` outbox row → **422** `{"result":"REJECTED","message":"Seat reservation failed: no seats available",...}`.

## 16.3 Use case C — From enrolment event to e-mail (asynchronous)

Triggered by the outbox rows created in 16.2.

| Step | File → method | What happens |
|---|---|---|
| 1 | `E/outbox/OutboxPublisher.java` → `publishPending` → `publishBatch` | Every 1 s; `OutboxEventRepository#lockDue` locks due rows (`SKIP LOCKED`). |
| 2 | same → `kafka.send(new ProducerRecord(topic, key=enrollmentId, payload))` | Waits for the broker ack; row → `PUBLISHED`; log `Outbox published EnrollmentConfirmed eventId=...`. |
| 3 | Kafka | Message on `enrollment.confirmed` partition `hash(key) mod 3`. |
| 4 | `N/consumer/EventConsumers.java` → `onEnrollmentEvent` | Consumer thread receives `EnrollmentEvent`; logs `Consumed EnrollmentConfirmed ...`. |
| 5 | `N/service/NotificationIngestService.java` → `handleEnrollmentEvent` | Transaction: inbox check (`InboxMessageRepository#existsByMessageIdAndConsumerGroup`) → `saveAndFlush(InboxMessage)` → type `ENROLLMENT_CONFIRMED` → duplicate guard → `NotificationRepository#save(PENDING)` with text *"Hi Asha Rao, your enrollment #77 in Java Microservices is confirmed."* |
| 6 | Spring Kafka | Offset committed after the method returns. |
| 7 | `N/processing/NotificationDispatcher.java` → `dispatch` | Within 2 s: `findDue(PENDING, now, 50)`. |
| 8 | `N/processing/NotificationProcessor.java` → `process(id)` (`REQUIRES_NEW`) | Calls `N/processing/EmailSimulator.java#send` → logs `EMAIL SENT to=... type=ENROLLMENT_CONFIRMED`; status `SENT`, `processedAt` set. |
| 9 | `GET /api/notifications/student/42` | `NotificationController#forStudent` → `NotificationQueryService#forStudent` shows it with status `SENT`. |

The `EnrollmentRequested` event travels the same way but step 5 stops at the inbox row (no notification).

## 16.4 Use case D — Login and an authorised call

| Step | File → method | What happens |
|---|---|---|
| 1 | Gateway `JwtAuthGlobalFilter#isPublic` | `POST /api/auth/login` is in `PUBLIC_POST`. |
| 2 | `S/controller/AuthController.java` → `login` | `@Valid LoginRequest`. |
| 3 | `S/service/AuthService.java` → `login` | `UserAccountRepository#findByUsernameIgnoreCase`; BCrypt `matches`. |
| 4 | `AuthService#issue` | `JwtTokenService#createAccessToken(...)`; random refresh token; `RefreshTokenRepository#save` stores its SHA-256. |
| 5 | Client | Stores `accessToken`; later sends `Authorization: Bearer ...`. |
| 6 | Any protected call, e.g. `GET /api/students/42` | Gateway validates; service filter builds `AuthenticatedUser`; `@PreAuthorize("hasAnyRole('ADMIN','STAFF','SERVICE') or (hasRole('STUDENT') and #user.studentId == #id)")` decides. |

## 16.5 Use case E — Cancel an enrolment (`POST /api/enrollments/77/cancel`)

1. `EnrollmentController#cancel` → `queries.handle(new GetEnrollmentQuery(77))` (`EnrollmentQueryHandlers#handle`) to learn the owner → `requireSelfOrStaff`.
2. `CancelEnrollmentCommandHandler#handle`: status is CONFIRMED.
3. `CourseGateway#releaseSeat(5, 77)` → Course `SeatService#release` → `CourseRepository#releaseSeat` + reservation `RELEASED` + cache evicted.
4. `TransactionTemplate`: `Enrollment#transitionTo(CANCELLED)`; `EnrollmentEventRecorder#record(EnrollmentCancelled)`; commit.
5. Response `EnrollmentResponse` (status CANCELLED). Asynchronously the cancellation event creates a notification as in 16.3. The generated column `active_key` becomes `NULL`, so the student can enrol in the same course again (checked by `e2e.py`).

---

# 17. Exception Handling and Validation Flow

## 17.1 Where validation happens (three layers)

| Layer | Mechanism | Example |
|---|---|---|
| **Shape** (request DTO) | Bean Validation annotations on record components, triggered by `@Valid` in the controller | `StudentRequest.email` `@NotBlank @Email @Size(max=100)`; `EnrollmentRequest` `@NotNull @Positive`; custom `@ValidCourseCode`. |
| **Business rules** (service) | Ordinary `if` + custom exception | "e-mail already exists" → `ConflictException`; "totalSeats below reserved" → `BusinessRuleException`; state machine `Enrollment#transitionTo`. |
| **Database** | Constraints (`UNIQUE`, `CHECK`, FK) | Last line of defence; violations raise `DataIntegrityViolationException`, mapped to 409. |

## 17.2 Exceptions and their HTTP mapping

All are mapped in `common/common-web/src/main/java/com/example/common/exception/GlobalExceptionHandler.java`, an `@RestControllerAdvice` registered once per service by `CommonAutoConfiguration`.

| Exception | Thrown by (examples) | HTTP | Message |
|---|---|---|---|
| `ResourceNotFoundException` | `find(id)` methods | **404** | e.g. "Student 99 not found" |
| `NoResourceFoundException` | unknown path | 404 | "Resource not found" |
| `ConflictException` | duplicate e-mail / username / code, seats | **409** | text from the throw site |
| `OptimisticLockingFailureException` | `@Version` mismatch | 409 | Hibernate message |
| `DataIntegrityViolationException` | DB constraint | 409 | "Operation violates a uniqueness or integrity constraint" (details only in the log) |
| `BusinessRuleException` | invalid state / reference | **422** | text |
| `ServiceUnavailableException` | downstream unavailable | **503** | text |
| `UnauthorizedException` | bad login / refresh token | **401** | text |
| `AccessDeniedException` | `@PreAuthorize`, explicit role checks | **403** | "You do not have permission to perform this action" |
| `MethodArgumentNotValidException` | `@Valid` failure | **400** | "Validation failed" + `fieldErrors` map |
| `HttpMessageNotReadableException`, `MethodArgumentTypeMismatchException`, `MissingRequestHeaderException`, `IllegalArgumentException` | broken JSON, wrong type, bad sort column | 400 | "Malformed request: ..." |
| any other `Exception` | bugs | **500** | "Unexpected server error" (stack trace logged at ERROR, **not** returned) |

Where Spring Security itself rejects the request (no token / token invalid), `JsonSecurityHandlers` writes the 401/403 JSON in the **same shape** because the exception never reaches `@RestControllerAdvice`. The gateway writes its own 401 JSON with the same fields.

**Error body** (`ApiError`, null fields omitted):

```json
{"timestamp":"2026-11-10T12:00:00.123Z","status":400,"error":"Bad Request","message":"Validation failed",
 "path":"/api/students","fieldErrors":{"email":"must be a well-formed email address"}}
```

## 17.3 How exceptions propagate

Exceptions are not caught in the middle layers. A repository or service throws; the exception travels up through the transaction proxy (which **rolls back** on `RuntimeException`), the controller proxy, and out of the controller method; Spring MVC's `HandlerExceptionResolver` finds the matching `@ExceptionHandler` and `GlobalExceptionHandler#build` creates the response. In the saga, exceptions from remote calls are *caught deliberately* to turn them into state transitions (section 14.7).

## 17.4 Trace: a successful request

`GET /api/courses/5/availability` (any valid token), cache hit:

1. Gateway filters → route `course-service` → Course Service filters (JWT principal set).
2. `CourseController#availability` (no `@PreAuthorize`: any authenticated user).
3. `CourseService#availability` is intercepted by the cache proxy: Redis key `sms:courseAvailability::5` found → JSON deserialised to `CourseAvailabilityResponse` → **the method body never runs**, no SQL.
4. 200 `{"courseId":5,"status":"ACTIVE","totalSeats":30,"availableSeats":3,"available":true}`.

## 17.5 Trace: failed requests

**(a) Validation failure** `POST /api/students` with body `{"firstName":"","lastName":"Rao","email":"bad"}`:

1. Gateway and Spring Security pass (valid ADMIN token).
2. MVC argument resolver deserialises JSON, runs the validator: `firstName` `@NotBlank` fails, `email` `@Email` fails.
3. `MethodArgumentNotValidException` is thrown **before** the controller method → never reaches the service or database.
4. `GlobalExceptionHandler#invalid` collects `fieldErrors` (first message per field) → **400** with the body shown above.

**(b) Business conflict** `POST /api/students` with an e-mail that exists:

1. Validation passes → `StudentService#create` (transaction) → `existsByEmailIgnoreCase` true → `ConflictException`.
2. Transaction proxy rolls back (nothing written); exception reaches `GlobalExceptionHandler#conflict` → **409** `{"status":409,"error":"Conflict","message":"A student with email '...' already exists",...}`.

**(c) Missing permission** STUDENT calls `GET /api/students`: gateway passes; `@PreAuthorize("hasAnyRole('ADMIN','STAFF')")` rejects → `AccessDeniedException` → **403**. (This exact case is asserted in `scripts/e2e.py`.)

**(d) No token** `GET /api/students` → the gateway returns **401** itself; Student Service is not contacted.

## 17.6 Logging and debugging

- Every service log line starts with `[service,traceId,spanId,correlationId]` (pattern in `application.yml`). Copy the `correlationId` from the response header `X-Correlation-Id` and search all service logs under `logs/` to follow one request across the gateway, Enrollment, Student and Course.
- `CorrelationIdFilter` writes one access line per request (`http.request` logger) except `/actuator`.
- `GlobalExceptionHandler` logs unhandled exceptions with the stack trace (ERROR) and integrity/unavailable problems as WARN.
- Traces (Jaeger, `http://localhost:16686`) show the spans of one request across services; sampling is 100 %.
- `scripts/start-local.sh` redirects each JVM's console to `logs/<service>.log`.
- Metrics: `/actuator/prometheus` (also `outbox.events.*`, Resilience4j metrics).

---

# 18. Architecture and Design Decisions

## 18.1 Patterns that **are** implemented (with the proof)

| Pattern | Evidence in this code |
|---|---|
| **Layered architecture** | Packages `controller → service → repository → entity` in every service (section 2.3, 6). |
| **MVC / REST** | `@RestController` classes return JSON; there is no server-side view (**the "V" is JSON**). |
| **Repository pattern** | `JpaRepository` interfaces, `*Specifications` for dynamic queries. |
| **DTO pattern + Mapper** | Records in `dto/`; `StudentMapper`, `CourseMapper`, `NotificationMapper`, `EnrollmentResponse#from`. |
| **Dependency Injection / constructor injection** | Every bean (section 4.7, 10). |
| **Separation of concerns** | Cross-cutting code lives in `common-web` (security, errors, correlation), not copy-pasted. |
| **Microservices, database-per-service** | Four services, four databases, no cross-DB foreign keys. |
| **API Gateway** | Single entry; edge JWT check; circuit-breaker fallback. |
| **Service discovery + client-side load balancing** | Eureka + `lb://`. |
| **Event-driven architecture** | Kafka topics and consumers; event contracts independent of entities. |
| **Orchestrated saga with compensation** | `EnrollmentSagaOrchestrator`. |
| **Transactional outbox / inbox** | `OutboxWriter`/`OutboxPublisher`; `InboxMessage`. |
| **Idempotency** | Idempotency-Key + unique saga key; seat reservation unique per enrollment; inbox; unique notification per enrolment/type. |
| **CQRS (lightweight)** | Command handlers vs. `EnrollmentQueryHandlers`. |
| **State machine** | `EnrollmentStatus#allowedNext`, `Enrollment#transitionTo`, `SagaState`. |
| **Circuit breaker, retry, bulkhead, time limiter** | Resilience4j around Feign calls; circuit breaker also in the gateway. |
| **Cache-aside** | `@Cacheable` + `@CachePut/@CacheEvict`; evict-after-commit for courses. |
| **Optimistic and pessimistic locking, atomic conditional update** | Section 9.9. |
| **Dead-letter queue** | `<topic>.DLT`. |
| **Auto-configuration library** | `common-web`. |
| **Defence in depth** | JWT checked at gateway *and* services; DB `CHECK` on seats. |
| **12-factor style configuration** | `${ENV:default}` in `application.yml`. |

## 18.2 SOLID, applied

- **S**ingle responsibility: `OutboxWriter` stores, `OutboxPublisher` publishes, `EnrollmentEventRecorder` builds events.
- **O**pen/closed: new filters/specifications add behaviour without editing existing ones (`Specification` lambdas).
- **L**iskov / **I**nterface segregation: small interfaces (`ConstraintValidator`, `GlobalFilter`); consumers depend on narrow `RemoteDtos` rather than full foreign entities.
- **D**ependency inversion: services depend on repository **interfaces**, not implementations.

## 18.3 Background concepts that are **not** implemented here

| Concept | Status |
|---|---|
| Event sourcing | **Not implemented** (current state is stored; events are integration messages). |
| Separate read database / projections | **Not implemented.** |
| Choreography saga | **Not used** (the saga is orchestrated). |
| Spring Cloud Config / Vault | **Not implemented.** |
| RabbitMQ, gRPC, GraphQL | **Not implemented.** |
| Rate limiting at the gateway | **Not implemented.** |
| Real SMTP / SMS delivery | **Not implemented** (simulator). |
| Multi-instance load balancing demonstration | Not exercised: one instance per service runs locally. |

---

# 19. Glossary

| Term | Meaning |
|---|---|
| **ApplicationContext** | Spring's container that creates and holds all beans. |
| **Auto-configuration** | Spring Boot creating beans automatically from the libraries on the classpath. |
| **Bean** | An object managed by Spring. |
| **Bulkhead** | Limits concurrent calls (here a separate thread pool) so one slow dependency cannot exhaust the app. |
| **CQRS** | Separating commands (writes) from queries (reads). |
| **Circuit breaker** | Stops calling a failing dependency for a while and fails fast. |
| **Compensation** | The undo action of a saga step (release the seat). |
| **Controller** | Class handling HTTP requests. |
| **Correlation id** | Identifier (`X-Correlation-Id`) tying all logs of one request together. |
| **DLT** | Dead-letter topic: where messages that cannot be processed are parked. |
| **DTO** | Data Transfer Object: the shape of request/response data. |
| **Dirty checking** | Hibernate noticing changed fields of a loaded entity and issuing `UPDATE` at commit. |
| **Entity** | A class mapped to a database table. |
| **Eureka** | Netflix service registry (phone book of running services). |
| **Feign** | Declarative HTTP client defined by an interface. |
| **Flyway** | Tool that applies versioned SQL scripts (`V1__...`) once. |
| **Gateway** | Single front door that routes and pre-checks requests. |
| **Hibernate** | The JPA implementation (ORM). |
| **HikariCP** | The JDBC connection pool used by Spring Boot. |
| **Idempotent** | Repeating the operation gives the same result as doing it once. |
| **Inbox** | Table of processed message ids used to ignore duplicate deliveries. |
| **IoC / DI** | The framework creates objects and injects their dependencies. |
| **JPA / JPQL** | Java Persistence API; its object-oriented query language. |
| **JWT** | JSON Web Token: signed token carrying identity and roles. |
| **Kafka** | Distributed log/message broker; topics, partitions, consumer groups, offsets. |
| **Lombok** | Compile-time generator of boilerplate (getters/setters). |
| **MDC** | Mapped Diagnostic Context: per-thread key/values added to log lines. |
| **Optimistic locking** | Detect concurrent change with a `@Version` number. |
| **Outbox** | Table of events written in the same transaction as the business change, published afterwards. |
| **Persistence context** | Hibernate's per-transaction cache of loaded entities. |
| **Pessimistic lock** | Database row lock (`FOR UPDATE`). |
| **Proxy** | Generated wrapper object that adds behaviour (transactions, caching, security) around a bean. |
| **Record** | Compact immutable Java class (`record X(int a)`). |
| **Repository** | Interface for database access. |
| **Saga** | A distributed transaction as a series of local steps plus compensations. |
| **Service (layer)** | Class holding business rules. |
| **Singleton** | One shared instance per application context. |
| **SKIP LOCKED** | SQL clause: ignore rows already locked by someone else. |
| **Starter** | A Maven dependency bundle for a feature (`spring-boot-starter-web`). |
| **Stateless** | The server keeps no per-user session; each request carries its credentials. |
| **Testcontainers** | Starts throw-away Docker containers for integration tests. |
| **TTL** | Time to live (cache entry lifetime). |
| **Specification** | JPA Criteria-based dynamic filter object. |

---

# 20. Beginner Learning and Navigation Guide

## 20.1 Recommended reading order

Read the **source** in this order, opening each file next to the explanation. Each step explains why it comes at that point.

| # | Read | Why now |
|---|---|---|
| 1 | `README.md`, then section 1-2 of this guide | You need the big picture and the vocabulary (service, gateway, Kafka) before code makes sense. |
| 2 | Parent `pom.xml`, then `services/student-service/pom.xml` | Dependencies reveal capabilities: web, JPA, security, cache. |
| 3 | `services/student-service/.../StudentServiceApplication.java` | The entry point: tiny, and everything starts here. |
| 4 | `services/student-service/src/main/resources/application.yml` | See what is configurable: port, database, Redis, Eureka, actuator. |
| 5 | `StudentController` | Controllers show the *public face*: URLs, verbs, roles, validation. |
| 6 | `StudentService` | The business rules and `@Transactional`/`@Cacheable`. |
| 7 | `StudentRepository`, `StudentSpecifications` | How data is read/written without SQL. |
| 8 | `Student`, `UserAccount`, `StudentRequest`, `StudentResponse`, `StudentMapper` | Entities versus DTOs and why they differ. |
| 9 | `db/migration/V1__create_student_and_auth_tables.sql` | The real schema behind the entities. |
| 10 | `common-web`: `CommonAutoConfiguration`, `JwtTokenService`, `JwtAuthenticationFilter`, `GlobalExceptionHandler`; Student `SecurityConfig`, `AuthController`, `AuthService` | Authentication and error handling (shared by every service). |
| 11 | Course Service: `CourseController`, `CourseService`, `SeatService`, `CourseRepository` (JPQL), migration with the `CHECK` | The most important data-integrity idea: atomic seat update. |
| 12 | `api-gateway` (`application.yml` routes, two filters, `FallbackController`) and `eureka-server` | How requests reach services. |
| 13 | Enrollment: `EnrollmentController` → `CreateEnrollmentCommandHandler` → `EnrollmentSagaOrchestrator` → `client/*Gateway`, `FeignConfig`, `RemoteCall` | The multi-service flow. |
| 14 | Enrollment: `EnrollmentEventRecorder`, `OutboxWriter`, `OutboxPublisher`, `SagaRecoveryJob`, migration | Reliability patterns. |
| 15 | Notification: `EventConsumers`, `NotificationIngestService`, `NotificationDispatcher`, `NotificationProcessor`, `KafkaConfig` | The asynchronous side. |
| 16 | `scripts/start-local.sh`, `scripts/e2e.py`, `scripts/stop-local.sh` | See the whole thing run and confirm what you read. |
| 17 | `Documentation/` files 12-20 | Deeper dives into saga, outbox, CQRS, Redis, security, resilience, concurrency. |
| 18 | Section 16 of this guide | Trace real requests through everything you have read. |

## 20.2 Suggested practice

1. Start the stack and open Swagger (`http://localhost:8080/swagger-ui.html`).
2. Log in as the seeded `admin`, copy the token, click **Authorize**.
3. Create a category, a course with 2 seats, three students; enroll all three; watch `logs/enrollment-service.log` for `Saga ... step ...` lines and `logs/notification-service.log` for `EMAIL SENT`.
4. Read `logs/course-service.log` for `Reserved seat ... remaining=`.
5. Re-read section 12 for each call you made.

---

# 21. Verification, Known Gaps and Limitations

## 21.1 How this guide was verified

| Requirement | How it was verified |
|---|---|
| Every class/file mentioned exists | A script extracted every backticked path/file name in this document and checked it against the file system (and class names against `*.java` file names); results below. |
| Method names and mappings match the source | All controllers, services and repositories were read in full while writing; every endpoint row was cross-checked against `@RequestMapping`/`@XxxMapping` and `@PreAuthorize` values. |
| Execution sequences match the code | Saga step order, outbox algorithm, inbox algorithm, dispatcher retry maths and seat reservation steps were taken directly from the method bodies. |
| Tables/relationships match | Entities' `@Table/@Column` and each `V*.sql` migration were compared (section 9.3). |
| Markdown and PDF equivalent | The PDF is generated mechanically from the Markdown file. |
| Source unchanged | No file under `StudentManagement/` was written by this task (only the two output files). |

**Automated check results.** A script extracted every back-ticked token from this document (before the index was appended): 369 path or file-name references resolved to real files or directories; 124 `Class#method` references to project classes were found in the named class's source; the 6 that did not match a method name written in the class itself (`save`, `saveAndFlush`, `findById` on repositories) are methods **inherited from `JpaRepository`**, which is expected. The remaining unmatched tokens were not file references: URL path fragments, enum lists such as `ACTIVE/INACTIVE`, property-name groups, or deliberate examples of files that do **not** exist (`application-dev.yml`, `application-prod.yml`, mentioned only to explain profiles). A second manual check opened the eight abbreviated `path#method` references in section 16 (`S/`, `C/`, `E/`, `N/` prefixes) and confirmed each method exists.

## 21.2 What could not be verified from source

- Hikari pool size and Eureka heartbeat interval are **library defaults**, not set in this project.
- Runtime behaviour of the Compose application stack and the Kubernetes manifests (they were written but never executed in this project's history).
- Behaviour with more than one instance of a service (load balancing, concurrent outbox publishers across instances) is designed for (`SKIP LOCKED`, optimistic locks) but not demonstrated.

## 21.3 Known gaps and observations found while documenting

| # | Observation | Impact |
|---|---|---|
| 1 | `enrollment.saga.max-recovery-attempts: 20` in `enrollment-service/src/main/resources/application.yml` is never read by code. | Recovery attempts are unbounded; the property is misleading. |
| 2 | Development default credentials/secrets exist in each `application.yml` (database login, JWT secret, admin password). | Fine locally; production must override through environment variables or a secret store. |
| 3 | `StudentService#eligibility` calls `getById` on itself, so the `@Cacheable` is bypassed for that call. | Correct but uncached; only a performance note. |
| 4 | Access tokens cannot be revoked before expiry; no login rate limiting. | Security hardening items. |
| 5 | Low-seat alerts are best-effort (direct Kafka send after commit, no outbox). | A broker outage at that instant loses the alert; enrolment events are protected by the outbox. |
| 6 | Notification delivery is simulated; no real e-mail. | Functional placeholder. |
| 7 | Compose app stack and Kubernetes manifests are unverified. | Run and test before relying on them. |
| 8 | `/actuator/metrics` is exposed but requires a token in services (not on the permit list), unlike health/prometheus. | Minor inconsistency. |

---

# 22. Index of Source Files

Every non-test file that matters for understanding the application, with its complete path relative to the project root. The *Kind* column is the layer (section 6); for the explanation of each file see the section named in section 6 (layer tables), 8 (configuration), 9 (database) and 15 (scripts).

| # | Complete relative path | Kind |
|---|---|---|
| 1 | `api-gateway/Dockerfile` | Docker |
| 2 | `api-gateway/pom.xml` | Maven build |
| 3 | `api-gateway/src/main/java/com/example/gateway/ApiGatewayApplication.java` | Entry point (main) |
| 4 | `api-gateway/src/main/java/com/example/gateway/controller/FallbackController.java` | Controller |
| 5 | `api-gateway/src/main/java/com/example/gateway/filter/CorrelationIdGlobalFilter.java` | Gateway filter |
| 6 | `api-gateway/src/main/java/com/example/gateway/filter/JwtAuthGlobalFilter.java` | Gateway filter |
| 7 | `api-gateway/src/main/resources/application.yml` | Configuration |
| 8 | `common/common-web/pom.xml` | Maven build |
| 9 | `common/common-web/src/main/java/com/example/common/CommonAutoConfiguration.java` | Shared library |
| 10 | `common/common-web/src/main/java/com/example/common/KafkaHealthAutoConfiguration.java` | Shared library |
| 11 | `common/common-web/src/main/java/com/example/common/exception/ApiError.java` | Exception handling (shared) |
| 12 | `common/common-web/src/main/java/com/example/common/exception/BusinessRuleException.java` | Exception handling (shared) |
| 13 | `common/common-web/src/main/java/com/example/common/exception/ConflictException.java` | Exception handling (shared) |
| 14 | `common/common-web/src/main/java/com/example/common/exception/GlobalExceptionHandler.java` | Exception handling (shared) |
| 15 | `common/common-web/src/main/java/com/example/common/exception/ResourceNotFoundException.java` | Exception handling (shared) |
| 16 | `common/common-web/src/main/java/com/example/common/exception/ServiceUnavailableException.java` | Exception handling (shared) |
| 17 | `common/common-web/src/main/java/com/example/common/exception/UnauthorizedException.java` | Exception handling (shared) |
| 18 | `common/common-web/src/main/java/com/example/common/security/AuthenticatedUser.java` | Security (shared) |
| 19 | `common/common-web/src/main/java/com/example/common/security/JsonSecurityHandlers.java` | Security (shared) |
| 20 | `common/common-web/src/main/java/com/example/common/security/JwtAuthenticationFilter.java` | Security (shared) |
| 21 | `common/common-web/src/main/java/com/example/common/security/JwtProperties.java` | Security (shared) |
| 22 | `common/common-web/src/main/java/com/example/common/security/JwtTokenService.java` | Security (shared) |
| 23 | `common/common-web/src/main/java/com/example/common/web/CorrelationIdFilter.java` | Web filter (shared) |
| 24 | `common/common-web/src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` | Auto-configuration registry |
| 25 | `common/event-contracts/pom.xml` | Maven build |
| 26 | `common/event-contracts/src/main/java/com/example/events/EnrollmentEvent.java` | Event contract |
| 27 | `common/event-contracts/src/main/java/com/example/events/EnrollmentEventType.java` | Event contract |
| 28 | `common/event-contracts/src/main/java/com/example/events/LowCourseAvailabilityEvent.java` | Event contract |
| 29 | `common/event-contracts/src/main/java/com/example/events/Topics.java` | Event contract |
| 30 | `docker-compose.yml` | Docker |
| 31 | `eureka-server/Dockerfile` | Docker |
| 32 | `eureka-server/pom.xml` | Maven build |
| 33 | `eureka-server/src/main/java/com/example/eureka/EurekaServerApplication.java` | Entry point (main) |
| 34 | `eureka-server/src/main/resources/application.yml` | Configuration |
| 35 | `kubernetes/00-namespace.yaml` | Kubernetes manifest |
| 36 | `kubernetes/01-configmap.yaml` | Kubernetes manifest |
| 37 | `kubernetes/02-mysql-external.yaml` | Kubernetes manifest |
| 38 | `kubernetes/03-secret.yaml` | Kubernetes manifest |
| 39 | `kubernetes/10-redis.yaml` | Kubernetes manifest |
| 40 | `kubernetes/11-kafka.yaml` | Kubernetes manifest |
| 41 | `kubernetes/20-eureka-server.yaml` | Kubernetes manifest |
| 42 | `kubernetes/30-student-service.yaml` | Kubernetes manifest |
| 43 | `kubernetes/31-course-service.yaml` | Kubernetes manifest |
| 44 | `kubernetes/32-enrollment-service.yaml` | Kubernetes manifest |
| 45 | `kubernetes/33-notification-service.yaml` | Kubernetes manifest |
| 46 | `kubernetes/40-api-gateway.yaml` | Kubernetes manifest |
| 47 | `kubernetes/kustomization.yaml` | Kubernetes manifest |
| 48 | `monitoring/grafana/dashboards/student-management.json` | Monitoring config |
| 49 | `monitoring/grafana/provisioning/dashboards/dashboards.yml` | Monitoring config |
| 50 | `monitoring/grafana/provisioning/datasources/prometheus.yml` | Monitoring config |
| 51 | `monitoring/prometheus/prometheus-host.yml` | Monitoring config |
| 52 | `monitoring/prometheus/prometheus.yml` | Monitoring config |
| 53 | `pom.xml` | Maven build |
| 54 | `scripts/e2e.py` | Script |
| 55 | `scripts/start-local.sh` | Script |
| 56 | `scripts/stop-local.sh` | Script |
| 57 | `scripts/verify-db.sh` | Script |
| 58 | `services/course-service/Dockerfile` | Docker |
| 59 | `services/course-service/pom.xml` | Maven build |
| 60 | `services/course-service/src/main/java/com/example/course/CourseServiceApplication.java` | Entry point (main) |
| 61 | `services/course-service/src/main/java/com/example/course/config/CacheConfig.java` | Configuration |
| 62 | `services/course-service/src/main/java/com/example/course/config/CourseCacheEvictor.java` | Configuration |
| 63 | `services/course-service/src/main/java/com/example/course/config/KafkaConfig.java` | Configuration |
| 64 | `services/course-service/src/main/java/com/example/course/config/SecurityConfig.java` | Configuration |
| 65 | `services/course-service/src/main/java/com/example/course/controller/CategoryController.java` | Controller |
| 66 | `services/course-service/src/main/java/com/example/course/controller/CourseController.java` | Controller |
| 67 | `services/course-service/src/main/java/com/example/course/dto/CategoryDtos.java` | DTO |
| 68 | `services/course-service/src/main/java/com/example/course/dto/CourseAvailabilityResponse.java` | DTO |
| 69 | `services/course-service/src/main/java/com/example/course/dto/CourseRequest.java` | DTO |
| 70 | `services/course-service/src/main/java/com/example/course/dto/CourseResponse.java` | DTO |
| 71 | `services/course-service/src/main/java/com/example/course/dto/SeatDtos.java` | DTO |
| 72 | `services/course-service/src/main/java/com/example/course/dto/StatusRequest.java` | DTO |
| 73 | `services/course-service/src/main/java/com/example/course/entity/Course.java` | Entity |
| 74 | `services/course-service/src/main/java/com/example/course/entity/CourseCategory.java` | Entity |
| 75 | `services/course-service/src/main/java/com/example/course/entity/CourseStatus.java` | Entity |
| 76 | `services/course-service/src/main/java/com/example/course/entity/ReservationStatus.java` | Entity |
| 77 | `services/course-service/src/main/java/com/example/course/entity/SeatReservation.java` | Entity |
| 78 | `services/course-service/src/main/java/com/example/course/mapper/CourseMapper.java` | Mapper |
| 79 | `services/course-service/src/main/java/com/example/course/repository/CourseCategoryRepository.java` | Repository |
| 80 | `services/course-service/src/main/java/com/example/course/repository/CourseRepository.java` | Repository |
| 81 | `services/course-service/src/main/java/com/example/course/repository/CourseSpecifications.java` | Repository |
| 82 | `services/course-service/src/main/java/com/example/course/repository/SeatReservationRepository.java` | Repository |
| 83 | `services/course-service/src/main/java/com/example/course/service/CategoryService.java` | Service |
| 84 | `services/course-service/src/main/java/com/example/course/service/CourseService.java` | Service |
| 85 | `services/course-service/src/main/java/com/example/course/service/LowAvailabilityPublisher.java` | Service |
| 86 | `services/course-service/src/main/java/com/example/course/service/SeatService.java` | Service |
| 87 | `services/course-service/src/main/java/com/example/course/validation/CourseCodeValidator.java` | Validation |
| 88 | `services/course-service/src/main/java/com/example/course/validation/ValidCourseCode.java` | Validation |
| 89 | `services/course-service/src/main/resources/application.yml` | Configuration |
| 90 | `services/course-service/src/main/resources/db/migration/V1__create_course_tables.sql` | Flyway migration |
| 91 | `services/enrollment-service/Dockerfile` | Docker |
| 92 | `services/enrollment-service/pom.xml` | Maven build |
| 93 | `services/enrollment-service/src/main/java/com/example/enrollment/EnrollmentServiceApplication.java` | Entry point (main) |
| 94 | `services/enrollment-service/src/main/java/com/example/enrollment/client/CourseClient.java` | Integration (Feign/Resilience4j) |
| 95 | `services/enrollment-service/src/main/java/com/example/enrollment/client/CourseGateway.java` | Integration (Feign/Resilience4j) |
| 96 | `services/enrollment-service/src/main/java/com/example/enrollment/client/FeignConfig.java` | Integration (Feign/Resilience4j) |
| 97 | `services/enrollment-service/src/main/java/com/example/enrollment/client/RemoteCall.java` | Integration (Feign/Resilience4j) |
| 98 | `services/enrollment-service/src/main/java/com/example/enrollment/client/RemoteDtos.java` | Integration (Feign/Resilience4j) |
| 99 | `services/enrollment-service/src/main/java/com/example/enrollment/client/RemoteExceptions.java` | Integration (Feign/Resilience4j) |
| 100 | `services/enrollment-service/src/main/java/com/example/enrollment/client/StudentClient.java` | Integration (Feign/Resilience4j) |
| 101 | `services/enrollment-service/src/main/java/com/example/enrollment/client/StudentGateway.java` | Integration (Feign/Resilience4j) |
| 102 | `services/enrollment-service/src/main/java/com/example/enrollment/client/TracingContextPropagator.java` | Integration (Feign/Resilience4j) |
| 103 | `services/enrollment-service/src/main/java/com/example/enrollment/command/CancelEnrollmentCommand.java` | CQRS command |
| 104 | `services/enrollment-service/src/main/java/com/example/enrollment/command/CancelEnrollmentCommandHandler.java` | CQRS command |
| 105 | `services/enrollment-service/src/main/java/com/example/enrollment/command/CreateEnrollmentCommand.java` | CQRS command |
| 106 | `services/enrollment-service/src/main/java/com/example/enrollment/command/CreateEnrollmentCommandHandler.java` | CQRS command |
| 107 | `services/enrollment-service/src/main/java/com/example/enrollment/command/EnrollmentOutcome.java` | CQRS command |
| 108 | `services/enrollment-service/src/main/java/com/example/enrollment/command/UpdateEnrollmentCommand.java` | CQRS command |
| 109 | `services/enrollment-service/src/main/java/com/example/enrollment/command/UpdateEnrollmentCommandHandler.java` | CQRS command |
| 110 | `services/enrollment-service/src/main/java/com/example/enrollment/config/KafkaConfig.java` | Configuration |
| 111 | `services/enrollment-service/src/main/java/com/example/enrollment/config/SecurityConfig.java` | Configuration |
| 112 | `services/enrollment-service/src/main/java/com/example/enrollment/controller/EnrollmentController.java` | Controller |
| 113 | `services/enrollment-service/src/main/java/com/example/enrollment/dto/CancelRequest.java` | DTO |
| 114 | `services/enrollment-service/src/main/java/com/example/enrollment/dto/EnrollmentRequest.java` | DTO |
| 115 | `services/enrollment-service/src/main/java/com/example/enrollment/dto/EnrollmentResponse.java` | DTO |
| 116 | `services/enrollment-service/src/main/java/com/example/enrollment/dto/EnrollmentUpdateRequest.java` | DTO |
| 117 | `services/enrollment-service/src/main/java/com/example/enrollment/entity/Enrollment.java` | Entity |
| 118 | `services/enrollment-service/src/main/java/com/example/enrollment/entity/EnrollmentStatus.java` | Entity |
| 119 | `services/enrollment-service/src/main/java/com/example/enrollment/entity/OutboxEvent.java` | Entity |
| 120 | `services/enrollment-service/src/main/java/com/example/enrollment/entity/OutboxStatus.java` | Entity |
| 121 | `services/enrollment-service/src/main/java/com/example/enrollment/entity/SagaInstance.java` | Entity |
| 122 | `services/enrollment-service/src/main/java/com/example/enrollment/entity/SagaState.java` | Entity |
| 123 | `services/enrollment-service/src/main/java/com/example/enrollment/event/EnrollmentEventRecorder.java` | Event recorder |
| 124 | `services/enrollment-service/src/main/java/com/example/enrollment/outbox/OutboxPublisher.java` | Outbox |
| 125 | `services/enrollment-service/src/main/java/com/example/enrollment/outbox/OutboxWriter.java` | Outbox |
| 126 | `services/enrollment-service/src/main/java/com/example/enrollment/query/EnrollmentQueries.java` | CQRS query |
| 127 | `services/enrollment-service/src/main/java/com/example/enrollment/query/EnrollmentQueryHandlers.java` | CQRS query |
| 128 | `services/enrollment-service/src/main/java/com/example/enrollment/query/EnrollmentSpecifications.java` | CQRS query |
| 129 | `services/enrollment-service/src/main/java/com/example/enrollment/repository/EnrollmentRepository.java` | Repository |
| 130 | `services/enrollment-service/src/main/java/com/example/enrollment/repository/OutboxEventRepository.java` | Repository |
| 131 | `services/enrollment-service/src/main/java/com/example/enrollment/repository/SagaInstanceRepository.java` | Repository |
| 132 | `services/enrollment-service/src/main/java/com/example/enrollment/saga/EnrollmentSagaOrchestrator.java` | Saga |
| 133 | `services/enrollment-service/src/main/java/com/example/enrollment/saga/SagaPausedException.java` | Saga |
| 134 | `services/enrollment-service/src/main/java/com/example/enrollment/saga/SagaRecoveryJob.java` | Saga |
| 135 | `services/enrollment-service/src/main/resources/application.yml` | Configuration |
| 136 | `services/enrollment-service/src/main/resources/db/migration/V1__create_enrollment_tables.sql` | Flyway migration |
| 137 | `services/notification-service/Dockerfile` | Docker |
| 138 | `services/notification-service/pom.xml` | Maven build |
| 139 | `services/notification-service/src/main/java/com/example/notification/NotificationServiceApplication.java` | Entry point (main) |
| 140 | `services/notification-service/src/main/java/com/example/notification/config/KafkaConfig.java` | Configuration |
| 141 | `services/notification-service/src/main/java/com/example/notification/config/SecurityConfig.java` | Configuration |
| 142 | `services/notification-service/src/main/java/com/example/notification/consumer/EventConsumers.java` | Kafka consumer |
| 143 | `services/notification-service/src/main/java/com/example/notification/controller/NotificationController.java` | Controller |
| 144 | `services/notification-service/src/main/java/com/example/notification/dto/NotificationResponse.java` | DTO |
| 145 | `services/notification-service/src/main/java/com/example/notification/entity/InboxMessage.java` | Entity |
| 146 | `services/notification-service/src/main/java/com/example/notification/entity/Notification.java` | Entity |
| 147 | `services/notification-service/src/main/java/com/example/notification/entity/NotificationStatus.java` | Entity |
| 148 | `services/notification-service/src/main/java/com/example/notification/entity/NotificationType.java` | Entity |
| 149 | `services/notification-service/src/main/java/com/example/notification/mapper/NotificationMapper.java` | Mapper |
| 150 | `services/notification-service/src/main/java/com/example/notification/processing/EmailSimulator.java` | Notification processing |
| 151 | `services/notification-service/src/main/java/com/example/notification/processing/NotificationDispatcher.java` | Notification processing |
| 152 | `services/notification-service/src/main/java/com/example/notification/processing/NotificationProcessor.java` | Notification processing |
| 153 | `services/notification-service/src/main/java/com/example/notification/repository/InboxMessageRepository.java` | Repository |
| 154 | `services/notification-service/src/main/java/com/example/notification/repository/NotificationRepository.java` | Repository |
| 155 | `services/notification-service/src/main/java/com/example/notification/service/NotificationIngestService.java` | Service |
| 156 | `services/notification-service/src/main/java/com/example/notification/service/NotificationQueryService.java` | Service |
| 157 | `services/notification-service/src/main/resources/application.yml` | Configuration |
| 158 | `services/notification-service/src/main/resources/db/migration/V1__create_notification_tables.sql` | Flyway migration |
| 159 | `services/student-service/Dockerfile` | Docker |
| 160 | `services/student-service/pom.xml` | Maven build |
| 161 | `services/student-service/src/main/java/com/example/student/StudentServiceApplication.java` | Entry point (main) |
| 162 | `services/student-service/src/main/java/com/example/student/config/AdminBootstrap.java` | Configuration |
| 163 | `services/student-service/src/main/java/com/example/student/config/CacheConfig.java` | Configuration |
| 164 | `services/student-service/src/main/java/com/example/student/config/SecurityConfig.java` | Configuration |
| 165 | `services/student-service/src/main/java/com/example/student/controller/AuthController.java` | Controller |
| 166 | `services/student-service/src/main/java/com/example/student/controller/StudentController.java` | Controller |
| 167 | `services/student-service/src/main/java/com/example/student/dto/AuthDtos.java` | DTO |
| 168 | `services/student-service/src/main/java/com/example/student/dto/EligibilityResponse.java` | DTO |
| 169 | `services/student-service/src/main/java/com/example/student/dto/StatusUpdateRequest.java` | DTO |
| 170 | `services/student-service/src/main/java/com/example/student/dto/StudentRequest.java` | DTO |
| 171 | `services/student-service/src/main/java/com/example/student/dto/StudentResponse.java` | DTO |
| 172 | `services/student-service/src/main/java/com/example/student/entity/Gender.java` | Entity |
| 173 | `services/student-service/src/main/java/com/example/student/entity/RefreshToken.java` | Entity |
| 174 | `services/student-service/src/main/java/com/example/student/entity/Role.java` | Entity |
| 175 | `services/student-service/src/main/java/com/example/student/entity/Student.java` | Entity |
| 176 | `services/student-service/src/main/java/com/example/student/entity/StudentStatus.java` | Entity |
| 177 | `services/student-service/src/main/java/com/example/student/entity/UserAccount.java` | Entity |
| 178 | `services/student-service/src/main/java/com/example/student/mapper/StudentMapper.java` | Mapper |
| 179 | `services/student-service/src/main/java/com/example/student/repository/RefreshTokenRepository.java` | Repository |
| 180 | `services/student-service/src/main/java/com/example/student/repository/StudentRepository.java` | Repository |
| 181 | `services/student-service/src/main/java/com/example/student/repository/StudentSpecifications.java` | Repository |
| 182 | `services/student-service/src/main/java/com/example/student/repository/UserAccountRepository.java` | Repository |
| 183 | `services/student-service/src/main/java/com/example/student/service/AuthService.java` | Service |
| 184 | `services/student-service/src/main/java/com/example/student/service/StudentService.java` | Service |
| 185 | `services/student-service/src/main/java/com/example/student/validation/PhoneNumberValidator.java` | Validation |
| 186 | `services/student-service/src/main/java/com/example/student/validation/ValidPhoneNumber.java` | Validation |
| 187 | `services/student-service/src/main/resources/application.yml` | Configuration |
| 188 | `services/student-service/src/main/resources/db/migration/V1__create_student_and_auth_tables.sql` | Flyway migration |
| 189 | `services/student-service/src/main/resources/db/migration/V2__user_deleted_with_student.sql` | Flyway migration |

Total indexed files: **189**. Test sources (`src/test/**`) are intentionally excluded.

