# Cricket Universe — Repository Pattern REST API Guide

**Project:** `cricket-universe-repo`  
**Stack:** Java 21 · Repository Pattern · Service Layer · Embedded Tomcat 10.1 · Jakarta EE 9 · MySQL 8 · Gson  
**Date:** 2026-07-01  

---

## Table of Contents

1. [What Problem Does the Repository Pattern Solve?](#problem)
2. [Architecture Overview](#architecture)
3. [Project Structure](#structure)
4. [Layer-by-Layer Explanation](#layers)
5. [The Generic Repository Interface](#generic-repo)
6. [Domain-Specific Repository Interfaces](#domain-repo)
7. [JDBC Implementations](#jdbc-impl)
8. [The Service Layer](#service)
9. [Servlet Layer](#servlet)
10. [SQL Injection Prevention — Complete Guide](#sql-injection)
11. [CORS — Connecting React to the API](#cors)
12. [MySQL Views, Stored Procedures, and UDFs](#mysql-features)
13. [Embedded Tomcat — No External Server](#tomcat)
14. [Building and Running](#build-run)
15. [API Reference](#api-ref)
16. [How to Add a New Resource](#add-resource)
17. [Comparison: DAO vs Repository Pattern](#comparison)
18. [What to Learn Next](#next)

---

## 1. What Problem Does the Repository Pattern Solve? {#problem}

In a simple JDBC application, the servlet directly executes SQL:

```java
// Without Repository Pattern — all mixed together:
class CountryServlet {
    protected void doGet(...) {
        String sql = "SELECT * FROM countries WHERE name LIKE ?";
        PreparedStatement ps = con.prepareStatement(sql);
        ps.setString(1, "%" + req.getParameter("search") + "%");
        ResultSet rs = ps.executeQuery();
        // ...
    }
}
```

This has several problems:
- **Hard to test** — you need a real database just to test the HTTP routing logic.
- **Hard to swap** — if you move from MySQL to PostgreSQL, you edit servlets.
- **No business rules** — validation logic has nowhere clean to live.
- **Tightly coupled** — every layer knows about every other layer.

The **Repository Pattern** solves this by adding two clean boundaries:

```
Servlet (HTTP)  →  Service (rules)  →  Repository interface (contract)  →  JDBC impl (SQL)
```

Each layer talks only to the layer immediately below it, and only through an **interface** — not a concrete class.

---

## 2. Architecture Overview {#architecture}

```
HTTP Request
     │
     ▼
┌─────────────────────────────────────────────────────┐
│  Embedded Tomcat 10.1 (Main.java)                   │
│  URL pattern matching → correct servlet             │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  Servlet Layer                                      │
│  CountryServlet, LeagueServlet, TeamServlet, …      │
│  - Parse HTTP method, path, query params, body      │
│  - Call service methods with typed arguments        │
│  - Write JSON response via Gson                     │
│  - Add CORS headers (Access-Control-Allow-Origin)   │
│  ❌ No SQL. No JDBC. No business rules.             │
└──────────────────────┬──────────────────────────────┘
                       │  calls
                       ▼
┌─────────────────────────────────────────────────────┐
│  Service Layer                                      │
│  CountryService, LeagueService, TeamService, …      │
│  - Validate input (id required, name required)      │
│  - Coordinate operations (multi-step logic)         │
│  - Holds reference to Repository interface          │
│  ❌ No HTTP. No SQL. No JDBC.                       │
└──────────────────────┬──────────────────────────────┘
                       │  uses (interface only)
                       ▼
┌─────────────────────────────────────────────────────┐
│  Repository Interfaces                              │
│  CountryRepository, LeagueRepository, …             │
│  - Define the contract: findAll, findById, save, …  │
│  - Pure Java interfaces — no implementation here   │
└──────────────────────┬──────────────────────────────┘
                       │  implemented by
                       ▼
┌─────────────────────────────────────────────────────┐
│  JDBC Implementations (repository/impl/)            │
│  JdbcCountryRepository, JdbcLeagueRepository, …    │
│  - PreparedStatement with ? placeholders            │
│  - mapRow() converts ResultSet → model              │
│  ❌ No HTTP. No business rules.                     │
└──────────────────────┬──────────────────────────────┘
                       │  JDBC
                       ▼
┌─────────────────────────────────────────────────────┐
│  MySQL 8 — cricket_universe database                │
│  4 tables · 3 views · 8 stored procedures           │
│  3 UDFs · 12 triggers · 4 audit tables              │
└─────────────────────────────────────────────────────┘
```

---

## 3. Project Structure {#structure}

```
cricket-universe-repo/
├── pom.xml
└── src/main/java/com/cricket/
    ├── Main.java                              ← Tomcat startup + servlet registration
    ├── config/
    │   └── DBConnection.java                 ← JDBC connection factory
    ├── model/
    │   ├── Country.java                      ← Plain Java Object (POJO)
    │   ├── League.java
    │   ├── Team.java
    │   └── Cricketer.java
    ├── repository/
    │   ├── Repository.java                   ← Generic interface <T, ID>
    │   ├── CountryRepository.java            ← Country-specific contract
    │   ├── LeagueRepository.java
    │   ├── TeamRepository.java
    │   ├── CricketerRepository.java
    │   └── impl/
    │       ├── JdbcCountryRepository.java    ← MySQL implementation
    │       ├── JdbcLeagueRepository.java
    │       ├── JdbcTeamRepository.java
    │       └── JdbcCricketerRepository.java
    ├── service/
    │   ├── CountryService.java               ← Business rules + validation
    │   ├── LeagueService.java
    │   ├── TeamService.java
    │   └── CricketerService.java
    └── servlet/
        ├── BaseServlet.java                  ← CORS + JSON helpers (shared)
        ├── CountryServlet.java               ← GET/POST/PUT/DELETE /api/countries/*
        ├── LeagueServlet.java
        ├── TeamServlet.java
        ├── CricketerServlet.java
        ├── ViewServlet.java                  ← /api/views/* (3 MySQL views)
        ├── ProcedureServlet.java             ← /api/procedures/* (8 stored procs)
        └── FunctionServlet.java              ← /api/functions/* (3 UDFs)
```

**File count by layer:**

| Layer | Files | Purpose |
|-------|-------|---------|
| Model | 4 | Data containers only |
| Repository (interfaces) | 5 | Contracts only |
| Repository (impl) | 4 | All SQL lives here |
| Service | 4 | All business rules here |
| Servlet | 8 | All HTTP handling here |

---

## 4. Layer-by-Layer Explanation {#layers}

### How a request flows through all layers

Trace `GET /api/countries?search=india`:

```
1. Tomcat receives HTTP GET /api/countries?search=india
2. URL pattern /api/countries/* → CountryServlet.doGet()
3. CountryServlet:
     id = extractId(req)       → null (collection URL)
     search = "india"
     list = service.search("india")
4. CountryService:
     Validates search is not null
     delegates to repo.search("india")
5. JdbcCountryRepository:
     sql = "SELECT ... WHERE name LIKE ? OR short_name LIKE ? OR board LIKE ?"
     ps.setString(1, "%india%")    ← parameterised, never concatenated
     rs = ps.executeQuery()
     mapRow() converts each row to Country object
     returns List<Country>
6. Back in CountryServlet:
     sendList(res, list, list.size())
7. BaseServlet:
     Adds CORS headers
     Sets Content-Type: application/json
     Writes {"success":true,"data":[...],"total":1}
8. Tomcat sends HTTP response
```

Each layer only sees the types it needs. CountryServlet never sees SQL. JdbcCountryRepository never sees HTTP headers.

---

## 5. The Generic Repository Interface {#generic-repo}

```java
// repository/Repository.java
public interface Repository<T, ID> {

    List<T> findAll() throws SQLException;
    Optional<T> findById(ID id) throws SQLException;
    T save(T entity) throws SQLException;
    Optional<T> update(ID id, T entity) throws SQLException;
    boolean delete(ID id) throws SQLException;
}
```

This is Java generics — `T` is the model type, `ID` is the key type. For countries: `T=Country`, `ID=String`.

**Why `Optional<T>` for `findById` and `update`?**

`Optional<T>` makes it explicit that the result might be absent (row not found), without using `null`. Callers are forced to handle the missing case:

```java
Optional<Country> opt = service.getById("xyz");
if (opt.isPresent()) sendSuccess(res, opt.get());
else                 sendError(res, 404, "Country not found");
```

This is cleaner than checking for `null` — the API communicates the possibility of absence through the type system.

---

## 6. Domain-Specific Repository Interfaces {#domain-repo}

Each entity gets its own interface that extends the generic one and adds domain queries:

```java
// repository/CountryRepository.java
public interface CountryRepository extends Repository<Country, String> {

    // Generic interface gives: findAll, findById, save, update, delete
    // Domain query specific to countries:
    List<Country> search(String keyword) throws SQLException;
}
```

```java
// repository/LeagueRepository.java
public interface LeagueRepository extends Repository<League, String> {

    // Filter by parent country + optional name search
    List<League> findByCountry(String countryId, String keyword) throws SQLException;
}
```

The pattern: **generic operations in the base interface, domain-specific queries in the child interface.** Callers use the child interface type, which includes both.

---

## 7. JDBC Implementations {#jdbc-impl}

The implementations live in `repository/impl/`. Services reference the **interface**, not these classes:

```java
// repository/impl/JdbcCountryRepository.java
public class JdbcCountryRepository implements CountryRepository {

    @Override
    public List<Country> findAll() throws SQLException {
        List<Country> list = new ArrayList<>();
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement("SELECT ... FROM countries ORDER BY name");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) list.add(mapRow(rs));
        }
        return list;
    }

    @Override
    public Optional<Country> findById(String id) throws SQLException {
        try (Connection con = DBConnection.getConnection();
             PreparedStatement ps = con.prepareStatement("SELECT ... WHERE id = ?")) {
            ps.setString(1, id);   // ← safe parameterised binding
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? Optional.of(mapRow(rs)) : Optional.empty();
            }
        }
    }

    // ... save, update, delete, search
}
```

The `mapRow()` helper centralises column-to-field mapping:

```java
private Country mapRow(ResultSet rs) throws SQLException {
    Country c = new Country();
    c.setId(rs.getString("id"));
    c.setName(rs.getString("name"));
    // ... one line per column
    return c;
}
```

Both `findAll()` and `findById()` call `mapRow()` — no duplication.

---

## 8. The Service Layer {#service}

Services contain business rules and wire the repository implementation:

```java
// service/CountryService.java
public class CountryService {

    private final CountryRepository repo;  // ← interface type, not JdbcCountryRepository

    public CountryService() {
        this.repo = new JdbcCountryRepository();  // wired once here
    }

    // Constructor for testing — inject any implementation
    public CountryService(CountryRepository repo) {
        this.repo = repo;
    }

    public Country create(Country c) throws SQLException {
        // Business rule: id and name are mandatory
        if (c.getId() == null || c.getId().isBlank())
            throw new IllegalArgumentException("Country id is required");
        if (c.getName() == null || c.getName().isBlank())
            throw new IllegalArgumentException("Country name is required");
        return repo.save(c);
    }

    public Optional<Country> update(String id, Country c) throws SQLException {
        if (c.getName() == null || c.getName().isBlank())
            throw new IllegalArgumentException("Country name is required");
        return repo.update(id, c);
    }
}
```

**Key points:**
- The `repo` field is typed as `CountryRepository` (the interface), not `JdbcCountryRepository`.
- Validation (`IllegalArgumentException`) is thrown from the service — not the servlet.
- The second constructor enables dependency injection for tests.

**Why does this enable easy testing?**

```java
// In a test — no database needed:
CountryRepository fakeRepo = new InMemoryCountryRepository();
CountryService    service  = new CountryService(fakeRepo);

Country c = new Country();
c.setId("test");
c.setName("Test Country");
service.create(c);                          // works without MySQL
assertEquals("Test Country", fakeRepo.findById("test").get().getName());
```

The `InMemoryCountryRepository` stores data in a `HashMap<String, Country>`. No database, no network, instant test.

---

## 9. Servlet Layer {#servlet}

Servlets are now extremely thin — they only deal with HTTP:

```java
// servlet/CountryServlet.java
@WebServlet(urlPatterns = "/api/countries/*")
public class CountryServlet extends BaseServlet {

    private final CountryService service = new CountryService();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse res) throws IOException {
        String id = extractId(req);   // null for collection, "india" for single
        try {
            if (id == null) {
                String search = req.getParameter("search");
                List<Country> list = (search == null || search.isBlank())
                    ? service.getAll() : service.search(search);
                sendList(res, list, list.size());
            } else {
                Optional<Country> opt = service.getById(id);
                if (opt.isPresent()) sendSuccess(res, opt.get());
                else                 sendError(res, 404, "Country not found: " + id);
            }
        } catch (SQLException e) {
            sendError(res, 500, "DB error: " + e.getMessage());
        }
    }
    // ... doPost, doPut, doDelete
}
```

The servlet does not know: what SQL runs, how validation works, or which database is behind the API. It just translates HTTP ↔ service calls.

---

## 10. SQL Injection Prevention — Complete Guide {#sql-injection}

### What is SQL Injection?

SQL injection happens when user input changes the structure of a SQL query. Classic attack:

```java
// VULNERABLE:
String sql = "SELECT * FROM countries WHERE name = '" + userInput + "'";
```

If `userInput = "' OR '1'='1"`, the final SQL becomes:
```sql
SELECT * FROM countries WHERE name = '' OR '1'='1'
```
This returns every row. More dangerous payloads can drop tables, exfiltrate other databases, or bypass login.

### Defense 1 — PreparedStatement (used everywhere in this project)

```java
// SAFE — from JdbcCountryRepository:
String sql = "SELECT ... FROM countries WHERE id = ?";
PreparedStatement ps = con.prepareStatement(sql);
ps.setString(1, id);   // ← user input bound as DATA, never as SQL
```

**How it works at the wire level:**

```
Step 1 — Java sends to MySQL:  "SELECT ... WHERE id = ?"
Step 2 — Java sends to MySQL:  parameter[1] = "' OR '1'='1"
```

MySQL receives these as two separate protocol messages. The SQL text is compiled first, with a placeholder — the parameter value never changes the compiled structure. The attacker's SQL tokens are treated as a plain string literal.

### Defense 2 — Dynamic WHERE without concatenation

Some endpoints accept multiple optional filters. The wrong approach concatenates strings:

```java
// WRONG — user input in SQL text:
if (countryId != null) sql += " AND country_id = '" + countryId + "'";
```

This project uses the **`WHERE 1=1` + parameter list** pattern:

```java
// SAFE — from JdbcLeagueRepository:
StringBuilder sb = new StringBuilder("SELECT ... WHERE 1=1");
List<Object> params = new ArrayList<>();

if (countryId != null && !countryId.isBlank()) {
    sb.append(" AND l.country_id = ?");    // ← structure is our constant string
    params.add(countryId);                  // ← value collected, not concatenated
}
if (keyword != null && !keyword.isBlank()) {
    sb.append(" AND l.name LIKE ?");
    params.add("%" + keyword + "%");
}

PreparedStatement ps = con.prepareStatement(sb.toString());
for (int i = 0; i < params.size(); i++) {
    ps.setObject(i + 1, params.get(i));   // ← bound as data, not SQL
}
```

The SQL structure (`WHERE 1=1 AND l.country_id = ? AND l.name LIKE ?`) comes entirely from our code constants. User data travels only through `setObject()`.

### Defense 3 — Stored Procedures via CallableStatement

```java
// From ProcedureServlet:
CallableStatement cs = con.prepareCall("{CALL sp_list_players(?,?)}");
cs.setNull(1, Types.VARCHAR);     // null when no teamId given
cs.setString(2, role);            // user's role value — bound as data
cs.execute();
```

`CallableStatement` uses the same parameterised binding as `PreparedStatement`. The procedure runs inside MySQL with a compiled execution plan — user values cannot alter the SQL structure.

### Defense 4 — View names from switch, never from user

`ViewServlet` builds `SELECT * FROM <viewName>` where the view name cannot be a `?` parameter (MySQL doesn't allow parameterised table names). The view name is selected from a **closed switch over our own constants**:

```java
String viewName = switch (path) {
    case "/countries-leagues" -> "v_countries_leagues";   // our constant
    case "/teams-players"     -> "v_teams_players";       // our constant
    case "/all-players"       -> "v_all_players_detail";  // our constant
    default -> null;    // anything else → 404 before any SQL is built
};
if (viewName == null) { sendError(res, 404, "Unknown view"); return; }
String sql = "SELECT * FROM " + viewName;   // safe: viewName is always one of 3 strings
```

### Defense 5 — Typed parameter binding

```java
ps.setString(1, name);      // MySQL rejects if the column expects a non-string
ps.setInt(2, worldCupsWon); // NumberFormatException if user sends non-integer
```

`setString`/`setInt` enforce types before the query reaches the database. Even if an attacker bypasses the JSON parser, wrong types throw in Java before touching MySQL.

### Summary

| Defense | Where applied | What it prevents |
|---------|--------------|-----------------|
| `PreparedStatement` + `?` | All repository methods | SQL injection in all WHERE clauses |
| `WHERE 1=1` + param list | LeagueRepository, CricketerRepository | Injection in dynamic multi-filter queries |
| `CallableStatement` | ProcedureServlet | Injection in stored procedure parameters |
| Switch-mapped table names | ViewServlet | Injection in table name position |
| Typed setString/setInt | All repository methods | Type coercion attacks |

---

## 11. CORS — Connecting React to the API {#cors}

Browsers block `fetch()` calls from `http://localhost:3000` to `http://localhost:8081` by default (Same-Origin Policy). CORS is the standard that lets our server grant permission.

`BaseServlet.addCorsHeaders()` is called on every response:

```java
res.setHeader("Access-Control-Allow-Origin",  "*");
res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
```

Before sending PUT, POST, or DELETE, browsers send a **preflight OPTIONS request** to check permissions. `BaseServlet.doOptions()` handles it:

```java
@Override
protected void doOptions(HttpServletRequest req, HttpServletResponse res) throws IOException {
    addCorsHeaders(res);
    res.setStatus(204);   // No Content — just headers, no body
}
```

All 7 concrete servlets inherit this via `extends BaseServlet` — no duplication.

**In production:** replace `"*"` with `"https://your-react-app.com"` to restrict access.

**React usage example:**

```javascript
// In a React component:
useEffect(() => {
    fetch('http://localhost:8081/api/countries')
        .then(r => r.json())
        .then(d => setCountries(d.data));
}, []);
```

---

## 12. MySQL Views, Stored Procedures, and UDFs {#mysql-features}

### Views — `/api/views/*`

MySQL views are saved SELECT queries. Querying them looks like querying a table:

```java
PreparedStatement ps = con.prepareStatement("SELECT * FROM v_all_players_detail");
ResultSet rs = ps.executeQuery();
// reads columns dynamically via ResultSetMetaData
```

| Endpoint | View | Returns |
|----------|------|---------|
| `/api/views/countries-leagues` | `v_countries_leagues` | Country + its leagues |
| `/api/views/teams-players` | `v_teams_players` | Team + player count |
| `/api/views/all-players` | `v_all_players_detail` | Full player profile |

### Stored Procedures — `/api/procedures/*`

Stored procedures are SQL programs stored inside MySQL. Called via `CallableStatement`:

```java
CallableStatement cs = con.prepareCall("{CALL sp_window_functions_demo()}");
cs.execute();
ResultSet rs = cs.getResultSet();
// RANK, DENSE_RANK, ROW_NUMBER, NTILE, LAG, LEAD results
```

| Endpoint | Procedure | What it demonstrates |
|----------|-----------|---------------------|
| `/api/procedures/cursor-role-totals` | `sp_cursor_role_run_totals` | MySQL Cursor — iterate rows in SQL |
| `/api/procedures/window-functions` | `sp_window_functions_demo` | RANK, LAG, LEAD, ROW_NUMBER |
| `/api/procedures/analytics` | `sp_analytics_demo` | SUM/AVG OVER PARTITION BY |

### UDFs — `/api/functions/*`

User-Defined Functions are called inline in SELECT, unlike procedures:

```java
String sql = "SELECT fn_batting_average(?, ?) AS batting_average";
PreparedStatement ps = con.prepareStatement(sql);
ps.setInt(1, runs);
ps.setInt(2, matches);
```

The `/api/functions/all-players` endpoint applies all three UDFs to every cricketer in one query:

```sql
SELECT cr.name, cr.role,
  fn_batting_average(runs, matches) AS batting_average,
  fn_player_grade(runs, wickets, cr.role) AS player_grade,
  fn_format_player_label(cr.name, cr.role, t.name) AS player_label
FROM cricketers cr JOIN teams t ON t.id = cr.team_id
```

---

## 13. Embedded Tomcat — No External Server {#tomcat}

Traditional deployment: install Tomcat → deploy WAR → restart. With embedded Tomcat, the server is a library inside the fat JAR:

```java
// Main.java
Tomcat tomcat = new Tomcat();
tomcat.setPort(8081);

Connector connector = new Connector();
connector.setPort(8081);
tomcat.getService().addConnector(connector);

Context ctx = tomcat.addContext("", new File(".").getAbsolutePath());

Tomcat.addServlet(ctx, "CountryServlet", new CountryServlet());
ctx.addServletMappingDecoded("/api/countries/*", "CountryServlet");
// ... repeat for each servlet

tomcat.start();
tomcat.getServer().await();  // blocks until CTRL+C
```

Run with: `java -jar target/cricket-universe-repo.jar`

**Why `maven-shade-plugin` and not `maven-assembly-plugin`?**

Tomcat uses Java's SPI mechanism — it loads components by reading `META-INF/services/` files from JARs. When multiple JARs each have a `META-INF/services/some.Interface` file:
- Assembly plugin: silently **overwrites** them → Tomcat fails to start.
- Shade plugin with `ServicesResourceTransformer`: **merges** them → Tomcat starts correctly.

---

## 14. Building and Running {#build-run}

### Prerequisites

- Java 21+ (`java -version`)
- Maven 3.8+ (`mvn -version`)
- MySQL 8 with `cricket_universe` database, views, stored procedures, and UDFs loaded

### Build

```bash
cd Documents/Java_Projects/cricket-universe-repo
mvn package -q
```

Output: `target/cricket-universe-repo.jar` (~8 MB fat JAR)

### Run

```bash
java -jar target/cricket-universe-repo.jar
# Server starts on http://localhost:8081
```

### Test all layers

```bash
# CRUD
curl http://localhost:8081/api/countries
curl "http://localhost:8081/api/countries?search=india"
curl http://localhost:8081/api/countries/aus
curl -X POST http://localhost:8081/api/countries \
  -H "Content-Type: application/json" \
  -d '{"id":"nz","name":"New Zealand","shortName":"NZ","board":"NZC","worldCupsWon":0,"established":1894}'
curl -X PUT http://localhost:8081/api/countries/nz \
  -H "Content-Type: application/json" \
  -d '{"name":"New Zealand","worldCupsWon":1}'
curl -X DELETE http://localhost:8081/api/countries/nz

# Leagues
curl "http://localhost:8081/api/leagues?countryId=ind&search=ipl"

# Teams
curl "http://localhost:8081/api/teams?leagueId=ipl"

# Cricketers
curl "http://localhost:8081/api/cricketers?teamId=csk&role=Batsman"

# Views
curl http://localhost:8081/api/views/all-players
curl http://localhost:8081/api/views/teams-players

# Stored procedures
curl http://localhost:8081/api/procedures/cursor-role-totals
curl http://localhost:8081/api/procedures/window-functions
curl http://localhost:8081/api/procedures/analytics

# UDFs
curl "http://localhost:8081/api/functions/batting-average?runs=850&matches=20"
curl "http://localhost:8081/api/functions/player-grade?runs=500&wickets=10&role=Allrounder"
curl http://localhost:8081/api/functions/all-players
```

---

## 15. API Reference {#api-ref}

### CRUD Endpoints

| Method | URL | Query Params | Description |
|--------|-----|-------------|-------------|
| GET | `/api/countries` | `?search=` | List / search |
| GET | `/api/countries/{id}` | — | Single |
| POST | `/api/countries` | — | Create (JSON body) |
| PUT | `/api/countries/{id}` | — | Update (JSON body) |
| DELETE | `/api/countries/{id}` | — | Delete |
| GET | `/api/leagues` | `?countryId=` `&search=` | List / filter |
| GET | `/api/teams` | `?leagueId=` | List / filter |
| GET | `/api/cricketers` | `?teamId=` `&role=` | List / filter |

### Response Format

**Collection:**
```json
{ "success": true, "data": [...], "total": 7 }
```

**Single:**
```json
{ "success": true, "data": { "id": "ind", "name": "India", ... } }
```

**Error:**
```json
{ "success": false, "error": "Country not found: xyz" }
```

---

## 16. How to Add a New Resource {#add-resource}

Say you want to add a `Match` resource. The steps:

1. **Model** — `model/Match.java` — POJO with fields and getters/setters
2. **Repository interface** — `repository/MatchRepository.java` — extend `Repository<Match, String>`, add domain queries
3. **JDBC implementation** — `repository/impl/JdbcMatchRepository.java` — implement with PreparedStatement
4. **Service** — `service/MatchService.java` — validation + delegates to `MatchRepository`
5. **Servlet** — `servlet/MatchServlet.java` — extend `BaseServlet`, delegate to `MatchService`
6. **Register** in `Main.java` — add `add(tomcat, ctx, "MatchServlet", new MatchServlet(), "/api/matches/*")`

Each step is isolated. The servlet never touches the repository. The repository never sees HTTP. The service is the only place where business rules live.

---

## 17. Comparison: DAO vs Repository Pattern {#comparison}

Both patterns isolate data access, but they differ in scope and coupling.

| Aspect | DAO Pattern (`cricket-universe-servlet`) | Repository Pattern (`cricket-universe-repo`) |
|--------|------------------------------------------|----------------------------------------------|
| Interface | Optional / often absent | Required — defines the contract |
| What it returns | Model objects | Model objects wrapped in `Optional<T>` |
| Coupling | Servlet → DAO (concrete class) | Servlet → Service → Repository (interface) |
| Business rules | In the servlet or DAO | In the service layer |
| Testability | Requires real DB or mock DAO | Can swap repo implementation for in-memory store |
| Complexity | Simpler — fewer classes | More classes, cleaner boundaries |
| Best for | Small projects, quick prototypes | Medium/large projects, team environments |

The Repository Pattern costs more upfront (more files) but pays back in maintainability as the project grows.

---

## 18. What to Learn Next {#next}

| Topic | What It Adds |
|-------|-------------|
| **Dependency Injection** | Spring or Guice wires the repository into the service automatically |
| **Spring Boot** | Replaces boilerplate; same layered architecture underneath |
| **JPA / Hibernate** | ORM layer on top of JDBC — repositories with no SQL for CRUD |
| **HikariCP** | Connection pool — reuse connections safely across threads |
| **Unit testing** | JUnit + Mockito — test service layer without a database |
| **Integration testing** | Testcontainers — real MySQL in Docker for JDBC tests |
| **JWT authentication** | Stateless token auth — add to BaseServlet filter chain |
| **Docker** | Package the fat JAR in a container; compose with MySQL |
| **React frontend** | `useEffect` + `fetch` calls to `http://localhost:8081/api/…` — CORS already wired |

---

*Built with Java 21 · Repository Pattern · Service Layer · Embedded Tomcat 10.1 · MySQL 8 · Gson 2.10 · Maven Shade Plugin 3.5*
