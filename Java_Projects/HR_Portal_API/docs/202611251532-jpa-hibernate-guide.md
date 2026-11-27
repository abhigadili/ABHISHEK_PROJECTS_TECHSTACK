# JPA / Hibernate Guide

JPA is the Java standard for mapping objects to tables; Hibernate is the implementation; Spring Data JPA generates repositories. Used for all CRUD and most queries; JDBC is used where set-based SQL fits better (see `jdbc-guide`).

**Global settings** (`common-library/src/main/resources/hr-common.yml`): `ddl-auto: none` (Flyway owns the schema), `open-in-view: false` (no lazy loading in controllers), `hibernate.jdbc.time_zone: UTC`, JDBC batching (`batch_size 25`, `order_inserts`, `order_updates`), `fail_on_pagination_over_collection_fetch: true` (prevents in-memory pagination bugs), Hikari pool of 4 per service.

Each topic below: **what / why / where / HR use / example / expected output / pros-cons**.

## 1. Entities, mapped superclasses and auditing
* **What:** `@Entity` classes mapped to tables; `@MappedSuperclass` shares columns.
* **Why:** every table needs a UUID id and audit columns - declared once.
* **Where:** `common-library/.../persistence/BaseEntity.java` (id via `@UuidGenerator`, `@CreatedDate`, `@LastModifiedDate`, `@CreatedBy`, `@LastModifiedBy`; `equals` by id, class-based `hashCode` so entities behave in sets), `SoftDeletableEntity.java` (`deleted`, `deletedAt`, `markDeleted()`), `HrJpaConfig.java` (`@EnableJpaAuditing`, auditor = JWT username or `system`).
* **Example:** `class Employee extends SoftDeletableEntity` + `@SQLRestriction("deleted = false")`.
* **Output:** `DELETE /employees/{id}` sets `deleted=1`; later `GET` → 404 and the row stays for audit.
* **Pros / cons:** consistent audit; soft delete needs the restriction on every entity and unique keys that consider deleted rows.

## 2. Relationships
| Type | Where | Notes |
|---|---|---|
| `@OneToMany(cascade=ALL, orphanRemoval=true)` unidirectional with `@JoinColumn` | `employee-service/.../entity/Employee.java` (`addresses`, `emergencyContacts`) | removing an element from the list deletes the row |
| `@OneToOne` | `EmployeeBankDetail` (encrypted fields) | one bank record per employee |
| `@ManyToOne` | `exit` / `performance` child entities | lazy by default |
| `@ManyToMany` + `@JoinTable` | `auth-service/.../UserAccount.java` ↔ `Role` (`user_roles`), `Role` ↔ `Permission` (`role_permissions`) | `Set<>` to avoid duplicates |
| `@ElementCollection` | `holiday-service/.../Holiday.java` → `holiday_scopes` | collection of embeddables |
| Cross-service reference | plain `String employeeId` | never an entity association |

**HR example:** `PUT /api/v1/employees/{id}` replacing addresses → Hibernate diff: inserts new, deletes removed (orphanRemoval). **Cons:** bidirectional associations were avoided to stop accidental cycles and N+1.

## 3. Embedded value objects, composite keys
* `@Embedded ContactInfo` in `Employee` (phone, personal email, ... in the same table) and `@Embeddable HolidayScope`.
* `@EmbeddedId LeaveBalanceId` (employee, leave type, year) - `leave-service/.../LeaveBalance.java`, `LeaveBalanceId.java`.
* `@IdClass PolicyEntitlementId` - `LeavePolicyEntitlement.java` (policy + leave type).
**Why:** the natural key of a balance *is* (employee, type, year); a surrogate id would need an extra unique index.

## 4. Inheritance
`exit-service/.../entity/ExitTask.java`: `@Inheritance(SINGLE_TABLE)`, `@DiscriminatorColumn(name="task_type")` with subclasses for checklist, clearance, knowledge transfer, asset return and access revocation. One table, polymorphic queries (`findByResignationId` returns the right subclass per row). **Pros:** no joins; **cons:** sub-class-specific columns are nullable.

## 5. Fetching and N+1
All associations are `LAZY`. Where a collection is needed it is fetched by an **entity graph**:
```java
@EntityGraph(attributePaths = "addresses")
Optional<Employee> findWithAddressesById(String id);   // one SELECT with a join, no N+1
```
Two collections are never fetched together (would produce a cartesian product) - hence one graph method per collection (`EmployeeRepository`).

## 6. Query styles (all parameter-bound)
| Style | Example (file) |
|---|---|
| Derived query | `findByWorkEmailIgnoreCase`, `existsByWorkEmailIgnoreCase` (`EmployeeRepository`) |
| JPQL | `findJoinedOn(date)` |
| **DTO constructor expression** | `findTeam(managerId, excluded)` → `select new ...EmployeeDtos$TeamMember(...)` (6 columns, no entity) |
| **Interface projection** | `directory(...)` returns `Page<DirectoryView>` (`DirectoryView.java`) |
| **Specification (Criteria API)** | `EmployeeSpecifications.from(criteria)` - every filter optional, `LIKE` input escaped (`%`, `_`) |
| **Custom fragment with `EntityManager` + `CriteriaBuilder`** | `EmployeeRepositoryCustomImpl` - group-by headcount per department / status |
| **Native SQL** | `countByStatusNative()` (`SELECT status, COUNT(*) ...`) |
| `@Modifying` bulk update | 10 places, e.g. marking expired documents, closing allocations |
```java
Page<Employee> page = repo.findAll(EmployeeSpecifications.from(criteria), PageRequests.of(page, size, sort, ALLOWED));
// GET /api/v1/employees?q=priya&status=ACTIVE&page=0&size=20
```
*Expected output:* JSON `PageResponse` with `content`, `totalElements`, `totalPages`; SQL logged as `select ... where (lower(first_name) like ? escape '\\' or ...) and status=? limit ?` - values bound, never inlined.

## 7. Locking and concurrency
| Mechanism | Where | Why |
|---|---|---|
| `@Version` optimistic lock | 14 entities (Employee, LeaveApplication, LeaveBalance, PayrollRun, Timesheet, Loan, Document, ...) | two HR users editing the same record: the second save fails with `ObjectOptimisticLockingFailureException` → HTTP 409 |
| `@Lock(PESSIMISTIC_WRITE)` | `EmployeeSequence` (employee code counter), `LeaveBalance.lockById` | `SELECT ... FOR UPDATE`: concurrent onboardings never get the same `EMP0000n`; concurrent leave applications for one balance queue up |
| Redis lock | `leave-apply:<employeeId>` | stops double-submit across instances |

## 8. Transactions
Service methods are `@Transactional` (144 places; read methods `readOnly = true`). The outbox row is written in the same transaction as the business change. `EntityManager.refresh(entity)` is used after a stored procedure changed a row behind the persistence context (`SettlementService`).

## 9. Converters and callbacks
`EncryptedStringConverter` (AES-GCM) on PAN / bank account; `JsonMapConverter` (common-library) for small JSON maps; `@PrePersist` / `@PreUpdate` callbacks: `Employee.normalise()` (trim / lower-case work e-mail, upper-case code and blood group) and `Holiday.syncYear()` (year column always derived from the date).

## 10. Gotchas found while building
* Spring's naming strategy turns `numA` into `numa` (no underscore before a trailing single capital) - such fields carry an explicit `@Column(name = "num_a")` (`ReportFact`).
* `sensitive` is a MySQL reserved word - the column is `is_sensitive` (`document_categories`).
* `@OneToMany` read-only association clashed with an `@IdClass` column - entitlements are loaded through the repository instead.
* Nested repository interfaces need `@EnableJpaRepositories(considerNestedRepositories = true)`.

## Pros / cons of JPA overall
**Pros:** productivity, dirty checking, locking, caching of the persistence context, portable queries. **Cons:** hidden SQL (watch N+1), session semantics (detached entities, refresh after procedures), harder bulk operations - hence JDBC for batch upserts and procedures.
