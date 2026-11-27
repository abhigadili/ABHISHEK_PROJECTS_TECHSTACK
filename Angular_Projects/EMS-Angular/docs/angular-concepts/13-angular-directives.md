# 13 · Angular directives (built-in)

## 1. Concept explanation
Directives add behaviour to elements. **Structural** directives change the DOM (add/remove nodes): in Angular 17+ the built-in `@if`, `@for`, `@switch` blocks replace `*ngIf/*ngFor/*ngSwitch`. **Attribute** directives change appearance/behaviour of an existing element (`ngClass`, `ngStyle`). Template tools: `ng-container`, `ng-template`, `ngTemplateOutlet`, `ngComponentOutlet`, `ng-content`.

## 2. Angular API / syntax
```html
@if (store.error(); as e) { … } @else { … }
@for (e of store.items(); track e.id) { <app-employee-card [employee]="e" /> } @empty { <p>No employees</p> }
@switch (view()) { @case ('attendance') { … } @case ('leave') { … } @default { … } }
<ng-container *ngTemplateOutlet="tpl; context: { $implicit: row }" />
<ng-container *ngComponentOutlet="w.component; inputs: w.inputs" />
```

## 3. Where each is used
| Directive / construct | Real use | File |
|---|---|---|
| `@if` / `@else` / `@empty` | everywhere: error banners, empty states, role-dependent actions | all feature components |
| `@for … track` | tables, cards, calendars, tree nodes (`track child.id`), FormArray rows (`track g`) | `employee-list`, `org-node`, `employee-form.component.html` |
| `@switch` / `@case` | calendar view switcher (`attendance` / `leave` / `holidays`) | `holidays/calendar-page.component.ts` |
| `ngClass` | unread notification highlight; strength-bar colour | `notifications.component.ts`, `password-strength.component.ts` |
| `ngStyle` | strength-meter width `{ 'width.%': percent }` | `password-strength.component.ts` |
| `ngTemplateOutlet` | custom table cells and calendar day cells | `data-table.component.ts`, `month-calendar.component.ts` |
| `ngComponentOutlet` | dashboard widgets chosen per role | `dashboard.component.ts` |
| `ng-container` | group `*appHasPermission` actions without an extra element | `employee-details.component.ts`, `employee-list.component.ts` |
| `ng-template` | `appCell` cell templates, `matMenuContent`, calendar day template | `employee-list.component.ts`, `shell.component.ts` |
| `ng-content` (single & named slots) | `PageHeaderComponent` (`[pageActions]`), `DialogFrameComponent` (`[dialogActions]`), `EmptyStateComponent`, `StatusBadgeComponent` | `shared/components/*` |
| **Legacy syntax (explicit example)** | `*ngIf`, `*ngFor` + `trackBy`, `[ngSwitch]`/`*ngSwitchCase` with the modern equivalent in an HTML comment beside each | `shared/components/password-strength.component.ts` |

## 4. Relevant file paths
`src/app/shared/components/password-strength.component.ts` (legacy vs modern side by side), `data-table.component.ts`, `month-calendar.component.ts`, `src/app/features/dashboard/dashboard.component.ts`.

## 5. Practical implementation explanation
* **Control flow**: block syntax is built into the compiler (no import needed, better type narrowing, `@for` requires `track`, `@empty` removes the “length === 0” branch). `@if (x(); as v)` aliases a signal read once.
* **Equivalence table** (documented in the legacy component):

| Modern | Legacy |
|---|---|
| `@if (c) { … } @else { … }` | `<ng-container *ngIf="c; else other">` |
| `@for (r of rules; track r.label)` | `*ngFor="let r of rules; trackBy: trackRule"` |
| `@switch (level) { @case ('weak') {…} }` | `[ngSwitch]="level"` + `*ngSwitchCase="'weak'"` |

* **Template outlets in practice.** `DataTableComponent` finds `<ng-template appCell="status" let-row>` children with `@ContentChildren(CellDirective)` and renders `ngTemplateOutlet` with `{ $implicit: row, row, index }`; `MonthCalendarComponent` does the same per calendar day (`CalendarDayContext`). The caller owns the markup, the component owns layout and paging.
* **Dynamic widgets.** Each widget is an ordinary standalone component (`EventsWidgetComponent`, `ApprovalsWidgetComponent`, `BalancesWidgetComponent`) receiving data via `inputs` — adding a widget means adding one entry to the computed `widgets()` list.

## 6. Why this concept was selected
Built-in control flow is the Angular-recommended syntax, faster and more type-safe; template outlets are the idiomatic way to make generic components customisable without inheritance.

## 7. Interview-related considerations
* *Why `track` is mandatory in `@for`* — identity for DOM reuse; use a stable id (`e.id`), not `$index`, when items reorder.
* *`ngClass` vs `[class.x]`* — prefer class bindings for single toggles; `ngClass` for maps (and NgClass/NgStyle must be imported in standalone components).
* *`ng-container` vs `div`* — no DOM node, so layouts (flex/grid/table) aren't disturbed.
* *`ngTemplateOutlet` vs `ng-content`* — outlet renders a template **you control, repeatedly, with context**; projection renders content once as provided.
* *`ngComponentOutlet` inputs* — available since v16.2 (`inputs: {}`); before that you needed `ViewContainerRef.createComponent` + `setInput`.
