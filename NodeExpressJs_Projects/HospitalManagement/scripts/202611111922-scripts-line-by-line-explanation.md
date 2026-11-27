# `scripts/` folder - what every line of every file does

Files: `common.sh`, `create-databases.sh`, `start-all.sh`, `stop-all.sh`, `db-url.mjs`, `gen-schema-doc.py`, `e2e.py`. Line numbers refer to the files as they are now. Rows that span a range (e.g. `5-8`) are one statement continued over several lines or a group of lines that do one thing.

How they fit together: `common.sh` is *sourced* by the four shell scripts (service table + `.env`); `db-url.mjs` is called by `create-databases.sh`; `e2e.py` and `gen-schema-doc.py` are stand-alone Python tools.

---
## 1. `common.sh` - shared helpers (never run directly; `source`d)
| Line | Meaning |
|---:|---|
| 1 | Shebang: run with `bash`. |
| 2 | Comment: this file provides the repo root, the `.env` values and the service table. |
| 3 | `ROOT` = absolute path of the repository: take this script's own path (`BASH_SOURCE[0]`), its directory (`dirname`), go one level up (`/..`) and resolve it with `pwd`. Makes every script work from any current directory. |
| 4 | If `$ROOT/.env` exists: `set -a` (auto-export every variable assigned from now on), `.` (source) the `.env` file, `set +a` (stop auto-exporting). This loads `MYSQL_*`, `KAFKA_BROKERS`, `REDIS_URL`, `JWT_SECRET` into the environment of the scripts and of the Node processes they start. |
| 5 | `RUN_DIR` = `.run` (reserved for pid/run files), `LOG_DIR` = existing `$LOG_DIR` or `<repo>/logs`; `mkdir -p` creates both if missing. |
| 6 | Starts the bash array `SERVICES`. |
| 7-16 | One array element per microservice in the format `folder-name:REST-port:database-name` (e.g. `hospital-service:30104:HospitalDB`). The order is the start order (identity/reference services first). The scripts split each entry on `:`. |
| 17 | Closes the array. |
| 18 | `INIT` = name of the Prisma init migration folder (`20261111000000_init`) used by `create-databases.sh`. |

---
## 2. `create-databases.sh` - creates the 10 databases and applies the Prisma schema
| Line | Meaning |
|---:|---|
| 1 | Shebang (bash). |
| 2-4 | Comment block: step 1 = `CREATE DATABASE IF NOT EXISTS` ×10; step 2 = per service apply the Prisma init migration once (safe on non-empty databases) and record it in Prisma's history table; later migrations go through `prisma migrate deploy`; tables of other applications are never touched (all ours are `hjs_*`). |
| 5 | Load `common.sh` (`ROOT`, `.env`, `SERVICES`, `INIT`). `"$(dirname "$0")"` = folder of this script, so it works from anywhere. |
| 6 | Export `MYSQL_PWD` (the env var the `mysql` client reads as password) from `MYSQL_PASSWORD`; `${VAR:?message}` aborts the script with that message if the variable is missing - so the password never appears on a command line. |
| 7 | `M` = reusable `mysql` command with host, port and user (defaults `localhost`, `3306`, `abhig`). |
| 8 | Runs `database/scripts/00-create-databases.sql` (ten `CREATE DATABASE IF NOT EXISTS`) through the client; only if it succeeds (`&&`) prints "databases ready". |
| 9 | Loop over every `SERVICES` entry. |
| 10 | Split the entry at `:` into `name`, `port`, `db` (`read -r` with `IFS=:`; `<<<` feeds the string). `port` is unused here. |
| 11 | Change into that service's folder (Prisma commands must run there to find `prisma/`). |
| 12 | Export `DATABASE_URL` for Prisma: calls `node scripts/db-url.mjs <db>` which builds the MySQL URL from the environment (password URL-encoded). |
| 13 | `applied` = 1 if the table `_prisma_migrations` already exists in that database, else 0 (query on `information_schema.tables`, errors silenced). |
| 14 | `done_init` defaults to 0 (init migration not yet applied). |
| 15 | If the history table exists, count rows for the init migration with a non-null `finished_at` (= successfully applied) and store it in `done_init`. The backticks are escaped so the shell does not treat them as command substitution. |
| 16 | If the init migration has not been applied yet: |
| 17 | `prisma db execute` runs the migration SQL file directly against the database (output hidden); `&& \` continues the command on the next line only on success. This is used instead of `migrate deploy` because the databases are not empty (deploy would stop with error P3005). |
| 18 | `prisma migrate resolve --applied <init>` records the migration as applied in `_prisma_migrations` (baselining), then prints "init migration applied". |
| 19 | Otherwise (already baselined): |
| 20 | `prisma migrate deploy` applies any *new* migrations; `grep` keeps the "No pending migrations"/"applied" line, `head -1` the first, `sed` prefixes it with `<service> -> <db>:`. Idempotent. |
| 21 | End of the `if`. |
| 22 | End of the loop. |

---
## 3. `start-all.sh` - starts the 10 services and the gateway
| Line | Meaning |
|---:|---|
| 1 | Shebang. |
| 2-3 | Comments: starts detached Node processes (stdout → `logs/<name>.out`, Pino also writes rolling files); Kafka/Redis must already run; `npm install` and `create-databases.sh` are one-time steps. |
| 4 | Load `common.sh`. |
| 5 | If `MYSQL_PASSWORD` is empty/unset: print a hint and exit 1 (services would fail at start-up anyway). `${VAR:-}` avoids an "unbound variable" error. |
| 6 | Defines function `start_one` taking `dir name port` (the trailing comment documents the arguments). |
| 7 | Local variables from the three arguments. |
| 8 | `ss -ltn "sport = :$port"` lists listeners on that port; if one exists (`grep -q LISTEN`) print "already in use - skipping" and `return` - so re-running the script never starts a duplicate. |
| 9 | In a subshell: `cd` into the service folder, `nohup node src/index.js` (survives the terminal closing), stdout+stderr to `logs/<name>.out`, trailing `&` runs it in the background. The subshell parentheses keep the `cd` from affecting the script. |
| 10 | Print "<name> starting on :<port>". |
| 11 | End of function. |
| 12 | Loop over the service table: split each entry and call `start_one services/<name> <name> <port>`. |
| 13 | Start the gateway (`api-gateway/` folder, port 30080). |
| 14 | Print a waiting message. |
| 15 | Loop again over all services plus a synthetic gateway entry `api-gateway:30080:`. |
| 16 | Split the entry into `name port db`. |
| 17 | Health path: `/ping` for services, `/gateway/ping` for the gateway (the gateway does not expose `/ping`). |
| 18 | Up to 60 attempts: `curl -sf` (silent, fail on HTTP error) the health URL; on success print "<name> UP" and `break`; otherwise `sleep 2`; on the last attempt (`i = 60`) print "did NOT come up - see logs/<name>.out". Total wait ≈ 2 minutes per component. |
| 19 | End of loop. |

---
## 4. `stop-all.sh` - graceful stop
| Line | Meaning |
|---:|---|
| 1 | Shebang. |
| 2 | Comment: sends SIGTERM (which triggers each service's graceful shutdown) to the process *listening on the project port* - never by process-name pattern (a `pkill -f` pattern could kill unrelated processes or the calling shell). |
| 3 | Load `common.sh`. |
| 4 | Loop over all services plus the gateway entry. |
| 5 | Split the entry into `name port db`. |
| 6 | `ss -ltnp "sport = :<port>"` shows the listener with its process; `grep -o 'pid=[0-9]*'` extracts `pid=123`, `head -1` takes the first, `cut -d= -f2` leaves `123`. Errors are silenced. |
| 7 | If a pid was found (`-n`), `kill` it (default SIGTERM) and print "stopped <name> (pid, port)". |
| 8 | End of loop. |

---
## 5. `db-url.mjs` - prints the Prisma connection URL
| Line | Meaning |
|---:|---|
| 1 | Comment: prints the `DATABASE_URL` for a database name; the password comes only from the environment. |
| 2 | Imports `databaseUrl` from the shared config module (which loads `.env` with dotenv and URL-encodes user/password, e.g. `@` → `%40`). |
| 3 | `process.argv[2]` is the database name passed by the caller; the URL is written to stdout **without a newline** so `$(node …)` in the shell captures it exactly. |

---
## 6. `gen-schema-doc.py` - generates the table reference of the database document (read-only)
| Line | Meaning |
|---:|---|
| 1 | Shebang (python3). |
| 2 | Docstring: reads `information_schema` only, only `hjs_*` tables. |
| 3 | Imports `os` and `subprocess`. |
| 4 | `env` = copy of the environment with `MYSQL_PWD` set from `MYSQL_PASSWORD` (KeyError if missing) - password passed to the client through the environment, never on the command line. |
| 5 | `base` = the `mysql` command (host, port, user from env with defaults) plus `-N` (no header), `-B` (tab-separated batch output) and `-e` (execute the SQL that is appended). |
| 6 | Function `q(sql)`: runs the client with that SQL (`check=True` raises on error), captures stdout, splits it into lines and each line on tabs → list of rows (lists of strings). |
| 7-8 | `DBS` = the ten `(database, service name)` pairs, in documentation order. |
| 9 | `out` collects the Markdown lines. |
| 10 | Loop over the databases. |
| 11 | Append the heading `## <db> - <service>`. |
| 12 | For each table of that database whose name starts with `hjs_` (the `\\_` escapes `_` as a literal in `LIKE`), ordered by name: |
| 13 | Append the sub-heading `### \`db.table\``. |
| 14 | Append the Markdown table header (Column / Type / Null / Key). |
| 15 | For every column (ordered by position) fetch name, type, nullability, key and extra (e.g. `auto_increment`)... |
| 16 | ...and append one table row; key and extra are joined with a space, skipping empty ones. |
| 17 | Append a blank line after the column table. |
| 18 | `idx` = non-primary indexes of the table: name, comma-joined column list (in index order) and `non_unique` flag. |
| 19 | `fks` = foreign keys of the table: constraint, column, referenced table and column. |
| 20 | If there are indexes, append one line listing them (`unique` prefix when `non_unique` is `0`). |
| 21 | If there are foreign keys, append one line listing `constraint: column -> table.column`. |
| 22 | Print everything joined with newlines (redirect it into a file; it is how the schema reference in the database doc was produced). |

---
## 7. `e2e.py` - end-to-end test through the gateway (stdlib only, 146 checks)

### Helpers and set-up (lines 1-66)
| Line | Meaning |
|---:|---|
| 1 | Shebang. |
| 2-3 | Docstring: end-to-end check of the six business scenarios through the API gateway; run after `start-all.sh`. |
| 4 | Imports (JSON, `sys`, `time`, `uuid`, `urllib` request/error for HTTP, `datetime`) - no third-party packages. |
| 6 | `GW` = gateway base URL (`http://localhost:30080`); every call goes through it, never directly to a service. |
| 7 | Counters `ok` and `fail` start at 0. |
| 8 | `RUN` = 8 random hex chars; used in usernames/e-mails/licence numbers so the script can be run repeatedly without unique-constraint clashes. |
| 11 | `call(method, path, body, token, expect)` - the HTTP helper; returns `(status, parsed_json)`. |
| 12 | Serialise the body to JSON bytes (or `None`). |
| 13 | Build the request object for `GW + path` with the method. |
| 14 | Set `Content-Type: application/json`. |
| 15-16 | If a token is given, add `Authorization: Bearer <token>`. |
| 17-19 | Send with a 20 s timeout; on success take status and body text. |
| 20-21 | `HTTPError` (4xx/5xx) is not an exception for us: take its status code and body so tests can assert on error answers. |
| 22-25 | Parse the body as JSON (empty → `None`; non-JSON → keep the raw text). |
| 26-27 | If `expect` was passed, immediately record a PASS/FAIL check "`METHOD path -> status`". |
| 28 | Return status and JSON. |
| 31-38 | `check(name, cond, detail)`: increments `ok` or `fail` and prints `PASS`/`FAIL` (with detail on failure). |
| 41-53 | `wait_for(name, fn, timeout)`: polls `fn()` every second up to 40 s until it returns something truthy (then records PASS and returns the value); exceptions are swallowed while polling; on timeout records a FAIL. Used for **asynchronous** (Kafka) effects. |
| 56-59 | `login(user, password)`: POST `/api/auth/login`, assert 200, return the access token. |
| 62-66 | `next_weekday(dow)`: the next date (starting tomorrow) that falls on weekday `dow` (0 = Monday) - used so appointments are always in the future on a day the doctor works. |

### Section 0 - authentication and gateway security (lines 69-88)
| Line | Meaning |
|---:|---|
| 69 | Print the section title. |
| 70 | Log in as seeded `admin`. |
| 71 | Admin creates a new DOCTOR account (unique name from `RUN`) via `POST /api/users`, expecting 201. |
| 72 | Log in as that new doctor. |
| 73-75 | Log in as seeded `labstaff1`, `pharmacist1`, `billing1`. |
| 76 | Another admin login to get the full login response (with refresh token). |
| 77 | Check: login returns an access + refresh token and the response contains no `passwordHash`. |
| 78 | Exchange the refresh token at `/api/auth/refresh`. |
| 79 | Check: rotation issued a *new* pair (refresh token differs, access token present). |
| 80 | Check: re-using the already-rotated refresh token → 401. |
| 81 | Check: because of that reuse, the whole token family is revoked - even the newest refresh token → 401. |
| 82 | Check: wrong password → 401. |
| 83 | Check: no token → 401 at the gateway. |
| 84 | Check: garbage token → 401. |
| 85 | Check: `/internal/x` is never proxied (401/403/404 accepted). |
| 86 | Check: `/ping` is not routed through the gateway. |
| 87 | Check: a DOCTOR listing users → 403 (admin-only route). |
| 88 | Check: ADMIN listing users → 200. |

### Reference data: hospital, doctor, schedule (lines 90-119)
| Line | Meaning |
|---:|---|
| 90 | Section title. |
| 91-92 | Fetch hospitals (200) and remember the first hospital id. |
| 93-95 | Fetch its departments, check at least 3 seeded ones, remember the first department id. |
| 96-97 | `GET /api/auth/me` as the new doctor to learn the doctor's user id. |
| 98 | Unique licence number from `RUN`. |
| 99-102 | Admin creates a doctor linked to that login (hospital/department validated over gRPC), expect 201, keep the doctor id. |
| 103-104 | Check: second doctor with the same licence → 409. |
| 105-106 | Check: doctor for a non-existent hospital 99999 → 400. |
| 107 | `target` = next Monday (the day used for bookings). |
| 108-109 | Build a weekly schedule Mon-Wed 09:00-13:00, 30-minute slots, break 11:00-11:30. |
| 110 | Check: setting the schedule without a token → 401. |
| 111 | The doctor sets their own schedule → 200. |
| 112-113 | Fetch the slot grid for the Monday and extract start times. |
| 114 | Check: the break is honoured (no 11:00 slot; 10:30 and 11:30 exist). |
| 115 | Check: 7 slots (4 h = 8 slots minus the one in the break). |
| 116-117 | Check: the doctor appears in "available doctors" on that working day. |
| 118-119 | Check: the doctor does **not** appear on a Saturday. |

### Scenario 1 - patient registration (lines 121-143)
| Line | Meaning |
|---:|---|
| 121-122 | Title; unique patient username. |
| 123-124 | Self-register a PATIENT account (201) and check its role is PATIENT. |
| 125 | Log in as the new patient. |
| 126-127 | Build the patient profile (unique e-mail, phone and identity number from `RUN`). |
| 128 | Check: invalid e-mail/phone → 400. |
| 129-130 | Create the profile (201), keep the patient id. |
| 131 | Check: profile is linked to the login (`userId`). |
| 132 | Check: a second profile for the same login → 409. |
| 133-135 | Register and log in a second patient account (`other`). |
| 136 | Check: that other patient re-using the first patient's e-mail/phone/identity → 409. |
| 137 | Check: the patient can read their own profile. |
| 138 | Check: the other patient reading it → 403. |
| 139 | Check: the patient can update their own profile (address). |
| 140-141 | Check: admin reads it and sees the new address (cache was refreshed). |
| 142 | Wait (Kafka): a welcome notification for `PatientRegistered` appears. |
| 143 | Wait (Kafka): a medical record was created for the patient. |

### Scenario 2/3 - availability, booking, overlap, reschedule, cancel (lines 145-170)
| Line | Meaning |
|---:|---|
| 145-147 | Availability for the Monday: all 7 slots free. |
| 148 | Booking payload for 09:30. |
| 149-150 | Patient books it (201), keep the appointment id. |
| 151 | Check: fee copied from the doctor (800). |
| 152-153 | Check: the booked slot is now unavailable (availability cache was evicted). |
| 154 | Check: booking the same slot again → 409. |
| 155 | Check: booking during the doctor's break (11:00) → 400. |
| 156 | Check: booking for someone else's patient id → 403/404. |
| 157 | Check: a time not on the slot grid (09:45) → 400. |
| 158 | Check: a past date → 400. |
| 159 | Check: unknown patient id → 404. |
| 160-161 | Reschedule to 10:00 (200) and check the new start time. |
| 162-163 | Check: the old 09:30 slot is free again and 10:00 is taken. |
| 164-165 | `GET /api/appointments/my` lists the appointment. |
| 166 | Check: the doctor sees it in their day list. |
| 167 | Wait (Kafka): booked notifications for patient **and** doctor (≥ 2). |
| 168 | Wait (Kafka): rescheduled notification. |
| 169-170 | Wait (Kafka): Billing auto-generated the consultation bill; keep the APPOINTMENT bill. |

### Concurrency (lines 172-183)
| Line | Meaning |
|---:|---|
| 172-174 | Title, import the thread-pool module, choose the slot 09:00. |
| 175-176 | `try_book`: admin tries to book that slot, returns only the HTTP status. |
| 177-178 | Fire 8 simultaneous requests in 8 threads and collect the statuses. |
| 179 | Check: **exactly one** 201 and seven 409 (the unique `slotKey` guarantees it). |
| 180-181 | Check: only one BOOKED appointment exists for that slot. |
| 182-183 | Check: availability shows the slot as taken. |

### Scenario 6 - billing and payments (lines 185-203)
| Line | Meaning |
|---:|---|
| 185-187 | Take the bill id; check the amount equals the doctor's fee. |
| 188 | Check: the patient sees their own bill. |
| 189 | Check: another patient → 403. |
| 190 | Check: a duplicate manual APPOINTMENT bill for the same appointment → 409. |
| 191-192 | Initiate a payment with the simulated outcome FAILURE → payment status FAILED. |
| 193 | Wait (Kafka): a PaymentFailed notification. |
| 194-195 | Initiate again with UPI (no simulation) → PENDING with a `TXN-` reference. |
| 196 | Check: a second payment while one is pending → 409. |
| 197 | Check: the patient cannot confirm payments → 403. |
| 198-199 | Billing staff confirms SUCCESS → payment SUCCESS. |
| 200 | Check: bill status PAID. |
| 201 | Check: an already settled payment cannot change → 409. |
| 202 | Wait (Kafka): PaymentCompleted notification. |
| 203 | Wait (Kafka): the appointment's `paymentStatus` became PAID. |

### Cancellation compensates billing (lines 205-214)
| Line | Meaning |
|---:|---|
| 205-207 | Book a second appointment at 12:00 and wait until it is billed. |
| 208-209 | Patient cancels it; check status CANCELLED. |
| 210 | Check: cancelling twice → 409. |
| 211 | Wait (Kafka): its pending bill became CANCELLED (compensating action). |
| 212-213 | Check: the 12:00 slot is free again. |
| 214 | Check: it can be booked again (201). |

### Leave day (lines 216-222)
| Line | Meaning |
|---:|---|
| 216-218 | Doctor marks next Tuesday as a day off (201). |
| 219 | Check: the slot grid for that day is empty. |
| 220 | Check: booking on that day → 400. |
| 221 | Doctor removes the day off (204). |
| 222 | Check: the 7 slots are back (cache invalidated). |

### Scenario 4 - lab (lines 224-244)
| Line | Meaning |
|---:|---|
| 224-226 | Catalogue has the seeded tests. |
| 227-228 | Lab request payload (CBC, URGENT); check a patient cannot request tests → 403. |
| 229-230 | Doctor requests the test (201), keep the id. |
| 231 | Wait (Kafka): the lab consumer assigned an accession number. |
| 232 | Wait (Kafka): Billing created the lab bill. |
| 233 | Check: submitting a report too early → 409. |
| 234 | Check: invalid status jump REQUESTED→IN_PROGRESS → 409. |
| 235-236 | Lab staff move the request SAMPLE_COLLECTED → IN_PROGRESS (200 each). |
| 237 | Check: a doctor cannot submit the report → 403. |
| 238 | Lab staff submit the report (abnormal result). |
| 239 | Check: request is COMPLETED. |
| 240-242 | Check: the patient and the doctor can read the report; another patient → 403. |
| 243 | Wait (Kafka): report-ready notification. |
| 244 | Wait (Kafka): LAB_REPORT entry on the medical-record timeline. |

### Scenario 5 - prescription → pharmacy → billing (lines 246-269)
| Line | Meaning |
|---:|---|
| 247-249 | Prescription payload: Paracetamol ×15 and Cetirizine ×5. |
| 250 | Check: a pharmacist cannot create prescriptions → 403. |
| 251 | Check: empty item list → 400. |
| 252-254 | Doctor creates it (201); status ACTIVE. |
| 255 | Wait (Kafka): Pharmacy opened an order. |
| 256 | Check: every order line matched an inventory item. |
| 257-258 | Pharmacist dispenses; check status DISPENSED and total 15×2.50 + 5×1.50 = 45.00. |
| 259 | Check: dispensing twice → 409. |
| 260 | Wait (Kafka): the prescription became DISPENSED. |
| 261 | Wait (Kafka): a 45.00 MEDICINE bill exists. |
| 262 | Wait (Kafka): PRESCRIPTION entry on the timeline. |
| 263-264 | Check: patient sees their own prescription; another patient → 403. |
| 265-266 | Check: an absurd quantity (100000) is rejected by validation → 400. |
| 267 | Create a prescription for a medicine not in inventory. |
| 268 | Wait (Kafka): its order exists. |
| 269 | Check: dispensing it → 409 and nothing changes. |

### Completion, robustness (lines 271-286)
| Line | Meaning |
|---:|---|
| 271-273 | Check: completing an appointment that has not started yet → 400. |
| 275 | Section title. |
| 276-278 | Send a request with a custom `X-Correlation-Id` and check the gateway echoes the same id. |
| 279-280 | Check: exactly one welcome notification exists for the registration (idempotent consumer). |
| 281 | Check: validation errors are 400 with a `details` list. |
| 282 | Check: unknown doctor id → 404. |
| 283 | Check: unknown route through the gateway (with a token) → 404. |
| 285 | Print `RESULT: <ok> passed, <fail> failed`. |
| 286 | Exit code 1 if any check failed, else 0 (so it can be used in automation). |
