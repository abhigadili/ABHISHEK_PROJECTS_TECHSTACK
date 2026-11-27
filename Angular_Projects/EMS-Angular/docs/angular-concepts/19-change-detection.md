# 19 · Change detection

## 1. Concept explanation
Change detection (CD) keeps the DOM in sync with state. With **Default** strategy Angular checks every component after any async event (zone.js). With **`OnPush`** a component is checked only when an input reference changes, an event originates in its template, an `async`/signal it reads changes, or it is explicitly marked (`markForCheck`). Signals make this precise: a template that reads a signal is re-rendered when *that signal* changes.

## 2. Angular API / syntax
```ts
@Component({ changeDetection: ChangeDetectionStrategy.OnPush, … })
this.cdr.markForCheck();                    // ChangeDetectorRef
provideZoneChangeDetection({ eventCoalescing: true })
```

## 3. Where it is implemented in EMS
| Topic | Implementation |
|---|---|
| **`OnPush` everywhere** — 70 of 72 components; the two exceptions are the trivial root host `AppComponent` (`<router-outlet />`) and the template-driven settings form | `changeDetection: ChangeDetectionStrategy.OnPush` in each component |
| Signals drive rendering | `toSignal`/`computed` state read in templates (`employee-list.store.ts`, `dashboard.component.ts`) — no manual CD calls |
| **`ChangeDetectorRef.markForCheck`** | `live-clock.component.ts` — the timer mutates a plain field, so each tick marks only that view dirty |
| **`track` in `@for`** | stable ids (`track e.id`, `track child.id`, `track g` for FormArray rows) so DOM nodes are reused |
| `trackBy` (legacy) | `password-strength.component.ts` (`trackRule`) |
| **Default strategy on purpose** | `profile/settings.component.ts` — documented: `ngModel` writes happen through directive internals, not signals |
| `ViewEncapsulation.None` | `ui-basics.ts` `StatusBadgeComponent` (global badge palette by class); all others use the default `Emulated` |
| Event coalescing | `provideZoneChangeDetection({ eventCoalescing: true })` in `app.config.ts` |
| Pure pipes, `computed` view-models | avoid recomputation (see 15/16/06) |
| `ExpressionChanged…` avoidance | state changes happen in event handlers/subscriptions, never in getters/`ngAfterViewChecked` |

## 4. Relevant file paths
`src/app/app.config.ts`, `src/app/shared/components/live-clock.component.ts`, `src/app/features/profile/settings.component.ts`, `src/app/shared/components/ui-basics.ts`.

## 5. Practical implementation explanation
* **OnPush + signals = cheap lists.** The 14 list screens re-render only when their store signals change; typing in an unrelated field never re-checks the table.
* **What breaks OnPush (and how it was handled).** A mutation of a plain field that Angular can't see — the clock — needs `markForCheck()`; an `async` result written into a *plain* property in a subscription wouldn't re-render, so results are put into signals. A `FormGroup` read directly in an OnPush template (`form.invalid`) does not re-render on status change; the report panel therefore derives `formValid` from `statusChanges` via `toSignal`.
* **Debug story.** OnPush also surfaced the Material rule that `mat-error` shows only for touched controls; tests/E2E blur fields like a user.
* **Zoneless readiness.** Because state is signals/`async`/events, switching to `provideExperimentalZonelessChangeDetection()` later would need few changes (`LiveClockComponent` already marks itself).

## 6. Why this concept was selected
Admin-style apps are table-heavy; OnPush + signals avoids re-rendering large trees on every keystroke or poll tick (the notification poll runs every 30–60 s and only touches the bell badge).

## 7. Interview-related considerations
* *What triggers CD in an OnPush component?* New input reference, event from the template, `async`/signal read changes, `markForCheck`/`detectChanges`.
* *Why “immutable updates” with OnPush?* Mutating an object in place keeps the same reference so inputs don't notify (stores here replace objects: `{ ...c }`).
* *`markForCheck` vs `detectChanges`?* mark = schedule on next pass (also ancestors); detectChanges = run now for this subtree.
* *Why `track` matters:* without identity Angular recreates DOM for every list change.
* *zone.js vs zoneless:* zone patches async APIs to trigger CD; zoneless relies on signals/events/`markForCheck`.
