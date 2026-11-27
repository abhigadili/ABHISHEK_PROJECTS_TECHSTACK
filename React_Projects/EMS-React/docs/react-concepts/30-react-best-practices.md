# 30 · React best practices (as practised in EMS-React)

## 1. Concept explanation
Best practices are not rules for their own sake — each one below exists because ignoring it caused (or would cause) a bug, a slow screen, or an
unmaintainable file. For every item: *the practice*, *where this project follows it*, and *the evidence*.

## 2. Syntax / checklist
```
Components  → small, pure render, typed props, composition over flags, lift state only as far as needed
State       → one owner per fact; derive instead of copy; server state ≠ client state; URL for shareable state
Effects     → only for syncing with the outside world; always clean up; never for derived data or events
Performance → measure first; render less before memoising; stable keys; split code by route
Forms       → schema-validated, server errors mapped back, never trust the client
Security    → UI auth is UX; the API enforces; no raw HTML; tokens handled deliberately
Testing     → behaviour over implementation; mock the network not your modules; E2E for wiring
Accessibility → semantic HTML, labels, roles, focus, live regions, keyboard
```

## 3. Actual EMS implementation
| Practice | How EMS applies it | Where |
|---|---|---|
| **Functional components + Hooks only** | one deliberate class (`ErrorBoundary`, required by React) and one labelled legacy demo | `components/common/ErrorBoundary.tsx`, `features/lab/patterns/LegacyCounter.tsx` |
| **Feature-based structure** | each feature owns its pages/components/hooks; shared UI in `components/`; API in `services/`; docs map concept → file | `src/features/*`, `src/components/*` |
| **Single source of truth per fact** | token store, Redux session, RTK cache, URL filters; logout resets everything | doc 04, `app/store/store.ts` |
| **Don't derive state in effects** | `useMemo`/selectors; `key` to reset forms | `Sidebar.tsx`, `store/selectors/*`, `EmployeeFormPage` |
| **Clean up side effects** | abort on unmount, clear timers/listeners | `useApi`, `useNotifications`, `ToastHost`, `DashboardPage` |
| **Stable `key`s** | ids, `field.id`; never indexes for dynamic lists | `DataTable`, `OrgTree`, `FieldArraySections` |
| **Controlled inputs where the UI depends on the value; RHF for big forms** | doc 10/11 | `SearchBox`, `EmployeeFormPage` |
| **Validate input, but never trust it** | Zod on the client mirroring server rules; server errors mapped to fields; 409 → field | `schemas/*`, `EmployeeFormPage` |
| **Handle every async state** | loading (skeleton/spinner), empty, error + Retry, success toast — in every data screen | `DataTable`, `Feedback.tsx` |
| **Error handling layers** | try/catch in handlers, query `isError`, interceptor for systemic errors, boundary for render crashes | docs 17, 24 |
| **Security hygiene** | no `dangerouslySetInnerHTML`; React escapes text; CSV export neutralises `= + - @` formulas; uploads type/size-checked client-side and re-checked by the API; no secrets in `VITE_*`; no credentials in source; `.env` git-ignored; tokens only to our origin; object URLs revoked | `utils/csv.ts`, `FileUpload.tsx`, `.env.example`, `httpClient.ts` |
| **Accessibility** | `aria-label`s, `aria-current`/`aria-expanded` on the org chart, `role="alert"`/`status`, labelled inputs via `useId`, focus-trapped dialogs, keyboard-operable controls, live regions for toasts/month nav | `fields.tsx`, `OrgTree.tsx`, `ToastHost.tsx`, `MonthNav.tsx` |
| **Responsive design** | MUI breakpoints (`xs/sm/md`) for grids; temporary drawer on phones; columns hidden below breakpoints (`hideBelow`); calendar cells shrink; SCSS media queries for the org chart | `Sidebar.tsx`, `DataTable.tsx`, `styles/main.scss` |
| **Typed boundaries** | API types, Zod-inferred form types, typed Redux/hook wrappers | doc 28 |
| **Naming & conventions** | `use*` hooks, `*Page.tsx` routes, `*Api.ts` services, `*Slice.ts`; Prettier + ESLint (`react-hooks` rules **error**) | `.prettierrc`, `eslint.config.js` |
| **Fail loudly in dev, quietly in prod** | guard hooks throw helpful errors; dev-only Redux logger; StrictMode on | `useAuth`, `rejectedThunkLogger`, `main.tsx` |
| **No mock data in production** | fixtures live only under `src/test/`; the app talks only to the real API | `src/test/`, build output |
| **Document trade-offs** | where something can't be done properly (education/experience storage; refresh token in `localStorage`; polling instead of push) the UI/docs say so | `QualificationsView.tsx`, doc 17, `backend-api-integration.md` |

## 4. Relevant file paths
Whole project; start at `README.md`, `docs/backend-api-integration.md`, `docs/react-concepts/EMS-REACT-CONCEPT-MAPPING.md`.

## 5. Practical implementation — a review checklist you can reuse
Before merging a React change ask:
1. **Is this state needed, and who owns it?** (derive it? URL? server cache? local?)
2. **Does every effect have a cleanup, and could it be an event handler / `useMemo` / `key` instead?**
3. **What are the loading, empty, error and permission-denied states?** (Are they tested?)
4. **Could the server say "no" here?** (Map its error back to the user's input.)
5. **Does the list use stable keys and bounded DOM size?**
6. **Is the label/role/focus story correct for a keyboard + screen-reader user?**
7. **What would the test assert from the user's point of view?**
The seven bugs listed in doc 29 each violated one of these.

## 6. Why the concept is used
Teams ship faster when the defaults are right: fewer production surprises, easier onboarding (a new developer can follow doc → file → test for any
concept), and safer refactors.

## 7. Advantages and limitations
**+** consistent, testable, secure-by-default, learnable. **−** some practices cost effort (explicit loading/error states everywhere, typed generics, two-layer authorization) and can be over-applied (memoising everything, splitting every 10-line component). Pragmatism: this app uses a Lab for rarely-needed concepts instead of forcing them into business screens; known gaps are listed in the README and the completion report (no coverage gate, no i18n, no React Compiler, refresh token in `localStorage`, no prefetching of lazy routes).

## 8. Interview-related considerations
* "How do you structure a large React app?" (feature folders, shared UI, API layer, tests alongside.)
* "How do you avoid unnecessary re-renders / decide what to memoise?" (measure; colocate; stable props.)
* "Where do you put server data vs UI state?" "How do you handle auth tokens and route guards?"
* "How do you make a form accessible and resilient?" "What do you test, at which level?"
* "What would you change for scale?" (prefetching, Suspense data, React Compiler, shared validation schema, HttpOnly cookies, observability, i18n, design-system package.)
