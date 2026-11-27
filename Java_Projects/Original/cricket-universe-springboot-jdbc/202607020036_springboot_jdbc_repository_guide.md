# Cricket Universe — Spring Boot REST API (JdbcTemplate, No JPA)

A beginner-friendly walkthrough of how this application was built: a Spring
Boot REST API on top of the existing `cricket_universe` MySQL database, using
the Repository Pattern **without Spring Data JPA**, plus CORS, Log4j2
logging, centralised exception handling, and a JUnit5/Mockito test suite.

Project location: `Documents/Java_Projects/cricket-universe-springboot-jdbc`

---

## 1. Where this fits in the series

This is the **fifth** cricket_universe Java application built in this
workspace:

| Project | Stack |
|---|---|
| `cricket-universe-jdbc` | Plain Java + raw JDBC |
| `cricket-universe-servlet` | JDBC + Servlets (embedded Tomcat) |
| `cricket-universe-repo` | Repository Pattern + REST API + JDBC + Servlets |
| `cricket-universe-springboot` | Spring Boot + **Spring Data JPA** + Repository Pattern |
| **`cricket-universe-springboot-jdbc`** (this one) | Spring Boot + Repository Pattern using **plain `JdbcTemplate`, no JPA** |

The previous Spring Boot project let Spring Data JPA generate most of the
data-access code from interface method names. This project deliberately
removes JPA/Hibernate from the classpath entirely and hand-writes every SQL
statement, to show what the Repository Pattern looks like when you own 100%
of the data-access code yourself, inside a Spring Boot application.

---

## 2. Why "no JPA" changes the design

Without Spring Data JPA there is no `@Entity`, no `@Id`, no
`JpaRepository<T, ID>`, and — crucially — **no framework-generated SQL**.
Every repository interface still exists (the Repository Pattern doesn't go
away), but every implementation is a plain class built on Spring's
`JdbcTemplate`, using hand-written SQL with `RowMapper<T>` to turn a
`ResultSet` row into a Java object:

```java
private static final RowMapper<Country> ROW_MAPPER = (rs, rowNum) -> {
    Country c = new Country();
    c.setId(rs.getString("id"));
    c.setName(rs.getString("name"));
    ...
    return c;
};

@Override
public List<Country> findAll() {
    return jdbcTemplate.query("SELECT * FROM countries ORDER BY name", ROW_MAPPER);
}
```

The layering is identical to every other project in this series:

```
Controller  ->  Service  ->  Repository  ->  Database
 (HTTP)        (business)     (data access)   (MySQL)
```

What changed is *who writes the SQL inside the Repository layer*. In the JPA
version, Spring Data wrote it for you from a method name like
`findByCountryId`. Here, `LeagueRepositoryImpl` writes it explicitly:

```java
@Override
public List<League> findByCountryId(String countryId) {
    return jdbcTemplate.query(
            "SELECT * FROM leagues WHERE country_id = ? ORDER BY name", ROW_MAPPER, countryId);
}
```

Both approaches satisfy the Repository Pattern — the Service layer calls
`leagueRepository.findByCountryId(id)` either way and has no idea which
implementation style sits behind the interface.

---

## 3. Project layout

```
cricket-universe-springboot-jdbc/
├── pom.xml
├── src/main/resources/
│   ├── application.properties     # DB URL/user/password (externalised)
│   └── log4j2.xml                 # Log4j2 configuration
└── src/main/java/com/cricket/
    ├── CricketUniverseApplication.java
    ├── config/
    │   ├── CorsConfig.java             # global CORS policy
    │   └── RequestLoggingFilter.java   # logs every request via Log4j2
    ├── model/                          # plain POJOs — no JPA annotations at all
    │   ├── Country.java, League.java, Team.java, Cricketer.java, LoginUser.java
    │   └── AuditCountry.java, AuditLeague.java, AuditTeam.java, AuditCricketer.java
    ├── repository/                     # interfaces only
    │   ├── CountryRepository.java ... AuditRepository.java, ViewRepository.java,
    │   │   ProcedureRepository.java, FunctionRepository.java
    │   └── impl/                       # JdbcTemplate implementations, hand-written SQL
    ├── service/                        # business layer, 9 services (Log4j2 logging)
    ├── controller/                     # @RestController classes, 9 controllers
    └── exception/
        ├── ResourceNotFoundException.java
        └── GlobalExceptionHandler.java # @RestControllerAdvice, logs every failure

src/test/java/com/cricket/
    ├── service/          # CountryServiceTest, LeagueServiceTest, CricketerServiceTest
    ├── controller/       # CountryControllerTest (MockMvc, no real DB)
    ├── exception/        # GlobalExceptionHandlerTest
    └── repository/       # ProcedureRepositoryImplTest (mocked JDBC objects)
```

---

## 4. Database objects and how each is exposed

Same DB coverage as the JPA version — every table, view, procedure, and
function in `cricket_universe` is reachable through the API.

### 4.1 Tables (full CRUD via hand-written JdbcTemplate SQL)

| Table | Model | Endpoint |
|---|---|---|
| `countries` | `Country` | `/api/countries` |
| `leagues` | `League` | `/api/leagues` |
| `teams` | `Team` | `/api/teams` |
| `cricketers` | `Cricketer` | `/api/cricketers` |
| `loginusers` | `LoginUser` | `/api/login-users` (read-only) |

```
GET    /api/{resource}            list (optional ?search=, ?countryId=, etc.)
GET    /api/{resource}/{id}       single record
POST   /api/{resource}            create
PUT    /api/{resource}/{id}       update
DELETE /api/{resource}/{id}       delete
```

### 4.2 Audit tables (read-only, one combined repository)

`audit_countries`, `audit_leagues`, `audit_teams`, `audit_cricketers` are
populated exclusively by MySQL **triggers**. Since there's no JPA forcing
one-repository-per-entity, all four share a single `AuditRepository` with one
method per table — simpler than four near-identical interfaces:

```
GET /api/audit/countries   ?recordId=ind
GET /api/audit/leagues     ?recordId=ipl
GET /api/audit/teams       ?recordId=csk
GET /api/audit/cricketers  ?recordId=virat-kohli
```

### 4.3 Views

```
GET /api/views/countries-leagues   → v_countries_leagues
GET /api/views/teams-players       → v_teams_players
GET /api/views/all-players         → v_all_players_detail
```

### 4.4 Stored procedures

All 8 procedures are called via `CallableStatement`. `sp_analytics_demo` (8
SELECTs) and `sp_window_functions_demo` (5 SELECTs) each return multiple
result sets in one call — handled with `CallableStatement.getMoreResults()`
and labelled sections:

```
GET /api/procedures/list-countries        ?search=
GET /api/procedures/list-leagues          ?countryId=&search=
GET /api/procedures/list-teams            ?leagueId=
GET /api/procedures/list-players          ?teamId=&role=
GET /api/procedures/all-players-detail    ?countryId=&role=
GET /api/procedures/cursor-role-totals
GET /api/procedures/window-functions      (5 labelled sections)
GET /api/procedures/analytics             (8 labelled sections)
```

### 4.5 Functions (UDFs)

```
GET /api/functions/batting-average  ?runs=850&matches=20
GET /api/functions/player-grade     ?runs=500&wickets=10&role=Allrounder
GET /api/functions/player-label     ?name=&role=&team=
GET /api/functions/all-players          (UDFs applied inline to every cricketer row)
```

---

## 5. CORS

Identical global policy to the JPA project, applied to `/api/**`:

```java
@Configuration
public class CorsConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOriginPatterns("*")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(false)
                .maxAge(3600);
    }
}
```

Verified both with a real curl preflight request against the running app and
with a `@WebMvcTest` MockMvc test (`CountryControllerTest.corsPreflight_isAllowedOnApiPath`).

---

## 6. Logging with Log4j2

Spring Boot defaults to Logback. To use Log4j2 instead, the default logging
starter is excluded and the Log4j2 starter is added in `pom.xml`:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
    <exclusions>
        <exclusion>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-logging</artifactId>
        </exclusion>
    </exclusions>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-log4j2</artifactId>
</dependency>
```

(The same exclusion is repeated on `spring-boot-starter-test`, because it
also transitively pulls in Logback — without excluding it there, the test
classpath ends up with two competing logging backends.)

`log4j2.xml` configures two appenders — console and a size/time-based rolling
file under `logs/` — and sets `com.cricket` to `DEBUG` while keeping
`org.springframework` at `INFO`:

```xml
<Logger name="com.cricket" level="DEBUG" additivity="false">
    <AppenderRef ref="Console"/>
    <AppenderRef ref="RollingFile"/>
</Logger>
```

Three things get logged automatically:

1. **Every HTTP request** — `RequestLoggingFilter` (a `OncePerRequestFilter`)
   logs method, URI, status code, and duration for every call:
   ```
   POST /api/countries -> 201 (307 ms)
   ```
2. **Every service-layer mutation** — `CountryService`, `LeagueService`, etc.
   log at `INFO` when something is created/updated/deleted, and at `DEBUG`
   for searches.
3. **Every handled exception** — `GlobalExceptionHandler` logs a `WARN` for
   client errors (404, 400) and an `ERROR` (with stack trace) for 409/500s,
   so failures are visible in `logs/cricket-universe-springboot-jdbc.log`
   even if nobody was watching the console at the time.

This was verified by tailing the log file after exercising the API and
confirming request/response lines, service-level INFO logs, and (in tests)
the WARN/ERROR lines from `GlobalExceptionHandlerTest` all appeared.

---

## 7. `application.properties` — externalised DB configuration

```properties
spring.datasource.url=jdbc:mysql://${DB_HOST:localhost}:${DB_PORT:3306}/${DB_NAME:cricket_universe}?useSSL=false&serverTimezone=UTC&...
spring.datasource.username=${DB_USERNAME:abhig}
spring.datasource.password=${DB_PASSWORD:Pass@123}
logging.config=classpath:log4j2.xml
```

Every DB value can be overridden by an environment variable at deploy time —
`${DB_PASSWORD:Pass@123}` means "use env var `DB_PASSWORD` if set, otherwise
fall back to the default". No secret is hard-coded in a `.java` file.

---

## 8. `loginusers` — why it's read-only

Same reasoning as the JPA version: this is a data API for the cricket
domain, not an authentication service. `LoginUserController` only exposes
`GET` endpoints, and `LoginUser.java` marks the sensitive columns
`@JsonIgnore` so they never appear in a response even though the
`RowMapper` does read them off the `ResultSet` (needed internally, just
never serialised):

```java
@JsonIgnore
private String passwordHash;

@JsonIgnore
private String refreshTokenHash;
```

---

## 9. Error handling

`GlobalExceptionHandler` (`@RestControllerAdvice`) converts exceptions into a
consistent JSON body and logs each one via Log4j2:

| Exception | HTTP status |
|---|---|
| `ResourceNotFoundException` | 404 |
| `MethodArgumentNotValidException` (bean validation) | 400 |
| `IllegalArgumentException` (e.g. duplicate id on create) | 400 |
| `DataIntegrityViolationException` (FK/unique constraint) | 409 |
| anything else | 500 |

Example:
```json
{
  "timestamp": "2026-07-02T00:33:13.763106831",
  "status": 400,
  "error": "Bad Request",
  "message": "Country already exists: tst"
}
```

**A real bug this caught during development:** `Country`'s `id` field was
initially annotated `@NotBlank`. On `PUT /api/countries/{id}`, the id comes
from the URL path — clients correctly don't repeat it in the JSON body — so
every update request failed bean validation with `id: must not be blank`.
This was caught by manually exercising the running API (not just the unit
tests, which mocked the repository and never hit real validation), and fixed
by removing `@NotBlank` from `id` on all four models (`Country`, `League`,
`Team`, `Cricketer`) while keeping `@Size` for length safety. This is a good
example of why "the code compiles and unit tests pass" is not the same as
"the feature works" — only calling the real endpoint end-to-end surfaced it.

---

## 10. Testing (JUnit 5 + Mockito)

`spring-boot-starter-test` brings JUnit 5, Mockito, and AssertJ. Four kinds
of test are included, each targeting a different layer:

**Service layer — pure Mockito, no Spring context at all:**
```java
@ExtendWith(MockitoExtension.class)
class CountryServiceTest {
    @Mock private CountryRepository countryRepository;
    @InjectMocks private CountryService countryService;

    @Test
    void findById_whenMissing_throwsResourceNotFound() {
        when(countryRepository.findById("xyz")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> countryService.findById("xyz"))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}
```
This is fast (no Spring, no DB) and tests the actual branching logic in the
service (which finder to call, when to throw, when to guard against
duplicates).

**Controller layer — `@WebMvcTest` + MockMvc, no real DB:**
```java
@WebMvcTest(CountryController.class)
class CountryControllerTest {
    @Autowired private MockMvc mockMvc;
    @MockBean private CountryService countryService;

    @Test
    void getById_whenMissing_returns404WithJsonBody() throws Exception {
        when(countryService.findById("xyz")).thenThrow(new ResourceNotFoundException("..."));
        mockMvc.perform(get("/api/countries/xyz")).andExpect(status().isNotFound());
    }
}
```
`@WebMvcTest` loads only the web layer — controllers, `@ControllerAdvice`,
`WebMvcConfigurer` beans (so `CorsConfig` is active), and `Filter` beans (so
`RequestLoggingFilter` runs) — without connecting to MySQL. This is what
proves the CORS headers, validation wiring, and exception-to-JSON mapping
all work together as a unit.

**Exception handler — plain unit test, no mocking needed at all:**
```java
class GlobalExceptionHandlerTest {
    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void resourceNotFound_mapsTo404() {
        var response = handler.handleNotFound(new ResourceNotFoundException("..."));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }
}
```

**Repository layer — mocking the JDBC driver itself:**

This is the part that can't use `@DataJpaTest` (there's no JPA) and is the
riskiest hand-written code in the project — raw `CallableStatement` handling
with a manual `getMoreResults()` loop. `ProcedureRepositoryImplTest` mocks
`Connection`, `CallableStatement`, `ResultSet`, and `ResultSetMetaData`
directly to prove:
- a blank search parameter is bound with `setNull(1, Types.VARCHAR)`,
  not skipped or turned into an empty string,
- a real search term is bound with `setString`, never concatenated,
- the multi-result-set loop keeps calling `getMoreResults()` until it
  returns `false`, and labels each section correctly.

```java
doAnswer(invocation -> {
    ConnectionCallback<Object> callback = invocation.getArgument(0);
    return callback.doInConnection(connection);
}).when(jdbcTemplate).execute(any(ConnectionCallback.class));
```

Total: **27 tests**, all passing, run automatically as part of `mvn package`.

---

## 11. How SQL injection is prevented

Exactly the same principle as the JPA project, applied consistently across
every hand-written SQL statement in this codebase: **user input is always
sent to MySQL as a bound parameter, never spliced into the SQL text.**

**1. JdbcTemplate `?` placeholders (all CRUD repositories):**
```java
jdbcTemplate.query(
        "SELECT * FROM countries WHERE name LIKE ? OR short_name LIKE ? OR board LIKE ? ORDER BY name",
        ROW_MAPPER, like, like, like);
```
The SQL string is a fixed literal written by the developer. `like` (built
from the caller's search term) is passed as a separate argument — JdbcTemplate
binds it through a `PreparedStatement`, so it can never be interpreted as SQL
syntax no matter what characters it contains.

**2. `queryForObject` for scalar UDF calls:**
```java
jdbcTemplate.queryForObject("SELECT fn_batting_average(?, ?)", BigDecimal.class, runs, matches);
```

**3. `CallableStatement` for stored procedures:**
```java
try (CallableStatement cs = con.prepareCall(call)) {
    if (value == null || value.isBlank()) {
        cs.setNull(i + 1, Types.VARCHAR);
    } else {
        cs.setString(i + 1, value);
    }
}
```
The procedure name (`call`) is always a fixed string written by the
developer — never built from a request parameter. Every argument is bound
with `setString`/`setNull`, the same safe mechanism `PreparedStatement` uses.

**This was verified against the live database, not just asserted.** With the
app running, two live attacks were sent:

```bash
curl -G http://localhost:8083/api/countries \
     --data-urlencode "search=' OR '1'='1"
# -> []   (treated as a literal search string, not SQL)

curl -G http://localhost:8083/api/procedures/list-countries \
     --data-urlencode "search=x'; DROP TABLE countries; --"
# -> []   (same — treated as a literal string)
```

After both requests, `SELECT COUNT(*) FROM countries` in MySQL still
returned `7` — completely unaffected. Had any repository method built its
SQL with string concatenation (`"... WHERE name = '" + term + "'"`) instead
of a `?` placeholder, the second request would have dropped the table.

**The rule that makes this work, everywhere in this codebase:** never build
a SQL string with `+`, `String.format`, or a text block containing raw user
input. Every single data-access call — CRUD, views, functions, procedures —
goes through a `?` placeholder bound by JdbcTemplate or a
`CallableStatement`.

---

## 12. How the build was verified

```bash
cd Documents/Java_Projects/cricket-universe-springboot-jdbc
mvn clean package        # runs all 27 tests, then BUILD SUCCESS
java -jar target/cricket-universe-springboot-jdbc.jar
```

With the app running on port `8083`, every category of endpoint was
exercised against the real `cricket_universe` database:

- Full CRUD lifecycle on `/api/countries` (create → duplicate-id rejected
  with 400 → update → delete → confirm gone with 404)
- All 3 views, all 8 procedures (including the two multi-result-set ones,
  confirmed by section keys and row counts), all 3 functions
- `loginusers` confirmed to never leak `passwordHash`/`refreshTokenHash`
- CORS preflight headers
- The Log4j2 rolling log file confirmed to contain request logs, service
  logs, and (via the exception-handler tests) warning/error logs
- The two SQL-injection attempts described in §11

---

## 13. Running it yourself

```bash
cd Documents/Java_Projects/cricket-universe-springboot-jdbc

# Option A: defaults baked into application.properties
mvn spring-boot:run

# Option B: override DB credentials via environment variables
export DB_USERNAME=your_user
export DB_PASSWORD=your_password
mvn spring-boot:run

# Or run the packaged jar (tests run automatically during package)
mvn clean package
java -jar target/cricket-universe-springboot-jdbc.jar
```

The API listens on `http://localhost:8083/api/...` — port `8083`, chosen to
avoid clashing with `cricket-universe-repo` (`8081`) and
`cricket-universe-springboot` (`8082`).

---

## 14. Key takeaways for a beginner

1. **The Repository Pattern doesn't require an ORM.** An interface plus a
   `JdbcTemplate`-backed implementation is just as valid a Repository as a
   Spring Data JPA interface — the Service layer can't tell the difference,
   and shouldn't need to.
2. **Removing a framework means writing more code, not less safety.**
   Without JPA generating parameterised queries automatically, every
   hand-written SQL string had to be deliberately built with `?`
   placeholders. The discipline is the same; there's just no framework
   enforcing it for you.
3. **Log everything that changes state, and everything that fails.** A
   request-logging filter plus service-level logging plus exception-handler
   logging means a production incident can be diagnosed from
   `logs/*.log` alone, without reproducing the bug live.
4. **Manually exercising the running app catches bugs unit tests miss.**
   The `@NotBlank id` bug (§9) passed every mocked unit test — the mock
   never validated anything — and only showed up once a real `PUT` request
   with real bean validation ran end-to-end.
5. **Mocking the JDBC driver directly is worth it for hand-written SQL.**
   `ProcedureRepositoryImplTest` is the one test class here that couldn't
   exist in the JPA version of this project, because that version had no
   hand-written `CallableStatement` loop to test in the first place.
