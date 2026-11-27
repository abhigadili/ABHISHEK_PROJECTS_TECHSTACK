# 14 · Custom directives

## 1. Concept explanation
A custom directive packages reusable DOM behaviour. **Attribute directives** decorate an element (focus, highlight, input filtering). **Structural directives** receive a `TemplateRef` and decide whether/how to stamp it into a `ViewContainerRef`. All custom directives here live in one file, `src/app/shared/directives/directives.ts`, and are standalone.

> Directives are a **UI convenience, never security**: hiding a button doesn't stop a crafted request — the backend authorises everything.

## 2. Angular API / syntax
```ts
@Directive({ selector: '[appHasRole]', standalone: true })
export class HasRoleDirective {
  readonly appHasRole = input.required<readonly Role[]>();
  constructor() {
    effect(() => { allowed() ? container.createEmbeddedView(template) : container.clear(); });   // reacts to role changes, no leak
  }
}
```
Usage: `<button *appHasRole="['HR_ADMIN','SUPER_ADMIN']">`, `<a *appHasPermission="'leave.approve'">`, `<input appAutofocus>`, `<div [appHighlight]="'#e3f2fd'">`, `<input appNumbersOnly>`.

## 3. Where each is implemented and used
| Directive | Kind | Behaviour | Used in |
|---|---|---|---|
| `appHasRole` | structural | render only for listed roles | employee overview “Account / login role” block (HR & super-admin only) |
| `appHasPermission` | structural | render if the user has **any** of the permission(s); accepts a string or array | employee list/details actions, departments, designations, users, leave, attendance, reports |
| `appAutofocus` | attribute | `afterNextRender` → `focus()` | login e-mail, employee form first name, department code, reason dialog |
| `appHighlight` | attribute | hover background, configurable via `[appHighlight]="colour"` (aliased input + `@HostListener`) | `EmployeeCardComponent` |
| `appNumbersOnly` | attribute (`input[...]`) | strips non-digits on input/paste and re-dispatches `input` so the model updates | leave-admin “Year” field |
| `appCell` | structural-ish marker (`ng-template[appCell]`) | names a column's custom cell template | every `DataTableComponent` user |
| `appNotOnlyDigits` | validator directive (`NG_VALIDATORS`) | template-driven custom validation | settings form |

Tests: `shared/directives/directives.spec.ts` (role change at runtime in both directions, any-of permission matrix, hover toggle, digits filtered, focus after render).

## 4. Relevant file paths
`src/app/shared/directives/directives.ts`, `src/app/shared/components/data-table.component.ts` (`CellDirective`), `src/app/features/profile/settings.component.ts` (`NotOnlyDigitsDirective`).

## 5. Practical implementation explanation
* **Reactive structural directives.** Instead of checking the role once in `ngOnInit`, the directive uses an `effect` over `PermissionService` (itself `computed` from the auth role signal). Logging out/in or changing role re-renders without any subscription code, and `shown` state prevents duplicate views.
* **Input handling & cleanup.** Inputs are signal `input.required()`; effects are tied to the directive's injection context so Angular destroys them with the directive — nothing to unsubscribe.
* **Host binding without `Renderer2` boilerplate.** `HighlightDirective` uses `host: { '[style.backgroundColor]': … }` plus `@HostListener('mouseenter'|'mouseleave')`.
* **`appNumbersOnly` re-dispatches `input`** after cleaning so `ngModel`/`formControl` sees the sanitised value.

## 6. Why this concept was selected
Role-aware templates are needed in a dozen screens; a directive keeps templates declarative (`*appHasPermission="'employee.write'"`) and the rule in one place (`PermissionService`).

## 7. Interview-related considerations
* *Structural directive internals:* `*` desugars to `<ng-template>`; inject `TemplateRef` + `ViewContainerRef`, call `createEmbeddedView`/`clear`.
* *Attribute vs structural?* Attribute modifies the host; structural controls whether the host exists.
* *`@HostListener` vs `host: {}`* — both are fine; `host` metadata is the modern, lint-preferred place.
* *Should directives enforce security?* No (client-side). They prevent confusing UI; the API still returns 403 (handled by the interceptor toast).
* *Why `afterNextRender` for autofocus?* It runs after the view is in the DOM and not on the server, unlike the constructor.
