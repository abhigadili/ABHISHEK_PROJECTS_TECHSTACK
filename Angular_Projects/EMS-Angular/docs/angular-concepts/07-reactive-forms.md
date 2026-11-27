# 07 · Reactive Forms

## 1. Concept explanation
Reactive Forms model a form as a tree of objects in the component class (`FormGroup` → `FormControl`/`FormArray`). Validation, enable/disable state and values are explicit and observable, which makes them the right tool for complex, dynamic, testable business forms. In EMS they back every “real” form: login, employee create/edit, department, designation, leave application, attendance correction, users, job change, profile, reports filters.

## 2. Angular API / syntax
```ts
private readonly fb = inject(NonNullableFormBuilder);
readonly form = this.fb.group({
  workEmail: ['', { validators: [Validators.required, Validators.email], asyncValidators: [uniqueValue(…)] }],
  address: addressGroup(this.fb),                       // nested FormGroup
  education: this.fb.array<EducationGroup>([]),          // FormArray
}, { validators: [(g) => this.probationAfterJoining(g)] }); // form-level validator
form.getRawValue() · patchValue · setValue · reset · enable/disable · valueChanges · statusChanges · markAllAsTouched
```

## 3. Where each required feature lives
| Feature | Implementation |
|---|---|
| `FormGroup`, `FormControl`, nested groups | `employee-form.component.ts` (address, emergency, account), `profile.component.ts` |
| `FormBuilder` | classic builder: `department-form.component.ts`, `designations.component.ts` (dialog), `leave-admin.component.ts` (leave-type dialog) |
| **`NonNullableFormBuilder`** (typed, no `null` leaks) | `employee-form.component.ts`, `leave-apply.component.ts`, `login.component.ts`, `change-password.component.ts`, `attendance-edit-dialog.component.ts`, … |
| Built-in validators | `Validators.required/email/min/max/minLength/maxLength/pattern` everywhere |
| **Custom synchronous validators** | `shared/validators/validators.ts`: `passwordComplexity`, `phoneNumber`, `pastDate`, `futureOrToday` |
| **Custom async validator** | `uniqueValue()` + `EmployeeService.emailExists()` → duplicate work e-mail (employee form) |
| **Cross-field / form-level validation** | `matchFields` (confirm password), `dateRange`, `numberRange`, probation-vs-joining (form validator), `halfDayRule` (leave), `atLeastOneChange` (job change), `outAfterIn` (attendance) |
| **Conditional validators** | `validateIf()` — account password required only when “create account” is ticked; experience end date required only when not “currently working” |
| Enable / disable controls | account section (`create` toggles role/password/confirm), `endDate` disabled for current jobs, salary hidden/disabled for non-HR, `employeeCode` locked on edit |
| `setValue` / `patchValue` / `reset` / `getRawValue` | `department-form` (`setValue` for upper-casing, `patchValue` from input), employee form edit mode + `reset()`, `getRawValue()` to include disabled controls |
| `valueChanges` | `search-box.component.ts`, `employee-select.component.ts`, attendance/report filter forms (debounced into signals) |
| `statusChanges` | `report-panel.component.ts` (`formValid` signal → export button) |
| dirty/pristine, touched/untouched, pending, invalid | `HasUnsavedChanges` (dirty), `markAllAsTouched()` on submit, `checkingEmail` (pending async check), `form.invalid` |
| Form submission handling | `submit()` guards (`invalid`, `saving`), disables the button, maps backend `details[]` onto controls |
| Dynamic validation messages | `errorMessage(control, label)` in `shared/validators/validators.ts` (one place for every message) |
| Typed forms | every group is inferred (`form.getRawValue()` is typed, no `any`) |

## 4. Relevant file paths
`src/app/features/employees/employee-form.component.{ts,html,scss}`, `employee-form.factory.ts`, `src/app/shared/validators/validators.ts`, `src/app/features/leaves/leave-apply.component.ts`, `src/app/features/auth/*.ts`.

## 5. Practical implementation explanation
* **Backend validation is authoritative.** Client rules mirror the backend (password policy, phone regex — copied verbatim from the Express validators) to give instant feedback; on `400 VALIDATION_ERROR` the backend `details[{field,message}]` are written to the matching controls with `setErrors({ server: msg })` (`SERVER_FIELD_MAP` handles renamed fields like `addressLine → address.line`).
* **Async validator done right.** `uniqueValue` debounces 400 ms (`timer`), `switchMap`s so a newer value cancels the older lookup, skips syntactically invalid e-mails, and **never blocks the form if the lookup itself fails** (`catchError → of(null)`). The employee being edited is excluded from the match.
* **Pending handling.** Angular did not emit `statusChanges` when the async result landed (found by debugging a stuck “Save”), so the component tracks the check with a signal set around the validator (`trackChecking`) and, if the user clicks Save mid-check, waits for it and resubmits automatically.
* **Focus the first error.** On an invalid submit `viewChildren(MatInput)` finds the first invalid input and focuses it.
* **Backend gotcha encoded in the form.** `workLocation: null` makes the backend 500 (NOT NULL column); the payload builder omits it when blank — unit-tested.

## 6. Why this concept was selected
Complex forms (nested groups, arrays, conditional rules, async checks, server errors) are exactly what Reactive Forms are for; being class-based they are unit-testable without a DOM (`employee-form.factory.spec.ts`, `validators.spec.ts`).

## 7. Interview-related considerations
* *Reactive vs template-driven?* See 08. Reactive: explicit model, sync access, testable, scalable. Template-driven: quick, implicit.
* *Why `NonNullableFormBuilder`?* Controls reset to their initial value instead of `null`, so `string` stays `string` (no `string | null` everywhere).
* *`getRawValue()` vs `.value`?* `.value` omits **disabled** controls; `getRawValue()` includes them (needed for `employeeCode` on edit).
* *Where should cross-field validators live?* On the common ancestor (`FormGroup`); error is on the group (`form.hasError('dateRange')`), optionally copied to a control for display.
* *Async validator pitfalls:* run only when sync validators pass, debounce, handle errors, and don't treat “lookup failed” as “invalid”.
* *`updateOn: 'blur'`?* Reduces validator churn; skipped here because the debounce + `switchMap` already bound the work.
