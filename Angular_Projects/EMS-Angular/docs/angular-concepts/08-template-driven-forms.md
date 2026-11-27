# 08 · Template-driven forms

## 1. Concept explanation
In template-driven forms the **template** declares the form: `ngModel` creates a `FormControl` per input, `ngForm` the surrounding `FormGroup`, and validators are HTML attributes/directives. The model lives in a plain object bound with `[(ngModel)]`. It is concise for small, flat forms.

## 2. Angular API / syntax
```html
<form #f="ngForm" (ngSubmit)="save(f)" novalidate>
  <div ngModelGroup="display" #display="ngModelGroup">
    <input name="displayName" [(ngModel)]="model.displayName" #displayName="ngModel"
           minlength="2" maxlength="40" appNotOnlyDigits [ngModelOptions]="{ updateOn: 'blur' }" />
```
`FormsModule`, `NgForm`, `NgModel`, `NgModelGroup`, `NG_VALIDATORS` (custom validator directive).

## 3. Where it is implemented in EMS
**`/settings`** — `src/app/features/profile/settings.component.ts` (“User preferences / notification preferences / simple admin configuration” from the brief). It uses *all* the required pieces:

| Required piece | In the settings form |
|---|---|
| `FormsModule` | imported by the standalone component |
| `ngForm` | `#f="ngForm"`; `f.valid`, `f.dirty`, `f.pristine`, `f.submitted` drive the footer text and the Save button |
| `ngModel` | every field (`[(ngModel)]="model.…"`) |
| `ngModelGroup` | `display` and `notifications` groups |
| `ngModelOptions` | `{ updateOn: 'blur' }` on the display name |
| `ngSubmit` | `(ngSubmit)="save(f)"` |
| Built-in validators | `required`, `min`, `max`, `minlength`, `maxlength` |
| Custom validation | `NotOnlyDigitsDirective` (`NG_VALIDATORS` provider) — a directive form of a validator |
| Template reference variables | `#f`, `#displayName="ngModel"`, `#pageSize="ngModel"`, `#display`, `#notif` |
| State & messages | `@if (pageSize.invalid && (pageSize.dirty || pageSize.touched || f.submitted))` |

Persistence: `PreferencesService` (signal + effect → `localStorage`). The shell reads it (display name, sidebar, landing page).

## 4. Relevant file paths
`src/app/features/profile/settings.component.ts`, `src/app/core/services/preferences.service.ts`, `e2e/modules.spec.ts` (“settings: template-driven form validates and persists in the browser”).

## 5. Practical implementation explanation
* Validation messages appear only after the user interacted (`dirty || touched || submitted`), mirroring `mat-error`'s own touched rule — the E2E test blurs the field to see the message, like a user.
* `updateOn: 'blur'` means the display-name validators run when leaving the field, not on each keystroke.
* The component deliberately uses `ChangeDetectionStrategy.Default`: `ngModel` writes happen through directive internals rather than signals, so default CD keeps the form trivially correct.
* “Restore defaults” replaces the model object and marks the form dirty so Save becomes available.

## 6. Why this concept was selected / when each approach is used
| | Reactive Forms | Template-driven |
|---|---|---|
| Used for | complex business forms: employee, leave, departments, users, login, password flows, filters | one flat, low-risk form: **settings/preferences** |
| Because | nested groups, `FormArray`, async/cross-field/conditional validation, server-error mapping, unit tests without DOM | no dynamic rows, no cross-field rules, no server round-trip; the template is the simplest place to declare it |
| Not used for | – | anything with business rules or arrays |

## 7. Interview-related considerations
* *Which is “better”?* Neither: reactive scales and tests better; template-driven is less code for trivial forms. Real apps mix them (as here).
* *Is template-driven synchronous?* No — `NgModel` registers controls asynchronously (a resolved promise), so the control tree exists only after the first CD; tests need `await fixture.whenStable()`.
* *How do you write a custom validator for template forms?* A directive that provides `NG_VALIDATORS` (`NotOnlyDigitsDirective`).
* *What does `ngModelGroup` buy you?* A nested `FormGroup` (`f.value.display.displayName`) and group-level validity/touched.
* *Gotcha:* every `ngModel` input needs a `name` (or `standalone: true` option) inside a form.
