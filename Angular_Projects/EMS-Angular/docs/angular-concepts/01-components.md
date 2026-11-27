# 01 · Components

## 1. Concept explanation
A component is a TypeScript class plus a template and styles. Angular 19 apps are built from **standalone components** (`standalone: true`, the default way) that declare their own dependencies in `imports: []` — no `NgModule` needed. Components compose: a parent renders children in its template and passes data down (`input()`) and receives events up (`output()`).

## 2. Angular API / syntax
```ts
@Component({
  selector: 'app-employee-card',
  standalone: true,
  imports: [MatCardModule, ProfilePictureComponent],   // what the template may use
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `…`,
})
export class EmployeeCardComponent {
  readonly employee = input.required<Employee>();      // signal input
  readonly selected = output<Employee>();              // output
}
```
Related: `ng-content` (content projection), `viewChild()/contentChild()`, lifecycle hooks, `ngComponentOutlet` (dynamic components), Material dialogs (`MatDialog`).

## 3. Where it is implemented in EMS
| Topic | Implementation |
|---|---|
| Standalone components everywhere (72 `@Component`s, zero `@NgModule`s) | every `*.component.ts` under `src/app` |
| Parent / child composition | `employee-details.component.ts` (shell) → child tab components in `employee-tabs.component.ts`; `organization.component.ts` → recursive `org-node.component.ts` |
| Reusable table / pagination / search / cards | `shared/components/data-table.component.ts`, `pagination.component.ts`, `search-box.component.ts`, `employee-card.component.ts`, `client-table.component.ts` |
| Reusable dialogs | `shared/components/dialogs.ts` (`ConfirmDialogComponent`, `ReasonDialogComponent`, `DialogFrameComponent`, `DialogService`) |
| Reusable form control | `shared/components/employee-select.component.ts` (ControlValueAccessor) |
| Content projection | `PageHeaderComponent` (`<ng-content select="[pageActions]">`), `DialogFrameComponent`, `StatusBadgeComponent`, `MonthCalendarComponent` |
| Dynamic components | dashboard widgets via `ngComponentOutlet` in `features/dashboard/dashboard.component.ts` |
| Feature screens | Login, Dashboard, Employee list/details/form/profile, Departments, Designations, Attendance, Leave, Organization, Reports, Notifications, Users, Profile, Settings (all under `features/`) |

## 4. Relevant file paths
`src/app/shared/components/*`, `src/app/features/**/**.component.ts`, `src/app/layout/shell.component.ts`.

## 5. Practical implementation explanation
* **Presentational vs. smart.** `EmployeeCardComponent`, `StatusBadgeComponent`, `EmptyStateComponent` only receive inputs and emit outputs. Feature components such as `EmployeeListComponent` talk to services/stores.
* **Recursion.** `OrgNodeComponent` renders its own children with `<app-org-node>` — tree depth is whatever the backend returns, nothing is hard-coded.
* **One dialog frame, many dialogs.** `DialogFrameComponent` gives every dialog the same title/body/actions layout; `JobChangeDialogComponent`, `DesignationDialogComponent`, `HolidayDialogComponent`, `LeaveTypeDialogComponent`, `AttendanceEditDialogComponent` project their form and buttons into it (`dialogActions` slot).
* **Dynamic widgets.** The dashboard computes a `WidgetSpec[]` (component class + inputs) from the user's role and renders each with `*ngComponentOutlet="w.component; inputs: w.inputs"`.
* **NgModule awareness.** Angular Material still ships NgModules (`MatButtonModule`, `MatTableModule`…); standalone components import them directly — the one place NgModules appear.

## 6. Why this concept was selected
Standalone components remove module boilerplate, make lazy loading per-component trivial (`loadComponent`) and are Angular's recommended default since v17. Reusable presentational components keep the 14 feature areas visually and behaviourally consistent.

## 7. Interview-related considerations
* *Standalone vs NgModule?* Standalone declares dependencies locally (`imports`), tree-shakes better, and removes “which module declares this?” confusion; NgModules remain for third-party libraries and legacy code.
* *`input()` vs `@Input()`?* Signal inputs are read-only signals: usable in `computed`/`effect`, `required` is enforced by the compiler, and no `ngOnChanges` is needed. `@Input()` (used deliberately once, in `password-strength.component.ts`) still works and notifies via `ngOnChanges`.
* *Smart/presentational split* and why `OnPush` suits presentational components (see 19).
* *How do you render a component whose type is only known at runtime?* `ngComponentOutlet` with `inputs` (Angular ≥16.2) or `ViewContainerRef.createComponent`.
* *Content projection vs inputs?* Use inputs for data, projection for markup the parent owns.
