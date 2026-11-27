# SQL Injection Prevention

**The threat:** user input concatenated into SQL (`"... where name = '" + q + "'"`) lets an attacker change the query (`' OR '1'='1`, `'; DROP TABLE ...`). **The rule in this project:** *SQL text is always a compile-time constant; user data only ever travels as bound parameters; anything that cannot be bound (sort columns) is validated against an allow-list first.*

## 1. Where user input can reach the database, and how each is protected
| Entry point | Mechanism | Where |
|---|---|---|
| Derived Spring Data queries (`findByWorkEmailIgnoreCase`) | parameters bound by Hibernate | every `*Repository` |
| JPQL `@Query` with `:name` parameters | named parameters; 49 `@Query` declarations, none concatenates | e.g. `EmployeeRepository.directory`, `UserAccountRepository` (`like lower(concat('%', :q, '%'))` - the concat is done by the DB on a **bound** value) |
| Criteria API / `Specification` | typed predicates, values bound; `LIKE` wildcards escaped | `EmployeeSpecifications` (`escapeLike` neutralises `%`, `_`, `\`), `EmployeeRepositoryCustomImpl` |
| Native SQL | constant text, no parameters from users | `countByStatusNative()` |
| JdbcTemplate / NamedParameterJdbcTemplate / SimpleJdbcCall | `?` / `:name` placeholders only | `OrgHierarchyJdbc`, `LeaveDurationService`, `PayrollRunService` batch + `CALL sp_...(?, ?)` |
| Plain JDBC | `PreparedStatement` / `CallableStatement` with `setString/setInt/setNull` | `AttendanceJdbc` |
| Stored procedures / functions | called with parameters; bodies use parameters, never `PREPARE ... CONCAT` | `V3` migrations |
| **Sorting and paging** (`?sort=name,desc&size=50`) | cannot be bound → **allow-list**: `PageRequests.of(page, size, sort, allowedFields, default)` throws `400` for any other field, direction must be `asc`/`desc`, size ≤ 200 | 15 controllers (`common-library/.../web/PageRequests.java`) |
| Filters typed as enums / UUIDs | converted before use: `EmployeeStatus.valueOf(...)`, `@ValidEmployeeId` (canonical UUID only) | DTO validation |
| Migrations | static SQL files executed by Flyway, never built from input | `db/migration` |

## 2. Worked example (verified against the running system)
```http
GET /api/v1/employees?q=x'%20OR%20'1'='1&sort=lastName;DROP%20TABLE%20employees,asc
```
1. `sort` → `PageRequests` → **400** `Cannot sort by 'lastName;DROP TABLE employees'. Allowed: [firstName, joiningDate, employeeCode, workEmail, lastName, status, createdAt]` - the request never reaches SQL.
2. With a valid sort, `q` becomes the bound parameter value `%x' or '1'='1%` (after `escapeLike` / lower-casing). The generated statement is
   `select ... where (lower(first_name) like ? escape '\\' or ...)` with the whole string as **data** → `{"content":[],"totalElements":0,...}` (no rows match, no syntax change is possible).

## 3. Defence in depth
* **Least privilege:** the runtime DB user has `SELECT, INSERT, UPDATE, DELETE, EXECUTE` on its own databases only - no DDL, no `FILE`, no access to other schemas. Even a successful injection could not drop tables or read other services' data.
* **Audit immutability:** `audit_history` rejects UPDATE/DELETE through triggers.
* **Input validation** (`validation-mapping-guide`): size limits (`@Size`), patterns, UUID checks, enum conversions, 2 MB form / 10 MB upload limits.
* **No SQL in error responses:** `GlobalExceptionHandler` returns generic `DATA_CONFLICT` / `INTERNAL_ERROR`; exception details only reach the log. `server.error.include-*: never`.
* **Log masking:** values of `password`, `token`, `secret`, `pan`, `account` query parameters are masked in logs (`LogMasker`).
* **Soft-delete restriction** (`@SQLRestriction`) is a constant fragment appended by Hibernate, not user data.

## 4. Review checklist (used while building)
1. Any `String + variable` or `String.format` building SQL? → none exist (`grep -rn '" + ' ` over repositories / JDBC classes).
2. Any `createNativeQuery` / `nativeQuery = true` with user data? → one native query, constant.
3. Any ORDER BY / column / table name from the request? → only through `PageRequests` allow-lists.
4. Dynamic `LIKE`? → value bound and wildcards escaped.
5. `IN (...)` lists? → bound collections (`findByIdIn(Collection<String>)`).
6. Stored routines using dynamic SQL (`PREPARE`)? → none.

## 5. Related injection classes
* **Command / path injection:** uploaded files are stored under generated names; `FileTypeSniffer` checks content; `RequestHeaderValidationFilter` rejects traversal and NUL bytes in URLs.
* **Log injection:** correlation ids from clients are validated (`^[A-Za-z0-9._-]{8,64}$`); the log pattern is fixed.
* **Mass assignment:** `BeanMapper` copies only DTO properties.
* **Header injection:** header values are validated before being echoed (correlation id).

## Pros / cons
| Pros | Cons |
|---|---|
| Parameter binding makes value-injection structurally impossible | Allow-lists must be kept in sync when new sortable columns are added |
| One shared `PageRequests` for sorting | Dynamic reporting (user-defined columns) would need a query builder - deliberately not offered |
