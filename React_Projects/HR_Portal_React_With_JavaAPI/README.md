# HR_Portal_React_With_JavaAPI

Enterprise HR Portal front-end (React 19 + TypeScript + Vite 6) for the existing Java microservice backend
`Documents/PROJECTS_TECKSTACK/Java_Projects/HR_Portal_API` (15 Spring Boot services behind a gateway on `:9080`).

* **All 410 backend endpoints are wired to a screen** - verified by `npm run verify:coverage`
  (report: `docs/*-endpoint-coverage-report.md`, live view: *Admin -> Endpoint coverage*).
* The backend was **not modified**. The endpoint inventory, DTO types and authorisation rules are generated from the
  services' live OpenAPI specs plus the `@PreAuthorize` annotations in the Java controllers.
* Multilingual (English / Telugu / Hindi), light / dark / system theme, responsive down to phone width.

## Run it

```bash
# 1. backend (see the backend README): docker compose up -d && scripts/start-all.sh   ->  gateway on :9080
# 2. front-end
cp .env.example .env.development      # VITE_API_BASE_URL=http://localhost:9080 (the gateway - NOT 8080)
npm install                           # .npmrc sets legacy-peer-deps (jodit-react's peer range stops at React 18)
npm run dev                           # http://localhost:5173
npm run build && npm run preview      # production build served on http://localhost:4173
```

The browser always calls same-origin `/api/...`; the Vite dev / preview server proxies it to `VITE_API_BASE_URL` and drops the
`Origin` header, so no CORS configuration is needed. For a real deployment put the static `dist/` and a reverse proxy
(`location /api/ { proxy_pass http://gateway:9080; }`) behind one host - or set `VITE_USE_PROXY=false` and add the site's origin to the
gateway's `HR_CORS_ORIGINS`. If the backend is down the app still starts and shows an "HR API is unreachable" banner.

Log in with any backend account (the bootstrap `SUPER_ADMIN` from the backend's `.env`, or an HR-created user). Accounts that are
not linked to an employee record (e.g. the bootstrap admin) get the management screens but not the self-service ones - the backend
answers 403 for those, so the UI hides them.

| Script | Purpose |
|---|---|
| `npm run dev` / `build` / `preview` | Vite dev server, `tsc -b && vite build`, preview of the build |
| `npm run generate:api` | re-generate `src/api/{generated,types,services}` from `openapi/*.json` (+ `@PreAuthorize` from the Java sources) |
| `npm run verify:coverage` | scan the UI for operation ids, rewrite `src/coverage/coverage.generated.json` and the coverage report |

To refresh the inventory after a backend change: start the gateway, `curl localhost:91xx/v3/api-docs > openapi/91xx.json`
for the 15 services (ports 9101-9115), then `npm run generate:api && npm run verify:coverage`.

## How the 410 endpoints are integrated

`src/api/generated/operations.ts` is the machine-readable inventory (id `service.operation`, method, path, parameters, request schema,
response type, `@PreAuthorize` rule). On top of it three small building blocks turn *any* operation into UI, so every endpoint is a real
user-facing workflow rather than an unused API function:

| Component | What it does |
|---|---|
| `OpForm` / `OpDialog` / `OpButton` | schema-driven form from the OpenAPI request schema (Zod rules built from the Bean-Validation constraints), reference pickers (employee autocomplete, department / project / customer selects), rich-text fields, multipart upload, server `fieldErrors` mapped onto inputs; the button hides itself when the user fails the backend's `@PreAuthorize` rule |
| `OpTable` / `DataTable` | server-side paging / sorting / search for `PageResponse` endpoints, client-side for arrays, column picker, row selection + bulk actions, CSV / Excel / PDF export, id -> name resolution |
| `OpView` / `CrudSection` | detail card or list + create / edit / delete for a resource; asks for required query parameters itself |

Feature pages (`src/features/*`) compose these with purpose-built views: dashboard charts, org chart tree, leave / attendance /
holiday / timesheet calendars, the editable weekly timesheet grid, payslip download / print, resignation workflow stepper, approval
center, reports with auto charts, API explorer, user & role administration.

## Stack and who owns what

| Concern | Library | Used for |
|---|---|---|
| Server state | **TanStack Query** | every API read / write, cache keys `['api', service, opId, path, query]`, invalidation per service |
| Auth + permissions | **Redux Toolkit** | session status, `/auth/me` profile (roles, permissions), app settings (currency, week start) |
| UI preferences | **Zustand** (persisted) | sidebar, nav groups, table column prefs, dashboard widget order / visibility, recent searches, timesheet drafts, backend-online flag |
| Theme / language / config | **React Context** | `ThemeContext` (light / dark / system -> CSS vars, Bootstrap, MUI), `LanguageContext` (i18next + Intl formatters), `ConfigContext` |
| Components | **shadcn-style** (Radix + CVA + Tailwind) | button, card, badge, input, modal, tabs, tooltip |
| Complex widgets | **Material UI** | autocomplete, menus, popovers, drawer, stepper, avatar |
| Layout / reset | **Bootstrap 5** (reboot + grid + utilities, no component CSS) | page grid, spacing helpers |
| Utilities | **Tailwind 3** (preflight off, `important: true`, loaded after Bootstrap) | component styling; colours come from RGB-channel CSS variables |
| Custom CSS | **Sass** | design tokens (`global.scss`), tables, org tree, skeletons |
| Forms | React Hook Form + Zod | all forms; rules derived from backend constraints |
| Charts | Recharts | dashboard, reports, payroll, performance, exits |
| Motion | `motion` | page transitions, sidebar, modals, rows, dashboard widgets, org-chart expand |
| i18n | i18next + react-i18next | `en` / `te` / `hi`, persisted, Intl dates / numbers / currency |
| Rich text | Jodit (lazy) + DOMPurify | decisions, comments, evaluations; HTML is sanitised on the way out **and** when rendered (`SafeHtml`) |
| Export | SheetJS, jsPDF (lazy) | table exports; CSV cells are guarded against formula injection |

Styling rule of thumb: shadcn-style primitives and Tailwind for components, MUI only where a complex widget is needed, Bootstrap for
the page grid and spacing, Sass for tokens. All of them read the same palette (`--hr-*-rgb` variables), so light / dark stay consistent.

## Security notes

* Tokens: the backend returns JWTs in the JSON body (no cookie mode), so the 30-minute **access token lives only in memory** and the
  rotating **refresh token in `sessionStorage`** (gone when the tab closes). One single-flight refresh serves all concurrent 401s
  (refresh tokens rotate and re-use revokes the family); a failed refresh logs the user out; no refresh loops.
* After a password change the backend revokes every token, so the app clears its session locally (no logout call).
* `must change password` accounts are forced to `/change-password` by the route guard; the strong-password rule mirrors the backend's.
* XSS: no raw HTML rendering anywhere except `SafeHtml` (DOMPurify). CSV export neutralises `= + - @` prefixes.
* UI permissions mirror `@PreAuthorize` for convenience only; the API enforces everything. Secrets are never in the bundle.
* The API explorer is limited to `HR_ADMIN` / `SUPER_ADMIN`, refuses session-critical operations, asks for confirmation before any
  non-GET request and masks token / password fields in responses.

## Backend behaviours worth knowing (found while testing against the live system)

* `GET /employees`, `POST /employees/lookup` and `GET /employees/{id}[/summary]` answer **500** when the result contains a row whose
  encrypted PAN was written in another format (the dev DB is shared by the Java, Node and .NET stacks - `Illegal base64 character`).
  The UI degrades instead of failing: the employee list falls back to the directory, name look-ups fall back to per-id summaries.
* Bean-Validation `@NotBlank` appears in OpenAPI as `minLength: 1` (not in `required`) - enforced as required by the forms.
  Some rules (e.g. allocation `role` is required) are not in the schema; the server's `fieldErrors` are shown on the field.
* Business rules surface as toasts: time can only be booked on ACTIVE projects, allocations cannot exceed 100 %, leave dates cannot
  overlap, onboarding an employee auto-provisions a login (`empNNNNN`, must change password).
* Some GET endpoints need parameters the spec marks required (`timesheets/tasks` needs `projectId`, `tax/monthly-tds` needs
  `employeeId`, `leaves/unpaid-days` needs `employeeId` + `month`) - `OpView` asks for missing required parameters instead of sending a request that would 400.
* Self-service endpoints (`/me`, check-in, apply leave ...) answer 403 for accounts that are not linked to an employee record.

## Verification performed

Built with `tsc -b && vite build` (no errors). Exercised against the running 16-process backend with a real Chrome (Playwright, ad hoc,
not committed): login / forced password change / forgot + reset password / logout / route guard; every route and every tab for an
admin, a manager and an employee (no HTTP errors except legitimate business ones, no error boundaries, no horizontal overflow at
390 px and 1440 px); customer -> project -> allocation -> weekly timesheet save / submit / approve; leave apply -> manager approve with a
rich-text comment; check-in; department create / delete; manager change; Telugu / Hindi / dark mode; global search; CSV export; API
explorer execution; service health. There is no automated test suite in the repository.

More detail: `docs/*-architecture-and-guidelines.md`.
