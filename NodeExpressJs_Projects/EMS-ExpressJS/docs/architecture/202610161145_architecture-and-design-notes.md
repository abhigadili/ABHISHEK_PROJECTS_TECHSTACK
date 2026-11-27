# EMS-ExpressJS — Architecture and design notes

## Layering

```
HTTP → routes (path + middleware chain) → validators (express-validator) → controllers (HTTP only)
     → services (business rules, transactions) → repositories (SQL, parameterised) → MySQL
```

* `src/routes/index.js` mounts `/auth` publicly, then applies `authenticate` to everything else.
* `middleware/auth.js` verifies the JWT and **re-loads the user** each request; `authorize(...roles)` gates routes.
* `middleware/errorHandler.js` is the only place errors become responses; MySQL error codes (`ER_DUP_ENTRY`, FK, CHECK) are mapped to 409/400/422, anything unknown becomes a generic 500 with a request id.
* `services/accessScope.js` answers "which employee ids may this user see?" — `null` for admins, own subtree for managers, self for employees. Attendance, leave, dashboard and reports all use it.
* `models/employeeMapper.js` is the single place that decides which employee fields a viewer receives (admin / self / directory).

## Key flows

**Refresh-token rotation** — login stores `sha256(refreshToken)` with a `family_id`. `/auth/refresh` locks the row, issues a new token in the same family and revokes the old one (`UPDATE … WHERE revoked_at IS NULL`; only one concurrent caller wins). Presenting an already-revoked token revokes the entire family.

**Leave approval (concurrency-safe)** — inside one transaction: lock the request row → check `PENDING` → ensure the year's balance rows → `SELECT … FOR UPDATE` the balance → verify availability → insert the ledger `DEDUCTION` (unique `(leave_request_id,type)`) → `used += days` → mark attendance `ON_LEAVE` → set status → notify. Retries and parallel approvals either fail the status check (409) or hit the unique key; the integration tests fire 5 simultaneous approvals and assert one deduction.

**Applying for leave** locks the employee row first, serialising that employee's concurrent applications so the overlap check cannot race.

**Org hierarchy** — recursive CTEs seed from roots (or a chosen employee) and carry a `path` string; a row is only expanded when its id is not already in the path, and depth is capped at 25. Employees unreachable from any root (legacy cycles) are returned under `warnings.unreachableEmployees` instead of looping. Writes reject self-management and any manager that is a descendant of the employee.

**Profile pictures / documents** — `multer` memory storage with a size limit; the real type is sniffed from magic bytes (JPEG/PNG/WebP, plus PDF for leave documents) and must agree with the declared MIME type. Stored as `LONGBLOB`, served with `nosniff`.

## Why a few things are the way they are

* **No stored procedures/triggers.** Creating triggers needs `SUPER` when binary logging is on; business rules are in the service layer and backed by constraints. "Not your own manager" cannot be a CHECK because MySQL forbids CHECK on AUTO_INCREMENT columns, so it is enforced in code (and verified by `10_database_validation_queries.sql`).
* **Express 5 `req.query`** is a getter, which would discard validator sanitisers; `app.js` pins a mutable copy so `toInt()/toBoolean()` results persist.
* **`dateStrings: true`** on the pool: DATE/DATETIME arrive as strings, so no accidental timezone shifts. DATETIME columns hold UTC.
* **Password reset without SMTP**: the token is never logged; in development `EXPOSE_RESET_TOKEN=true` returns it in the response. Swap `utils/mailer.js` for a real transport to email it.

## Known limits / possible next steps

* Leave requests cannot span two calendar years (submit two requests).
* Carry-forward is applied when the next year's balance row is first created.
* Notifications are in-app only; email is a seam, not an implementation.
* No refresh-token cookie mode (and therefore no CSRF surface): tokens travel in headers.
