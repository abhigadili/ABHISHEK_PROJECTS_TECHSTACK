# Cricket Universe — Spring Boot REST API (Repository Pattern)

A beginner-friendly walkthrough of how this application was built: a Spring Boot
REST API on top of the existing `cricket_universe` MySQL database, using the
Repository Pattern, Spring Data JPA, CORS, and full coverage of every table,
view, stored procedure and function in the schema.

Project location: `Documents/Java_Projects/cricket-universe-springboot`

---

## 1. Where this fits in the series

This is the **fourth** cricket_universe Java application built in this workspace,
and each one intentionally uses a different architecture so the same problem can
be compared side by side:

| Project | Stack |
|---|---|
| `cricket-universe-jdbc` | Plain Java + raw JDBC |
| `cricket-universe-servlet` | JDBC + Servlets (embedded Tomcat) |
| `cricket-universe-repo` | Repository Pattern + REST API + JDBC + Servlets |
| **`cricket-universe-springboot`** (this one) | **Spring Boot + Spring Data JPA + Repository Pattern + REST API** |

The earlier `cricket-universe-repo` project proved the Repository Pattern by
hand-writing everything (Tomcat bootstrap, servlets, JDBC connection pooling).
This project shows what changes when you let a framework — Spring Boot — take
over that plumbing, while still applying the same architectural principle.

---

## 2. What "Repository Pattern" means here

The Repository Pattern says: **business logic should never talk to the database
directly.** Instead, every layer only knows about the layer directly below it:

```
Controller  ->  Service  ->  Repository  ->  Database
 (HTTP)        (business)     (data access)   (MySQL)
```

A `Controller` never writes SQL. A `Service` never opens a `Connection`. All
data access — whether it's a simple `SELECT * FROM countries` or a stored
procedure call — is hidden behind a `Repository` interface. If the database
technology changed tomorrow (MySQL to Postgres, or JPA to plain JDBC), only the
Repository implementations would need to change; Controllers and Services
would not notice.

This project actually needs **two different kinds of Repository**, because not
everything in `cricket_universe` fits the same shape:

1. **Spring Data JPA repositories** — for the 9 plain tables (`countries`,
   `leagues`, `teams`, `cricketers`, `loginusers`, and the 4 `audit_*` tables).
   These are simple `interface XyzRepository extends JpaRepository<Entity, Id>`
   declarations — Spring generates the implementation at startup. No SQL is
   written by hand for these at all.

2. **Custom JDBC-backed repositories** — for the 3 SQL views, 8 stored
   procedures, and 3 user-defined functions. JPA has no clean way to map a
   view without a stable primary key, call a stored procedure that returns
   *multiple* result sets, or call a scalar SQL function inline. For these,
   an interface (`ViewRepository`, `ProcedureRepository`, `FunctionRepository`)
   is still defined, but its implementation uses Spring's `JdbcTemplate`
   under the hood. Services depend only on the interface, exactly like the
   JPA case — they have no idea whether a `List<Map<String,Object>>` came
   from JPA or from a `CallableStatement`.

This is the same pattern used in `cricket-universe-repo`, just implemented with
framework help instead of hand-rolled JDBC.

---

## 3. Project layout

```
cricket-universe-springboot/
├── pom.xml
├── src/main/resources/
│   └── application.properties        # DB URL/user/password (externalised)
└── src/main/java/com/cricket/
    ├── CricketUniverseApplication.java   # main() — Spring Boot entry point
    ├── config/
    │   └── CorsConfig.java               # global CORS policy
    ├── entity/                           # @Entity classes — one per table
    │   ├── Country.java, League.java, Team.java, Cricketer.java, LoginUser.java
    │   └── AuditCountry.java, AuditLeague.java, AuditTeam.java, AuditCricketer.java
    ├── repository/                       # interfaces only
    │   ├── CountryRepository.java ... (Spring Data JPA, 9 interfaces)
    │   ├── ViewRepository.java
    │   ├── ProcedureRepository.java
    │   ├── FunctionRepository.java
    │   └── impl/                         # hand-written implementations
    │       ├── ViewRepositoryImpl.java
    │       ├── ProcedureRepositoryImpl.java
    │       └── FunctionRepositoryImpl.java
    ├── service/                          # business layer, 9 services
    ├── controller/                       # @RestController classes, 9 controllers
    └── exception/
        ├── ResourceNotFoundException.java
        └── GlobalExceptionHandler.java   # @RestControllerAdvice
```

---

## 4. Database objects and how each is exposed

### 4.1 Tables (full CRUD via Spring Data JPA)

| Table | Entity | Endpoint |
|---|---|---|
| `countries` | `Country` | `/api/countries` |
| `leagues` | `League` | `/api/leagues` |
| `teams` | `Team` | `/api/teams` |
| `cricketers` | `Cricketer` | `/api/cricketers` |
| `loginusers` | `LoginUser` | `/api/login-users` (read-only — see §6) |

Each of the four core resources supports the standard REST verbs:

```
GET    /api/{resource}            list (optional ?search=, ?countryId=, etc.)
GET    /api/{resource}/{id}       single record
POST   /api/{resource}            create
PUT    /api/{resource}/{id}       update
DELETE /api/{resource}/{id}       delete
```

For example:
```
GET /api/countries?search=india
GET /api/leagues?countryId=ind&search=ipl
GET /api/teams?leagueId=ipl
GET /api/cricketers?teamId=csk&role=Batsman
```

### 4.2 Audit tables (read-only)

`audit_countries`, `audit_leagues`, `audit_teams`, `audit_cricketers` are
populated exclusively by MySQL **triggers** whenever a row in the matching
core table is inserted, updated, or deleted — the application never writes to
them. They're exposed read-only for traceability:

```
GET /api/audit/countries   ?recordId=ind
GET /api/audit/leagues     ?recordId=ipl
GET /api/audit/teams       ?recordId=csk
GET /api/audit/cricketers  ?recordId=virat-kohli
```

### 4.3 Views

Views are handled by `ViewRepository`/`ViewRepositoryImpl` (JdbcTemplate),
not JPA, because a view row has no reliable single primary key to map an
`@Id` to.

```
GET /api/views/countries-leagues   → v_countries_leagues
GET /api/views/teams-players       → v_teams_players
GET /api/views/all-players         → v_all_players_detail
```

### 4.4 Stored procedures

All 8 procedures are called via `CallableStatement` inside
`ProcedureRepositoryImpl`. Two of them — `sp_analytics_demo` (8 SELECTs) and
`sp_window_functions_demo` (5 SELECTs) — each return **multiple result sets**
in one call. JPA has no support for this at all, which is the main reason a
custom repository exists. The implementation loops with
`CallableStatement.getMoreResults()` and labels each result set so the JSON
response is self-describing instead of an anonymous array-of-arrays:

```
GET /api/procedures/list-countries        ?search=
GET /api/procedures/list-leagues          ?countryId=&search=
GET /api/procedures/list-teams            ?leagueId=
GET /api/procedures/list-players          ?teamId=&role=
GET /api/procedures/all-players-detail    ?countryId=&role=
GET /api/procedures/cursor-role-totals        (cursor + temp table demo)
GET /api/procedures/window-functions          (5 labelled sections)
GET /api/procedures/analytics                 (8 labelled sections)
```

Example response shape for the multi-result-set endpoints:
```json
{
  "rankingWithinTeam": [ {"name": "...", "run_rank": 1, ...} ],
  "cumulativeRunsByCountry": [ ... ],
  "teamTitleQuartiles": [ ... ],
  "lagLeadRuns": [ ... ],
  "firstLastValueByLeague": [ ... ]
}
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

A single global CORS configuration (`config/CorsConfig.java`) applies to the
whole `/api/**` surface, so a separately hosted front-end (e.g. a React app on
a different port/origin) can call this API without every controller needing
its own `@CrossOrigin` annotation:

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

This was verified with a real preflight request:
```
curl -i -X OPTIONS http://localhost:8082/api/countries \
     -H "Origin: http://example.com" -H "Access-Control-Request-Method: GET"

Access-Control-Allow-Origin: http://example.com
Access-Control-Allow-Methods: GET,POST,PUT,DELETE,PATCH,OPTIONS
```

---

## 6. `loginusers` — why it's read-only

The `loginusers` table stores `password_hash` and `refresh_token_hash`. This
project is a data API for the cricket domain, not an authentication service,
so:

- `LoginUserController` only exposes `GET` endpoints (list / get-by-id) — no
  create/update/delete.
- `LoginUser.java` marks the sensitive columns `@JsonIgnore`, so even the
  read-only responses never include a password hash or refresh-token hash:

```java
@JsonIgnore
@Column(name = "password_hash", length = 255, nullable = false)
private String passwordHash;
```

This was confirmed by calling `GET /api/login-users` and checking the JSON —
`passwordHash` and `refreshTokenHash` never appear in the output.

---

## 7. `application.properties` — externalised DB configuration

Following the feedback from the previous project, all DB secrets and
connection details live in `application.properties`, not hard-coded Java —
and every value can be overridden by an environment variable at deploy time:

```properties
spring.datasource.url=jdbc:mysql://${DB_HOST:localhost}:${DB_PORT:3306}/${DB_NAME:cricket_universe}?useSSL=false&serverTimezone=UTC&...
spring.datasource.username=${DB_USERNAME:abhig}
spring.datasource.password=${DB_PASSWORD:Pass@123}
```

`${DB_USERNAME:abhig}` means "use the `DB_USERNAME` environment variable if
set, otherwise fall back to `abhig`". In a real deployment you would set
`DB_PASSWORD` as a secret via your platform (Docker secret, Kubernetes secret,
CI/CD variable) and never commit an actual production password to source
control.

`spring.jpa.hibernate.ddl-auto=none` is set deliberately — the schema already
exists (managed by hand-written SQL scripts, including a `JSON` column and
strict `ENUM` columns) and Hibernate must never be allowed to alter it.

---

## 8. How SQL injection is prevented

SQL injection happens when user input is concatenated directly into a SQL
string, letting an attacker change the meaning of the query (e.g. turning a
`WHERE name = 'x'` into `WHERE name = '' OR '1'='1'` to bypass a filter, or
appending a second statement like `; DROP TABLE countries; --`).

This application never builds SQL by string concatenation anywhere. Three
different layers all rely on **parameter binding** instead, meaning user
input is always sent to MySQL as a separate, typed value — never as part of
the SQL text itself:

**1. Spring Data JPA derived queries** (`CountryRepository`, `LeagueRepository`, etc.)

```java
List<Country> findByNameContainingIgnoreCaseOrShortNameContainingIgnoreCaseOrBoardContainingIgnoreCase(
        String name, String shortName, String board);
```

Spring Data generates a `PreparedStatement` with `?` placeholders from this
method signature at startup — the `search` string a caller supplies can never
be interpreted as SQL syntax, no matter what characters it contains.

**2. JdbcTemplate for views and functions** (`ViewRepositoryImpl`, `FunctionRepositoryImpl`)

```java
jdbcTemplate.queryForObject(
        "SELECT fn_batting_average(?, ?)", BigDecimal.class, runs, matches);
```

The `?` placeholders are bound by JdbcTemplate through a `PreparedStatement`
under the hood. `runs` and `matches` are passed as `int` values, so they
can't inject arbitrary text at all.

**3. CallableStatement for stored procedures** (`ProcedureRepositoryImpl`)

```java
try (CallableStatement cs = con.prepareCall("{CALL sp_list_countries(?)}")) {
    if (value == null || value.isBlank()) {
        cs.setNull(1, Types.VARCHAR);
    } else {
        cs.setString(1, value);
    }
    ...
}
```

The procedure name itself is a fixed string written by the developer, never
built from user input. Every parameter is bound with `setString`/`setNull` on
a `CallableStatement`, which uses the same safe binding mechanism as
`PreparedStatement`.

**This was verified, not just assumed.** Two live attacks were sent against
the running application:

```bash
curl -G http://localhost:8082/api/countries \
     --data-urlencode "search=' OR '1'='1"
# -> []   (treated as a literal search string that matches nothing, not as SQL)

curl -G http://localhost:8082/api/procedures/list-countries \
     --data-urlencode "search=x'; DROP TABLE countries; --"
# -> []   (same — treated as a literal string)
```

After both requests, `SELECT COUNT(*) FROM countries` in MySQL still returned
`7` — the table was completely unaffected. If the code had used string
concatenation instead of bound parameters, the second request would have
dropped the `countries` table.

**The one rule that makes this all work:** never build a SQL string with
`+`, `String.format`, or text blocks containing raw user input. Always let
JPA, JdbcTemplate, or a prepared/callable statement's placeholder mechanism
carry the value across to the database.

---

## 9. Error handling

`GlobalExceptionHandler` (`@RestControllerAdvice`) converts exceptions into a
consistent JSON body instead of an HTML stack trace, so every failure mode
looks the same to a client:

| Exception | HTTP status | Example |
|---|---|---|
| `ResourceNotFoundException` | 404 | `GET /api/countries/doesnotexist` |
| `MethodArgumentNotValidException` (bean validation) | 400 | `POST /api/countries` with no `name` |
| `DataIntegrityViolationException` | 409 | creating a league with a non-existent `countryId` |
| anything else | 500 | unexpected errors |

Example (verified against the running app):
```json
{
  "timestamp": "2026-07-02T00:12:28.082269736",
  "status": 404,
  "error": "Not Found",
  "message": "Country not found: doesnotexist"
}
```

---

## 10. How the build was verified

```bash
cd Documents/Java_Projects/cricket-universe-springboot
mvn clean package -DskipTests        # BUILD SUCCESS
java -jar target/cricket-universe-springboot.jar
```

With the app running on port `8082`, every category of endpoint was exercised
against the real `cricket_universe` database:

- Full CRUD lifecycle on `/api/countries` (create → update → delete → confirm gone)
- List/filter endpoints on leagues, teams, cricketers
- All 3 views
- All 8 procedures, including confirming the two multi-result-set procedures
  return correctly labelled sections with the right row counts
- All 3 functions
- CORS preflight headers
- Validation error (400) and not-found error (404) responses
- The SQL-injection attempts described in §8

All of the above passed before this guide was written.

---

## 11. Running it yourself

```bash
cd Documents/Java_Projects/cricket-universe-springboot

# Option A: use the defaults baked into application.properties
mvn spring-boot:run

# Option B: override DB credentials via environment variables
export DB_USERNAME=your_user
export DB_PASSWORD=your_password
mvn spring-boot:run

# Or run the packaged jar
mvn clean package -DskipTests
java -jar target/cricket-universe-springboot.jar
```

The API listens on `http://localhost:8082/api/...` (port `8082` is used —
not `8080` — to avoid clashing with the earlier `cricket-universe-repo`
project which uses `8081`).

---

## 12. Key takeaways for a beginner

1. **Layering isn't bureaucracy — it's a firewall.** A `Controller` bug can't
   accidentally write raw SQL because it physically has no access to a
   `Connection`; it only has a `Service`.
2. **One pattern, two implementations is normal.** Spring Data JPA is great
   for plain tables, but stored procedures with multiple result sets need
   raw JDBC underneath. The Repository Pattern lets both live behind the same
   kind of interface, so the rest of the app doesn't care which one it's
   talking to.
3. **Parameter binding, not string concatenation, is what actually stops SQL
   injection** — not "sanitizing" input, not blocklisting characters. Every
   data-access technology in this project (JPA, JdbcTemplate, CallableStatement)
   binds parameters rather than concatenating them into SQL text.
4. **Secrets belong in `application.properties` with environment overrides**,
   never hard-coded in a Java class.
