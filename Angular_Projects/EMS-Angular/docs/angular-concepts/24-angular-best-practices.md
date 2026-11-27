# 24 · Angular best practices (as applied in EMS)

## 1. Concept explanation
A short, opinionated checklist of the practices this codebase follows, each with the file that proves it. Where a practice has a trade-off, the choice made is stated.

## 2–5. Practices, with evidence

### Architecture
| Practice | Evidence |
|---|---|
| Standalone components, no custom NgModules | all components; routes lazy-load components/route arrays |
| Feature folders + thin `core`/`shared` | `src/app/{core,shared,features,layout}` (see README tree) |
| One service per feature; `ApiService` only does transport | `core/services/*` |
| Backend is the single source of truth — no business rules, no mocks | `docs/backend-api-integration.md`; the only local data (education/experience, UI prefs) is labelled in the UI |
| Typed API models, **no `any`** | `core/models/*.ts`; ESLint `no-explicit-any: error` (lint passes) |
| Strict TypeScript + strict templates | `tsconfig.json` (`strict`, `noImplicitReturns`, `noPropertyAccessFromIndexSignature`, `strictTemplates`) |
| Environment config via tokens | `API_BASE_URL`, `APP_CONFIG` |

### State
| Practice | Evidence |
|---|---|
| Signals for UI/session state, RxJS for async flows; no NgRx | 06 |
| Derive with `computed`, side-effect with `effect` | `permission.service.ts`, `preferences.service.ts` |
| Don't duplicate server data in global state | feature stores hold one list; reference data cached with `shareReplay`, invalidated on write |
| URL as state for lists | `employee-list.component.ts` |

### Templates & performance
| Practice | Evidence |
|---|---|
| New control flow with `track` | all templates |
| OnPush by default | 19 |
| No logic-heavy template calls; pure pipes; `computed` view-models | 15/16 |
| Accessible by default: labels, `aria-*`, keyboard handlers, focus the first invalid field | `org-node` (`aria-expanded/selected`, `role="tree"`), `employee-form` (`viewChildren` focus), `data-table` rows (`tabindex`, `keydown.enter`); `@angular-eslint/template` accessibility rules enabled |
| XSS-safe rendering: no `innerHTML`, no `bypassSecurityTrust*` | grep-verifiable; user text is only interpolated |

### Forms
| Practice | Evidence |
|---|---|
| Typed Reactive Forms for business forms; template-driven only for the flat settings form | 07/08 |
| Frontend validation mirrors, never replaces, backend validation; server `details[]` mapped to controls | `employee-form.component.ts#applyServerErrors` |
| Unsaved-changes protection | `unsavedChangesGuard` |

### HTTP & security
| Practice | Evidence |
|---|---|
| Functional interceptors; token only to the API origin; single shared refresh; no loops | 17 |
| Access token in memory, refresh token in `sessionStorage`; logout revokes server-side | `auth.service.ts`, `token-storage.service.ts` |
| Open-redirect-safe `returnUrl` | `login.component.ts` |
| Uploads validated client-side (type/size) *and* server-side | `file-upload.component.ts` |
| CSV export neutralises formula injection | `shared/utils/csv.ts` (tested) |
| UI permission checks are advisory; 403s handled gracefully | directives/guards + `errorInterceptor` |
| No secrets committed; credentials via env; `.gitignore` for `.env*` | `.gitignore`, `e2e/helpers.ts` |

### Testing & tooling
| Practice | Evidence |
|---|---|
| Tests for pipes, validators, directives, services, interceptors, guards, components + real-backend E2E | 23 |
| ESLint + Prettier + budgets | `eslint.config.js`, `.prettierrc`, `angular.json` |
| Reproducible E2E data | `e2e/seed.mjs` (idempotent) |

### Internationalisation readiness
* Text that must be translatable on the login screen is marked with `i18n="@@id"` and `@angular/localize` is installed/polyfilled (`angular.json`, `tsconfig.*`), so `ng extract-i18n` works.
* Dates, numbers and currency go through locale-aware pipes (`date`, `currency`, `number`) and `toLocaleString(undefined, …)`; no hard-coded date formats beyond pipe options.
* **Not done (stated honestly):** translations files and a locale switcher — only the groundwork exists; remaining static strings are not yet `i18n`-tagged.

## 6. Why these practices
They remove whole classes of bugs seen during this build (stale resolver data, async-validator timing, refresh stampede, null into NOT NULL columns) and keep each concept testable.

## 7. Interview-related considerations
* *“How do you structure a large Angular app?”* Feature folders, lazy routes, a thin core, shared presentational components, one service per backend area.
* *“How do you manage state without NgRx?”* Signals for local/session state, RxJS for async, feature stores scoped with DI; escalate to NgRx only for cross-feature event sourcing/time-travel needs (none here).
* *“How do you secure an Angular app?”* The browser can't be trusted — backend authorisation, safe token handling, no `innerHTML`, CSP/headers server-side, dependency hygiene.
* *“What do you do about stale cached data?”* Invalidate on write (`ReferenceDataService.invalidate`), re-run resolvers when necessary, or publish fresh entities into a shared state.
* *“What would you do next?”* Backend endpoints for education/experience/skills/preferences/users (see `backend-api-integration.md` §7), SSE notifications, translations, zoneless CD.
