# 22 · Lazy loading and performance

## 1. Concept explanation
Lazy loading splits the app into chunks fetched on demand (`loadComponent` / `loadChildren`), shrinking the first download. Preloading strategies decide which lazy chunks to fetch in the background. Other levers: OnPush, `track`, memoised derived state, caching shared data, and bounded concurrency.

## 2. Angular API / syntax
```ts
{ path: 'employees', data: { preload: true }, loadChildren: () => import('./features/employees/employees.routes').then(m => m.EMPLOYEE_ROUTES) }
provideRouter(routes, withPreloading(SelectivePreloadingStrategy))
export class SelectivePreloadingStrategy implements PreloadingStrategy { preload(route, load) { return route.data?.['preload'] ? load() : of(null); } }
```

## 3. Where it is implemented in EMS
| Technique | Implementation |
|---|---|
| Lazy routes for every feature | `app.routes.ts` (`loadChildren` × 8, `loadComponent` × 10), feature `*.routes.ts` (`loadComponent` per screen). Production build: **~80 lazy chunks**; e.g. the employee form chunk ≈ 27 kB, user list ≈ 30 kB, calendar ≈ 18 kB |
| **Custom preloading strategy** | `core/preloading.ts`: preloads only routes flagged `data.preload` (dashboard, employees, attendance, leaves — the first screens after login); admin/report/user bundles load on demand |
| Small initial bundle | production: **≈1.0 MB raw / ≈260 kB transferred** initial (Angular + Material core + shell), budgets enforced in `angular.json` (warn 1.5 MB / error 3 MB) |
| OnPush + signals | see 19 |
| `shareReplay` caching of reference data | `reference-data.service.ts` — departments, designations, leave types fetched once per session, invalidated after edits |
| Blob cache for avatars | `picture.service.ts` — one request per employee, object URLs revoked on change |
| Debounce + cancellation | search, autocomplete, filters (`debounceTime`, `switchMap`) |
| Bounded parallelism | CSV export: `mergeMap(fn, 3)` |
| Avoid chart weight on every route | `ng2-charts`/Chart.js only in the dashboard chunk |
| No heavy template functions | derived view-models via `computed` |
| Fonts/icons bundled (no CDN) | `@fontsource/roboto`, `material-icons` in `angular.json` styles |

## 4. Relevant file paths
`src/app/app.routes.ts`, `src/app/core/preloading.ts`, `src/app/app.config.ts`, `angular.json` (budgets), `src/app/core/services/reference-data.service.ts`.

## 5. Practical implementation explanation
* **Selective preloading** is the compromise between “load nothing until clicked” (slow first click) and `PreloadAllModules` (wastes bandwidth on admin screens an employee never opens): flag the likely-next routes with `data: { preload: true }`.
* **Measured, not guessed.** `ng build` output was used to confirm chunking: initial `main` ≈ 82 kB; large third-party code (Chart.js, Material table/datepicker) is shared in common chunks or confined to the screen that needs it.
* **Request economy.** Dashboard = 4 parallel calls (3 for employees); dropdown data = 3 cached calls per session; avatars cached; polling = one tiny `/unread-count` call per 30–60 s and skipped when logged out.
* **Retry only where safe**; `timeout` prevents hung requests from keeping spinners forever.

## 6. Why this concept was selected
The app has 14 feature areas but each user needs 2–4 of them; lazy loading keeps first load small while preloading hides latency for the common paths.

## 7. Interview-related considerations
* *Preloading strategies:* `NoPreloading` (default), `PreloadAllModules`, custom (data flags, network-aware, role-aware).
* *Why can lazy loading + guards leak bundles?* `canActivate` runs after the chunk is requested; use `canMatch` to avoid downloading code a user can't use (here the bundle contains no secrets — the backend is the authority).
* *Where does bundle weight come from?* Libraries (Material, Chart.js), not your code; inspect with `ng build --stats-json` + a visualizer.
* *Performance checklist:* OnPush, `track`, avoid function calls in templates, cache HTTP, cancel stale requests, lazy routes, optimise images (profile pictures are capped by the backend at 2 MB).
* *Budgets* turn bundle growth into a CI failure instead of a surprise.
