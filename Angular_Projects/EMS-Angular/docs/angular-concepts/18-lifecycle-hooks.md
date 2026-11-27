# 18 · Lifecycle hooks

## 1. Concept explanation
Angular calls lifecycle methods at defined moments of a component/directive's life: construction → input changes → init → content/view initialisation → checks → destruction. In the signal era many hooks are replaced by `computed`/`effect`/`afterNextRender`, but the classic hooks remain essential for DOM readiness, resource cleanup and legacy `@Input()`.

## 2. Hooks — which are implemented, where, and why

| Hook | Implemented? | Where & the real need |
|---|---|---|
| `ngOnInit` | ✔ | `shared/components/live-clock.component.ts` — starts the 1 s timer after DI/inputs are ready (the check-in card's “now”) |
| `ngOnChanges` | ✔ | `shared/components/password-strength.component.ts` — recomputes rules/level/meter whenever the classic `@Input() password` changes |
| `ngOnDestroy` | ✔ | `live-clock.component.ts` (stops the timer: `destroy$.next()` + `takeUntil`), `core/services/picture.service.ts` (`OnDestroy` → revoke blob URLs) |
| `ngAfterViewInit` | ✔ | `features/organization/organization.component.ts` — the tree exists in the DOM only after view init, so `viewReady` is set there and an effect scrolls the selected person into view (deep link `/organization/:id`) |
| `ngAfterContentInit` | ✔ | `shared/components/data-table.component.ts` — projected `<ng-template appCell>` children are available only after content init; builds the column→template map and re-builds on `QueryList.changes` |
| `ngAfterViewChecked` | ✘ (no genuine need) | not used |
| `ngAfterContentChecked` | ✘ (no genuine need) | not used |
| `DestroyRef` / `takeUntilDestroyed()` | ✔ | `search-box`, `employee-list`, `employee-details`, `employee-profile`, `employee-form`, `login` |
| `afterNextRender` | ✔ | `AutofocusDirective` (focus once rendered), scroll-into-view in the org chart |
| `effect()` cleanup | ✔ | effects are destroyed with their injector (no manual teardown) |

`ngAfterViewChecked`/`ngAfterContentChecked` run on **every** change-detection pass; the brief asks for them only “where a genuine use case exists” — none arose (nothing here needs to react to each CD pass), and adding one would only add per-cycle cost. Documented as intentionally unused.

## 3. (Where) — see table; tests: `shared/components/lifecycle-components.spec.ts`
* `PasswordStrengthComponent`: assertions that rules/level/width update on each input change and that `*ngFor` + `trackBy` keeps the same `<li>` nodes.
* `LiveClockComponent`: inside `fakeAsync`, after `fixture.destroy()` `tick(5000)` + `discardPeriodicTasks()` would fail if the timer leaked.

## 4. Relevant file paths
`src/app/shared/components/{live-clock,password-strength,data-table}.component.ts`, `src/app/features/organization/organization.component.ts`, `src/app/core/services/picture.service.ts`.

## 5. Practical implementation explanation
* **Constructor vs `ngOnInit`.** The constructor only wires DI and fields; work that depends on rendered inputs/DOM (the clock, scroll) is deferred to hooks.
* **Cleanup pairs.** Every start has a stop: `timer(0,1000).pipe(takeUntil(destroy$))` ↔ `ngOnDestroy`; blob URLs created in `PictureService` ↔ `revokeObjectURL` in `invalidate`/`ngOnDestroy` (no memory leak when avatars change).
* **No repeated API calls from hooks.** Data loading is done with `toSignal(switchMap(…))` pipelines driven by inputs/route, not `ngOnInit` + subscribe, so changing an input never duplicates requests and nothing needs manual unsubscribing.
* **View-dependent effect.** The org chart's scroll effect depends on a `viewReady` signal set in `ngAfterViewInit`, then uses `afterNextRender` so the DOM node for the selected employee exists before `scrollIntoView` is called.

## 6. Why this concept was selected
The hooks used are the ones with real jobs: timers (init/destroy), legacy input reaction (`ngOnChanges`), DOM-dependent behaviour (`ngAfterViewInit`) and projected-content discovery (`ngAfterContentInit`). Using them artificially elsewhere would be noise.

## 7. Interview-related considerations
* **Order:** constructor → `ngOnChanges` (when inputs exist) → `ngOnInit` → `ngDoCheck` → `ngAfterContentInit` → `ngAfterContentChecked` → `ngAfterViewInit` → `ngAfterViewChecked` → … → `ngOnDestroy`.
* *`ngOnChanges` only fires for template-bound inputs* — not when you mutate an object's property; signal inputs make it unnecessary (`computed`).
* *Why not set state in `ngAfterViewChecked`?* It triggers `ExpressionChangedAfterItHasBeenChecked` and loops.
* *`ngOnDestroy` vs `takeUntilDestroyed`/`DestroyRef`:* prefer the latter for subscriptions; `ngOnDestroy` for imperative cleanup.
* *Hooks and SSR:* DOM-touching code belongs in `afterNextRender`/`afterRender`, which don't run on the server.
