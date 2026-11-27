# Architecture and UI guidelines

## 1. Source layout

```
src/
  api/
    generated/operations.ts   410 operation definitions (generated)        <- inventory, authz rules, request schemas
    types/<service>.ts        DTO interfaces from OpenAPI components        <- generated
    services/<service>Api.ts  one typed function per endpoint               <- generated (authApi, employeeApi, leaveApi ...)
    client/                   axios.ts (interceptors, single-flight refresh), call.ts (generic caller), tokens.ts, errors.ts
  app/                        App, providers (Redux, Query, Theme, Language, Config, Auth bootstrap), router + guards, env config
  store/redux/                authSlice, settingsSlice          store/zustand/  uiStore, connectionStore
  contexts/                   ThemeContext, LanguageContext (Intl formatters), ConfigContext
  components/
    ui/                       shadcn-style primitives (button, card, badge, input, dialog, tooltip, tabs, skeleton)
    op/                       OpForm, OpDialog, OpButton, OpView, CrudSection, DownloadButton, EmployeeScope, refs, employees, useOp
    forms/                    SchemaFields (OpenAPI schema -> inputs), schemaZod (constraints -> Zod)
    tables/                   DataTable (TanStack Table), OpTable
    charts/ common/ layout/ feedback/ editors/ dialogs/
  features/<module>/          one folder per backend domain (employees, leaves, attendance, payroll, tax, performance, ...)
  i18n/locales/{en,te,hi}/    common, nav, auth, fields, hr, ui
  coverage/                   generated endpoint-coverage registry (consumed by the Admin pages)
  styles/                     global.scss (tokens, Bootstrap subset, Sass), tailwind.css, muiTheme.ts
scripts/                      generate-api.py, verify-coverage.mjs        openapi/  15 specs exported from the running services
```

## 2. Data flow of one request

`OpButton op="leave.apply"` -> `canCall()` evaluates the Java `@PreAuthorize` string against the user's roles / permissions (hides the button
if it fails) -> `OpDialog` -> `OpForm` builds the form from `OPERATION_MAP['leave.apply'].bodySchema`, validates with Zod -> `useOpMutation`
-> `call('leave.apply', {body})` -> Axios (`Authorization` header, 30 s timeout) -> gateway. Success: invalidate `['api','leave']`
(plus any extra services), toast; error: 4xx `fieldErrors` mapped onto inputs, other messages as a toast, network errors set the
global "API unreachable" banner (`connectionStore`).

Query keys are `['api', service, opId, path, query]`, so a mutation refreshes everything of that service without bookkeeping.

## 3. Authentication

* `POST /auth/login` -> `{accessToken, refreshToken, mustChangePassword, user}`; `/auth/me` is then read for the authoritative roles and permissions.
* Access token in memory, refresh token in `sessionStorage`; on a 401 the interceptor refreshes once (shared promise) and replays the request.
  A failed refresh calls `tokens.forceLogout()` -> Redux `sessionEnded`, query cache cleared, toast, redirect by `RequireAuth`.
* `RequireAuth` (anonymous -> `/login` with return path; must-change-password -> `/change-password`), `PublicOnly`, `RequireAccess` (roles / operation based).
* Registration is informational only: the backend exposes `POST /auth/register` for HR / SUPER_ADMIN, so it lives in *Admin -> Users -> Create user*.
* Forgot / reset password use the backend's flow; when the backend runs with `HR_EXPOSE_RESET_TOKEN=true` the token is shown (development only).

## 4. Authorisation in the UI

`utils/permissions.ts` evaluates `hasRole / hasAnyRole / hasAuthority / hasAnyAuthority` joined by `or` / `and`; anything it cannot evaluate
(ownership beans such as `@authz.isSelfOrHr(#employeeId)`) counts as allowed and the backend decides. Permissions come as `EMPLOYEE_WRITE` (the
evaluator accepts the `PERM_` prefix too); `SUPER_ADMIN` passes every role check. Self-service operations (`/me` paths and a short list) are
additionally hidden for accounts without an employee link. The sidebar uses the same rules (`constants/nav.ts`).

## 5. UI library responsibilities

| Library | Rule |
|---|---|
| shadcn-style (Radix + CVA + tailwind-merge) | default for buttons, inputs, cards, badges, dialogs, tabs - `cn()` merges class conflicts, so pass `w-auto` rather than `!w-auto` |
| Material UI | only complex widgets: Autocomplete, Menu, Popover, Drawer, Stepper, Avatar, Checkbox |
| Bootstrap | reboot, `row` / `col-*` grid, spacing and flex helpers - **no** component CSS (`btn`, `card`, ...) |
| Tailwind | utilities, `important: true` and loaded after Bootstrap so it wins name clashes (`p-3`, `bg-primary`); preflight is off, `global.scss` restores border defaults |
| Sass | tokens (`--hr-*-rgb` triplets, derived `--hr-*` colours, Bootstrap variable overrides), tables, calendar / tree helpers |

Pitfalls fixed while building (keep in mind when extending): Radix modals set `pointer-events:none` on `<body>`, so MUI portals need
`pointer-events:auto` and the dialog must ignore "outside" interactions on `.MuiPopper-root`; modal z-index (1200) must stay below MUI's popper layer
(1300); grid / flex children need `min-width:0` or a wide table stretches the page; raw `<button>` needs `bg-transparent`.

## 6. Dashboard

KPI cards and charts use report endpoints (`reporting.*`), `attendance.daily`, `leave.*`, `holiday.upcoming`, `payroll.list`, `exit.summary`. Nothing is
fabricated: a widget whose operation the user may not call is not shown. Month and department filters apply to every widget that supports them
(department filter narrows headcount / attendance / on-leave); widgets can be hidden and reordered (Zustand, persisted per browser). Linked
employees additionally get *My day* (check-in / out, balances) and *My overview* (`dashboard/employee`); managers get *My team* (`dashboard/manager`).

## 7. Internationalisation

`en` is the default and fallback. Namespaces: `common`, `nav`, `auth`, `fields` (form labels by DTO field name, humanised when missing),
`hr` (page titles, KPI labels, statuses) and `ui` - a flat "English phrase -> translation" dictionary that `Tabs`, `CardTitle`, `Modal`, `OpButton`
translate automatically, so module pages keep readable English literals. Dates, numbers and currency go through `LanguageContext` (`Intl`, `en-IN` / `te-IN` /
`hi-IN`); Inter + Noto Sans Telugu / Devanagari are loaded for correct rendering. Operation summaries that come from the OpenAPI spec (dialog subtitles)
stay English because they originate in the backend.

## 8. Performance

Route-level lazy loading; manual vendor chunks (react, mui, charts, editor, state, forms, i18n, motion, icons); SheetJS / jsPDF are only loaded when
exporting, Jodit only when an editor opens; 30 s query stale time, no refetch on focus; debounced search (300-350 ms); sticky-header tables with server paging;
employee names resolved with one cached bulk lookup per table.

## 9. Adding a backend endpoint later

1. Export the service's `/v3/api-docs` into `openapi/`, run `npm run generate:api` (types, `<service>Api`, inventory, authz).
2. Put an `OpButton` / `OpTable` / `OpView` for the new operation id on the relevant page.
3. `npm run verify:coverage` - the report fails loudly (lists the id) until a screen references it.
