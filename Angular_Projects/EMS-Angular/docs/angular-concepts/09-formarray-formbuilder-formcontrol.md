# 09 · FormArray, FormBuilder and FormControl

## 1. Concept explanation
* **FormControl** — one value + its validity/state (a search box, a filter, a dropdown).
* **FormGroup** — a named set of controls.
* **FormArray** — an *ordered, resizable* list of controls/groups (rows the user adds and removes).
* **FormBuilder / NonNullableFormBuilder** — concise factories that build the above with validators and types.

## 2. Angular API / syntax
```ts
education: this.fb.array<EducationGroup>([])            // typed array of typed groups
add():    this.education.push(educationGroup(this.fb))
remove(): this.education.removeAt(i)
```
```html
<div formArrayName="education">
  @for (g of education.controls; track g; let i = $index) {
    <div [formGroupName]="i"> … <input formControlName="institution"> … </div>
  }
</div>
```

## 3. Where it is implemented in EMS
### Mandatory FormArray implementation — Employee Education & Work Experience
`/employees/new` and `/employees/:id/edit` (`employee-form.component.{ts,html}` + row factories in `employee-form.factory.ts`):

| Requirement | How |
|---|---|
| Add / remove education records | “Add education” → `education.push(educationGroup(fb))`; per-row “Remove” → `removeAt(i)` |
| Add / remove multiple work-experience records | same with `experienceGroup(fb)` |
| Validate each dynamically generated entry | each row is its own `FormGroup` with its own validators (institution + degree required, year bounds 1950–now(+8), `numberRange(startYear,endYear)` group validator; company/role/start required, `dateRange(startDate,endDate)`, `endDate` required unless *currently working*, which also **disables** it) |
| Display validation errors independently | every `<mat-error>` calls `rowError(g, 'institution', 'Institution')` on **that row's** control; group-level “End year cannot be before start year” under the row |
| Skills & certifications | `FormArray<FormControl<string>>` (`skillControl`): required, 2–60 chars, each validated separately |
| Persistence | **browser-local only** — the backend has no education/experience API (documented in `docs/backend-api-integration.md` §7; a banner is shown above the sections and on the read-only tab) |

### FormBuilder
Employee registration/edit, profile editing (`profile.component.ts`), department create/edit, designation dialog, leave application, leave type, attendance correction/manual (`attendance-edit-dialog.component.ts`), account creation (`user-create.component.ts`), job history change (`job-change-dialog.component.ts` — promotion/transfer/manager change).

### FormControl (standalone, outside a group)
* Search box: `search-box.component.ts` (`control = new FormControl('', { nonNullable: true })`).
* Filters / reactive dropdown: `leave-home.component.ts` (`status = new FormControl<LeaveStatus|null>(null)`), organization search (`searchControl`), root-manager picker (`rootControl` bound to `<app-employee-select [formControl]>`).
* Reusable individual control: `EmployeeSelectComponent` (is itself a `ControlValueAccessor`, see 21) and its inner `search` control; `ReasonDialogComponent.reason`.

## 4. Relevant file paths
`src/app/features/employees/employee-form.factory.ts`, `employee-form.component.html`, `src/app/shared/components/search-box.component.ts`, `src/app/features/leaves/leave-home.component.ts`.

## 5. Practical implementation explanation
* **Factory functions, not inline builders.** `educationGroup(fb, value?)` returns a typed group used both for “add an empty row” and “load saved rows”; being pure it is unit-tested without rendering (`employee-form.factory.spec.ts`: independent validity per row, removal makes the array valid, conditional end date, disabled control excluded from `.value` but present in `getRawValue()`).
* **`track g` in `@for`** uses the control object identity, so removing row 1 doesn't re-create row 2's inputs (focus and typed text survive).
* **Dirty tracking.** Structural changes (`push`/`removeAt`) don't mark a form dirty by themselves, so the add/remove helpers call `form.markAsDirty()` — the unsaved-changes guard (12) then protects the form.
* **E2E:** `e2e/ems.spec.ts` “HR creates an employee with education and experience rows” adds two education rows, removes one, adds an experience row and verifies the saved data on the Education tab.

## 6. Why this concept was selected
The brief calls for repeating, user-editable sections; `FormArray` is the canonical solution and the hardest forms feature to get right (identity, validation, dirty state), so it is implemented against a real screen rather than a toy.

## 7. Interview-related considerations
* *When FormArray vs repeating `FormGroup`s?* Use FormArray when the **count is dynamic**; fixed named sections are plain groups.
* *Typed `FormArray<FormGroup<…>>`:* `fb.array<EducationGroup>([])` keeps `.at(i).controls.institution` typed.
* *Why does removing a row sometimes “shift” values?* Tracking by index; track by the control object instead.
* *Validation scopes:* control (required), row group (`numberRange`), array (`education.invalid` aggregates), form (`form.invalid`).
* *`FormBuilder` vs `new FormGroup(...)`?* Same result; the builder is shorter and `NonNullableFormBuilder` removes `null` unions.
