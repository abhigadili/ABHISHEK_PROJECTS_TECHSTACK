# E-mail Configuration

E-mail is an **independent service** (`notification-service`): other services never send mail, they publish events. The Notification service turns events into rows (`notifications`), a background **dispatcher** renders and sends them asynchronously, tracks every attempt, and retries with back-off.

Code: `services/notification/app/{email_backends.py, templates.py, dispatcher.py, consumers.py, models.py, api/v1/notifications.py}` and `templates/email/*.j2`.

## 1. Backends (strategy pattern behind `EmailBackend`)

| `EMAIL_BACKEND` | Behaviour | Needs |
|---|---|---|
| **`file`** (default) | writes RFC-822 `.eml` files to `EMAIL_FILE_DIR` (`var/emails`, `/data/emails` in Docker) | nothing — **no credentials, no server** |
| `console` | logs recipient + subject only (never the body: it may contain a reset link) | nothing |
| `smtp` | real delivery with **aiosmtplib** (async) | SMTP server |

`file` is the zero-config development mode: `ls var/emails/*.eml`, open in any mail client, or `python -c "import email,sys;…"`.

### Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `EMAIL_BACKEND` | `file` | `file` \| `console` \| `smtp` |
| `EMAIL_FROM` | `Student Management <no-reply@sms.local>` | From header |
| `EMAIL_FILE_DIR` | `var/emails` | target of the file backend (relative paths are anchored at the project root) |
| `SMTP_HOST` / `SMTP_PORT` | `localhost` / `1025` | server |
| `SMTP_USERNAME` / `SMTP_PASSWORD` | unset | authentication (password is a `SecretStr`, never logged) |
| `SMTP_START_TLS` | `false` | STARTTLS (typically port 587) |
| `SMTP_USE_TLS` | `false` | implicit TLS (typically port 465) |
| `SMTP_TIMEOUT` | `10` | seconds |
| `NOTIFICATION_MAX_ATTEMPTS` | `5` | per notification |
| `NOTIFICATION_RETRY_BASE_SECONDS` | `5` | back-off base: 5, 10, 20, 40 … s |
| `NOTIFICATION_POLL_INTERVAL` | `2` | dispatcher poll when idle (it is also woken immediately by new work) |
| `NOTIFICATION_CONCURRENCY` | `5` | parallel sends (semaphore) |
| `NOTIFICATION_STUCK_AFTER_SECONDS` | `120` | reclaim rows left in `SENDING` by a crashed instance |

### Example configurations

```dotenv
# Mailpit (web inbox on http://localhost:8025): docker compose --profile tools up -d
EMAIL_BACKEND=smtp
SMTP_HOST=localhost      # inside Compose: mailpit
SMTP_PORT=1025

# Gmail / Office365 / SES style provider
EMAIL_BACKEND=smtp
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_START_TLS=true
SMTP_USERNAME=apikey-or-user
SMTP_PASSWORD=…           # keep in .env / secret store only
EMAIL_FROM="Registrar <registrar@your-domain.edu>"
```

## 2. Templates

One subject + one HTML file + one plain-text file per template, rendered with **Jinja2**:

| Template | Variables (required) | Triggered by |
|---|---|---|
| `user_registered` | `name`, `email` | Auth `NotificationRequested` after registration / admin-created user |
| `student_registered` | `name`, `student_number`, (`department_code`) | `StudentCreated` |
| `enrollment_confirmation` | `name`, `course_code`, `course_title` | `StudentEnrolled` |
| `enrollment_cancelled` | `name`, `course_code`, `course_title`, (`reason`) | `EnrollmentCancelled` |
| `password_reset` | `name`, `reset_link`, `expires_minutes` | Auth `forgot-password` |
| `password_changed` | `name` | change/reset password |
| `generic_notification` | `subject`, `message` (+ `name`) | `POST /notifications` (admin) |

* `templates/email/base.html.j2` is the shared layout (`{% extends %}` / blocks) — header, body, footer.
* **HTML is auto-escaped**, text is not: a variable such as `<script>` can never inject markup (unit test + e2e preview check: `&lt;b&gt;`).
* `StrictUndefined`: a missing variable is an error, not an empty string. The subject line is rendered in a **sandboxed** environment and collapsed to one line.
* Validation happens twice: when the Kafka event is consumed (unknown template or missing variables → the event is retried and then **dead-lettered**, see KAFKA §5) and again at send time (permanent failure → `DEAD`, no retries).
* `GET /notifications/templates` lists templates with their required variables; `POST /notifications/preview` renders subject/text/html without sending.

Add a template: create `<name>.html.j2` + `<name>.txt.j2`, register a `TemplateSpec(name, subject, required, description)` in `templates.py::REGISTRY`.

## 3. Workflows

```
Student registers (POST /auth/register)
  Auth: user + outbox(UserRegistered) + outbox(NotificationRequested user_registered)  ── one transaction
  relay → sms.notification.requests → Notification consumer → notifications(PENDING) → dispatcher → e-mail

Admin creates a student record        StudentCreated  → student_registered e-mail to the student's address
Student is enrolled / cancels         StudentEnrolled / EnrollmentCancelled → confirmation / cancellation e-mail
Forgot password                       Auth → NotificationRequested(password_reset, reset_link) → e-mail with link (30 min)
Password changed or reset             NotificationRequested(password_changed) → security notice
Admin sends a notice                  POST /api/v1/notifications  → 202 Accepted (BackgroundTasks wakes the dispatcher)
```

Because the e-mail path is event-driven, a slow or broken mail server never slows or breaks an API call: registration/enrollment return immediately, the row waits in the queue.

## 4. Delivery, tracking and retry

Status machine of `notifications.status`:

```
PENDING ──claim──▶ SENDING ──ok──▶ SENT
                      │
                      └─error─▶ FAILED (next_attempt_at = now + base·2^(attempts-1)) ──claim again──▶ …
                                   └─ attempts == max_attempts, or a permanent error ──▶ DEAD
DEAD / FAILED ──POST /notifications/{id}/retry──▶ PENDING (attempts reset)
```

* **Claim**: `SELECT … WHERE status IN (PENDING, FAILED) AND next_attempt_at <= now … FOR UPDATE SKIP LOCKED` — several notification instances share the queue safely; `SENDING` rows older than the stuck timeout are reclaimed.
* **Concurrency**: up to `NOTIFICATION_CONCURRENCY` mails in flight (`asyncio.gather` + `Semaphore`).
* **Permanent failures** (`EmailDeliveryError(permanent=True)`: `550` recipient refused, template errors) go to `DEAD` immediately — retrying cannot help.
* **Attempt log**: every try inserts a `notification_attempts` row (time, success, error ≤ 500 chars, duration ms); `GET /notifications/{id}` returns it, plus `provider_message_id`, `attempts`, `last_error`, `sent_at`.
* **Privacy**: after `SENT`, `variables` (which may hold a reset link) are scrubbed from the row; the API never exposes `variables` at all.
* **Semantics**: delivery is *at-least-once*. If the process dies between the SMTP `250` and the `UPDATE … SENT`, the row is reclaimed and mailed again.
* Duplicate Kafka deliveries cannot create duplicate e-mails: `notifications.event_id` is unique and `processed_events` guards the consumer.

## 5. Verification (what was actually run)

`python scripts/verify_email.py` (14 checks, uses a local `aiosmtpd` server on :1025, restarts the Notification service with `EMAIL_BACKEND=smtp`, then restores it):

* real SMTP delivery → `SENT`, 1 attempt; the server received a `multipart/alternative` message with `text/plain` + `text/html` parts, correct From/To/Message-ID, dynamic variables rendered, shared HTML layout present;
* SMTP stopped → `FAILED`, attempts=1, error recorded, next attempt scheduled → SMTP started → delivered on a later attempt; attempt log shows failure(s) then success;
* SMTP down for the whole schedule with `max_attempts=4` → `DEAD` after exactly 4 attempts → `POST …/retry` (202) → `SENT`;
* `550` recipient refused → `DEAD` after 1 attempt.

Also in `scripts/e2e_verify.py`: the password-reset e-mail travels Auth → outbox → Kafka → Notification → file backend, the link's token resets the password, and the token is single-use; enrollment confirmation reaches `SENT`; unit tests render every template (HTML and text) and check escaping.

**Not verified:** a real third-party SMTP provider with TLS/authentication (the code path for `SMTP_START_TLS`/`SMTP_USERNAME` is implemented through aiosmtplib but only the plain local server was exercised), and the optional Mailpit container (the Compose `tools` profile was not started).
