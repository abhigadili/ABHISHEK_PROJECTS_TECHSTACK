# 03 · Component communication

## 1. Concept explanation
Components exchange data in four ways: **parent → child** (inputs), **child → parent** (outputs), **shared services** (state/streams) and **the router** (URL params/query params/state). The rule: data flows down, events flow up, and anything shared by siblings lives in a service.

## 2. Angular API / syntax
```ts
readonly employee = input.required<Employee>();       // parent → child
readonly selected = output<Employee>();               // child → parent   (this.selected.emit(e))
readonly value = model('');                           // two-way
private readonly state = inject(EmployeeDetailsState); // shared service
```

## 3. Where it is implemented in EMS
| Mechanism | Implementation |
|---|---|
| Input / Output (signal APIs) | `EmployeeCardComponent` (`employee` in, `selected` out); `DataTableComponent` (`rows`,`columns`,`meta` in; `sortChange`,`pageChange`,`rowClick` out); `OrgNodeComponent` (`node`,`expandedIds` in; `toggled`,`picked` out) |
| `model()` | `SearchBoxComponent.value` |
| Parent-owned state, child-emitted intent | Org tree: `OrganizationComponent` owns `expanded`/`selectedId` signals; `OrgNodeComponent` only emits `toggled`/`picked` |
| Shared service, route-scoped | `employees/employee-details.state.ts` (`EmployeeDetailsState`) shared by the details shell and the three tab components |
| Shared service, root | `AuthService` (signals), `NotificationService.unreadCount` (shell badge + notification page), `LoadingService`, `ToastService`, `PreferencesService` |
| Router as a channel | filters/sort/page in query params (`employee-list.component.ts`); `state: { from }` passed on navigation and read by `employee-details.component.ts`; `:id` params bound to inputs (`attendance-detail`, `leave-detail`, `user-details`) |
| Projection-based communication | parent templates passed into `DataTableComponent` (`<ng-template appCell="status" let-row>`) and `MonthCalendarComponent` (`<ng-template let-day>`) with a context object |
| Event bus-style streams | `AuthService.events$` (ReplaySubject), `ConnectivityService.online$` (BehaviorSubject) |

## 4. Relevant file paths
`shared/components/data-table.component.ts`, `shared/components/search-box.component.ts`, `features/employees/employee-details.state.ts`, `features/organization/*.ts`, `core/services/auth.service.ts`.

## 5. Practical implementation explanation
* **Table → page.** `DataTableComponent` never fetches; it emits `{page, limit}`, `{active, direction}` and the clicked row. `EmployeeListComponent` turns those into `router.navigate([], { queryParams, queryParamsHandling:'merge' })`, the URL drives `EmployeeListStore`, the store loads data, the table re-renders. One loop, no two-way mutation of shared objects.
* **Template inputs.** `DataTableComponent` collects `<ng-template appCell="key">` with `@ContentChildren(CellDirective)` and renders them via `ngTemplateOutlet` with `{ $implicit: row }` — the parent injects *markup* into the child with typed row context.
* **Siblings share via a service.** The `/employees/:id` route declares `providers: [EmployeeDetailsState]`; the details header, overview, history and background tabs all inject the same instance. After an edit, `EmployeeFormComponent` (a sibling route) publishes the saved employee into it (`inject(EmployeeDetailsState, { optional: true })`) so tabs never show stale data.
* **Avoid prop-drilling.** `OrgNodeComponent` passes `expandedIds`/`selectedId`/`highlightPath` down each level but never mutates them; events bubble up through `(toggled)="toggled.emit($event)"`.

## 6. Why this concept was selected
A predictable one-way flow makes OnPush safe and the UI debuggable; services only where state genuinely outlives or crosses components.

## 7. Interview-related considerations
* *Name the ways two components can communicate.* Inputs/outputs, shared service (RxJS/signals), router state, `ViewChild`/`ContentChild` references, content projection with template context.
* *Why not mutate an `@Input()` object in the child?* It hides data flow and breaks OnPush; emit an event instead.
* *Service scope matters:* `providedIn:'root'` = app singleton; route/component `providers` = new instance per route/component (see 04).
* *Why `output()` instead of `EventEmitter`?* `output()` is a lightweight, non-RxJS emitter (cannot be subscribed to like a Subject, cannot be misused with `.next`), and interoperates via `outputToObservable`.
* *Naming gotcha:* outputs named like native DOM events (`toggle`, `select`) trigger the `no-output-native` lint rule and double-fire; they were renamed `toggled`/`picked`.
