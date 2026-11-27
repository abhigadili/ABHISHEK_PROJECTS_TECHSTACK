# CityCare HMS — Hospital / Healthcare Management (full-stack Next.js 16)

One Next.js 16 application (App Router, React 19, TypeScript strict) that contains **both the UI and the backend**: REST Route Handlers (`/api/v1/**`), Server Actions, services, repositories and a MySQL database accessed through **Prisma 6**. No separate Node/Express service exists.

Ten domain modules (patients, doctors, appointments, hospitals, medical records, prescriptions, laboratory, billing, pharmacy, notifications) each have their own Zod schemas, service, repository, Route Handlers, Server Actions, pages and authorization rules. Auth: JWT access tokens + rotating refresh tokens (HttpOnly cookies), RBAC with DB-stored permissions, resource-level checks, TOTP MFA with recovery codes, Google OAuth 2.0 (authorization code + PKCE), password reset, audit log.

## Quick start

```bash
cd Documents/PROJECTS_TECKSTACK/NextJS_Projects/HospitalManagement_FE
npm install                       # also runs `prisma generate`
cp .env.example .env.local        # fill in the values (see below)
cp .env.local .env                # the Prisma CLI reads .env
npm run db:migrate                # creates the schema in MySQL (prisma/migrations)
npm run db:seed                   # roles, permissions, 2 hospitals, doctors, medicines, tests, demo accounts
npm run dev                       # http://localhost:3000
```

Production: `npm run build && npm run start`.

### Database
Create an empty database first (`CREATE DATABASE hospital_fe CHARACTER SET utf8mb4;`) and set `DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/hospital_fe`.
No MySQL handy? `scripts/dev-mysql.sh` starts a private local MySQL 8 on `127.0.0.1:3307` (needs the `mysqld` binary) and creates the database; use `DATABASE_URL=mysql://root@127.0.0.1:3307/hospital_fe`.

### Environment variables (`.env.example` documents each one)
| Variable | Purpose |
|---|---|
| `DATABASE_URL` | MySQL connection string (server only) |
| `JWT_ACCESS_SECRET` | HS256 secret for access tokens (≥ 32 chars: `openssl rand -base64 48`) |
| `REFRESH_TOKEN_PEPPER` | mixed into the SHA-256 of stored refresh tokens |
| `MFA_ENCRYPTION_KEY` | base64 32-byte key encrypting TOTP secrets at rest (AES-256-GCM): `openssl rand -base64 32` |
| `ACCESS_TOKEN_TTL_SECONDS`, `REFRESH_TOKEN_TTL_DAYS`, `COOKIE_SECURE` | token lifetimes; `COOKIE_SECURE=true` behind HTTPS |
| `OAUTH_GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI` | enable Google sign-in (leave empty to disable; the UI says so) |
| `SMTP_HOST/PORT/USER/PASSWORD/FROM` | e-mail provider; empty host = e-mails are printed to the server console |
| `PAYMENT_PROVIDER`, `INVOICE_TAX_RATE` | `demo` = built-in gateway (no card data stored); tax % applied after discount |
| `UPLOAD_DIR`, `MAX_UPLOAD_MB` | where medical documents / lab reports are stored (outside `public/`) |
| `SEED_DEFAULT_PASSWORD` | password given to every seeded account (quote it if it contains `#`) |
| `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_NAME` | public, non-secret |

### Demo accounts (created by the seed, password = `SEED_DEFAULT_PASSWORD`)
`superadmin@hms.local` · `admin@hms.local` (Hospital Admin) · `reception@hms.local` · `doctor@hms.local` (Cardiology) · `gp@hms.local` · `peds@hms.local` · `ortho@hms.local` · `patient@hms.local` · `lab@hms.local` · `pharmacist@hms.local` · `billing@hms.local`. Patients can also self-register at `/register`.

## Where things live
```
prisma/                 schema.prisma (38 tables), migrations/, seed.ts
src/app/                (public) (auth) (patient) (doctor) (admin) (lab) (pharmacy) (billing) (superadmin) (account), api/v1/**, proxy.ts at src/
src/server/             db, auth (session/tokens/mfa/oauth), authorization (rbac/access), repositories, services, http (route/action helpers)  — `server-only`
src/features/<module>/  Server Actions + client components per module
src/lib/                shared Zod validations, constants (RBAC catalogue, navigation), configuration
src/store/              Redux Toolkit (booking workflow) + Zustand (UI prefs)
```

## Notes
* Money is `DECIMAL(10,2)`. Card numbers/CVV are **never** sent to or stored by the server — only the method and the last four digits.
* Public pages (hospital/doctor directory) are cached (ISR + `unstable_cache` with tags). Patient, record, prescription, billing and notification data is always dynamic (`private, no-store`).
* Appointment slots are computed in the **server's local time zone**; run the server in the hospital's time zone.
* Appointment reminders are triggered on demand (Admin → Appointments → *Send reminders*, or `POST /api/v1/notifications/reminders`); wire it to a scheduler in production.
* This request intentionally did not generate the `documentation/` folder or any automated tests.
