# Validation and Mapping Guide

## Part A - Validation (Jakarta Bean Validation, Hibernate Validator)

**What / why:** constraints are declared on request DTO records (`@NotBlank`, `@Size`, ...). `@Valid` on the controller parameter makes Spring validate before the method runs, so services receive only structurally valid data. Business rules that need the database stay in services (validation is the *first* line, DB CHECK constraints the last).
**Scale:** ~165 `@Valid` usages, 146 `@NotBlank`, 172 `@Size`, 59 `@Pattern`, 61 `@NotNull`, 24 `@Min` / 18 `@Max`, `@Email`, `@Positive`, `@PositiveOrZero`, `@DecimalMin/Max`, `@Past`, `@AssertTrue`, `@NotEmpty`.

### 1. Standard constraints on records
```java
public record LoginRequest(@NotBlank @Size(max = 150) String username, @NotBlank @Size(max = 200) String password) { }
```
`POST /api/v1/auth/login` with empty values - **real response**:
```json
{ "timestamp": "2026-11-25T10:21:04.007Z", "status": 400, "error": "Bad Request", "code": "VALIDATION_FAILED",
  "message": "Request validation failed", "path": "/api/v1/auth/login", "correlationId": "9a4df0cf-...",
  "fieldErrors": { "username": "must not be blank", "password": "must not be blank" } }
```
Mapped by `GlobalExceptionHandler` (`MethodArgumentNotValidException` → `VALIDATION_FAILED` + `fieldErrors`; `ConstraintViolationException` for path/query parameters; `HttpMessageNotReadableException` for malformed JSON).

### 2. Custom constraints (all `ConstraintValidator`s)
| Annotation | File | Rule |
|---|---|---|
| `@ValidDateRange` (class level, `DateRangeAware`) | `common-library/.../validation/ValidDateRange.java` | end date must be on or after start date |
| `@ValidEmployeeId` | `common-library/.../validation/ValidEmployeeId.java` | must be a canonical UUID (used on 18 path / body ids; blocks malformed ids before any query) |
| `@StrongPassword` | `common-library/.../validation/StrongPassword.java` | regex `^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])\S{10,72}$` |
| `@NoLeaveOverlap` | `leave-service/.../validation/LeaveOverlapValidator.java` | no overlapping approved/pending leave - a **Spring-managed validator**: Spring injects the repository into it |
| `@ValidTimesheetWeek` | `timesheet-service/.../validation/ValidTimesheetWeek.java` | week start is a Monday, not in the future, within the last 12 weeks |
| `@ValidResignationDate` | `exit-service/.../validation/ValidResignationDate.java` | last working day after today and within one year |
| `@AllocationPercent` | `project-service/.../validation/AllocationPercent.java` | 5-100 in steps of 5 |
| `@ValidSalaryComponent` | `payroll-service/.../validation/ValidSalaryComponent.java` | a component definition is consistent for its calculation type |
```java
@Constraint(validatedBy = ValidDateRange.Validator.class) @Target(TYPE) @Retention(RUNTIME)
public @interface ValidDateRange { String message() default "End date must be on or after the start date"; ...
    class Validator implements ConstraintValidator<ValidDateRange, DateRangeAware> {
        public boolean isValid(DateRangeAware v, ConstraintValidatorContext c) {
            if (v == null || v.rangeStart() == null || v.rangeEnd() == null) return true;   // null handling is @NotNull's job
            return !v.rangeEnd().isBefore(v.rangeStart());
        } } }
```
**Real response** for a leave request with `toDate < fromDate` and a blank reason:
```json
"fieldErrors": { "reason": "must not be blank", "leaveApplyRequest": "End date must be on or after the start date" }
```
Class-level violations are keyed by the DTO name (a property-less error). Validators treat `null` as valid so each rule has a single responsibility.

### 3. Rules that live in services (need data)
Balance sufficiency, project allocation peak ≤ 100 %, duplicate timesheet entries, state-machine transitions, employee-status checks, ownership - thrown as `BadRequestException` / `ConflictException` / `ValidationException` (with per-item `fieldErrors`, e.g. the payroll run lists every failing employee).

### 4. Defence layers
`@Valid` (shape) → service rules (business) → JPA / SQL parameter binding (injection-safe) → DB CHECK / UNIQUE / FK (integrity). Sort and filter inputs are additionally allow-listed (`PageRequests`).

**Pros:** declarative, uniform error format, reusable across services. **Cons:** validators that call the DB add a query per request; messages need i18n if localisation is ever required.

## Part B - Mapping (DTO ⇄ entity)

**Rule:** entities never leave the service layer and never come straight from a request. Requests and responses are Java `record`s (`<service>/.../dto/*Dtos.java`); mapping is done by one reusable class:

`common-library/src/main/java/com/hrportal/common/persistence/BeanMapper.java` - reflection-based (the "reusable manual mapping" approach; MapStruct is the compile-time alternative).
| Method | Direction | Behaviour |
|---|---|---|
| `toRecord(entity, ResponseRecord.class)` | entity → response | matches by name; recursively maps nested objects, collections, enums, value types; primitives default if null |
| `toRecords(collection, Class)` | list | same per element |
| `toEntity(request, Entity.class)` | request → new entity | `copyNonNull` into a fresh instance (entity defaults survive for null components) |
| `copyNonNull(request, entity)` | request → existing | **partial update (PATCH semantics)**: null components are ignored |
| `copyAll(request, entity)` | request → existing | full update (PUT semantics; primitives never set to null) |
**Security property:** only names present on the DTO are touched, so `id`, audit columns, `version`, `deleted` and any field not in the request record can **never** be overwritten from a request (no mass-assignment). Reflected fields are cached in a `ConcurrentHashMap`.
```java
Department d = BeanMapper.toEntity(request, Department.class);
repo.save(d);                        return BeanMapper.toRecord(d, DepartmentResponse.class);

BeanMapper.copyNonNull(updateRequest, employee);   // PATCH: only supplied fields change
```
*Expected output:* `PATCH /api/v1/employees/{id}` with `{"phone":"+91..."}` changes only `phone`; the response record contains the full current state; `id`, `createdAt`, `version` are unchanged. Encrypted columns map transparently (the converter decrypts on read; list responses mask).
Hand-written mapping is used where logic is needed (e.g. `toBank` masks the account number; `EmployeeService` computes `FieldDiff` for the change log).
`CrudService<E, Req, Res>` (common-library) builds list / get / create / update / soft-delete on top of the mapper for simple master data.

| | Pros | Cons |
|---|---|---|
| BeanMapper (reflection) | one small class, no code generation, safe against mass assignment | runtime errors if names diverge (no compile-time check), slower than generated code (field cache mitigates) |
| Records | immutable, concise, validated at the edge | need a response record per view |
