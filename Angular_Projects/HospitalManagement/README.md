# Hospital Management – Angular frontend

An enterprise Hospital / Healthcare Management web application built with **Angular 19.2** (standalone components, Signals, zoneless change detection, NgRx 19, RxJS 7.8). It is a pure frontend for the **existing Node.js microservice backend** (`~/Documents/PROJECTS_TECKSTACK/NodeJS_Projects/HospitalManagement`), which it reaches only through the API gateway on `http://localhost:30080`. The backend, its MySQL databases, Kafka, Redis and gRPC were **not** modified or accessed directly.

| Document | Content |
|---|---|
| [ANGULAR_ARCHITECTURE.md](ANGULAR_ARCHITECTURE.md) | layers, folder structure, bootstrap, routing, providers, UI-library split |
| [ANGULAR_CONCEPTS_IMPLEMENTATION.md](ANGULAR_CONCEPTS_IMPLEMENTATION.md) | every Angular concept → exact file(s) |
| [SIGNALS_IMPLEMENTATION.md](SIGNALS_IMPLEMENTATION.md) | Signals, `resource`, `linkedSignal`, signal forms, interop |
| [NGRX_IMPLEMENTATION.md](NGRX_IMPLEMENTATION.md) | Store, Effects, Entity, Router Store, Component Store, Signal Store |
| [RXJS_IMPLEMENTATION.md](RXJS_IMPLEMENTATION.md) | operators and subjects → where and why |
| [API_INTEGRATION_DOCUMENTATION.md](API_INTEGRATION_DOCUMENTATION.md) | gateway, endpoints, roles, **unavailable backend features** |
| [BUSINESS_FLOWS.md](BUSINESS_FLOWS.md) | the six business scenarios step by step |
| [IMPLEMENTATION_CHANGELOG.md](IMPLEMENTATION_CHANGELOG.md) | what was built, verification results, defects found, limitations |

## Prerequisites
* Node.js 20.11+ → this is why the project uses **Angular 19.2** (Angular 20/21 need a newer Node 20.19/22).
* The backend must be running (`NodeJS_Projects/HospitalManagement/scripts/start-all.sh`); the gateway listens on **:30080**.

## Run
```bash
npm install
npm start                 # ng serve → http://localhost:4300 (proxy /api → http://localhost:30080, see proxy.conf.json)
npm run build             # production build → dist/hospital-management
```
There are **no** automated tests, linters or monitoring/infrastructure files – explicitly out of scope of the specification.

### Configuration
Angular uses compile-time environment files, not process variables: `src/environments/environment.ts` (dev) and `environment.prod.ts`.

| Key | Default | Meaning |
|---|---|---|
| `apiBaseUrl` | `''` | `''` = same origin (the dev server proxies `/api`); or e.g. `http://gateway-host:30080` |
| `zoneless` | `true` | zoneless change detection (`provideExperimentalZonelessChangeDetection`); `false` = zone.js |
| `idleLogoutMinutes` | `30` | idle auto-logout |
| `apiTimeoutMs` | `20000` | request timeout |

The proxy target is in `proxy.conf.json`. No secrets (tokens, passwords) exist in the repository; see `.env.example`.

## Sign in (seeded backend accounts)
| Role | Username | Password |
|---|---|---|
| ADMIN | `admin` | `Admin@123` |
| DOCTOR, LAB_STAFF, PHARMACIST, BILLING_STAFF | `doctor1`, `labstaff1`, `pharmacist1`, `billing1` | `Staff@123` |
| PATIENT | self-registered at `/auth/register` | your choice (8–72 chars, upper + lower + digit) |

`doctor1`/`doctor2` are not linked to a doctor profile by the seed data; create a doctor *with a login* at `/doctors/new` (as ADMIN) to see the DOCTOR experience end to end.

## Modules and UI libraries
| Module | Route | UI library | State |
|---|---|---|---|
| Authentication | `/auth/login`, `/auth/register` | Tailwind | `AuthService` signals |
| Dashboard | `/dashboard` | Tailwind | signals + RxJS (`forkJoin`) |
| Patients | `/patients` | **Angular Material** | NgRx Store (lazy `provideState`) |
| Doctors | `/doctors` | **Angular Material** | NgRx Store + functional effects |
| Appointments | `/appointments` | **Tailwind** | NgRx Store (root) + facade |
| Hospitals | `/hospitals` | **Bootstrap** (scoped) | NgRx Store (root) + DI context |
| Medical records | `/records` | **PrimeNG** | `rxResource`, CDK virtual scroll |
| Prescriptions | `/prescriptions` | **Angular Material** | typed Reactive Forms |
| Laboratory | `/laboratory` | **PrimeNG** | NgRx **Component Store** |
| Billing | `/billing` | **Bootstrap** (scoped) | NgRx Store (lazy) + class effects |
| Pharmacy | `/pharmacy` | **PrimeNG** | NgRx **Signal Store** |
| Notifications | `/notifications` | **Tailwind** | RxJS polling service |
| Administration (isolated **NgModule**) | `/admin/users` | Tailwind | classic component + `takeUntil` |

Light and dark themes are switched in the header (`ThemeService`); Material, PrimeNG, Tailwind and Bootstrap all follow it.

## Known limitations (backend)
MFA, OAuth 2.0, password reset, HttpOnly refresh cookie, notification read flag/push, hospital facilities/branches, medicine categories, a list-all-appointments endpoint and server-side sorting **do not exist in the backend** and were not faked – details and the workaround used for each are in [API_INTEGRATION_DOCUMENTATION.md](API_INTEGRATION_DOCUMENTATION.md#unavailable-or-missing-apis).
