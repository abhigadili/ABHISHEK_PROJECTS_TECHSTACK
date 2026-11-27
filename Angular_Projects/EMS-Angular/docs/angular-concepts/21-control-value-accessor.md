# 21 · `ControlValueAccessor`

## 1. Concept explanation
`ControlValueAccessor` (CVA) is the bridge between Angular Forms and any UI control. Implementing it lets a custom component work with `formControl`, `formControlName` and `ngModel` — validation, disabled state, touched/dirty and `setValue` all keep working.

## 2. Angular API / syntax
```ts
@Component({
  selector: 'app-employee-select',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => EmployeeSelectComponent), multi: true }],
})
export class EmployeeSelectComponent implements ControlValueAccessor {
  writeValue(id: number | null): void { … }                 // model → view
  registerOnChange(fn: (v: number | null) => void): void    // view → model
  registerOnTouched(fn: () => void): void
  setDisabledState(disabled: boolean): void
}
```

## 3. Where it is implemented — `shared/components/employee-select.component.ts`
A **searchable employee dropdown** (Material autocomplete) whose form value is the employee **id** (`number | null`) while the input shows the name.

Used as a form control in:
* employee form → **Manager** (`formControlName="managerId"`)
* department form → **Department head** (`headEmployeeId`)
* job-change dialog → new manager
* attendance correction/manual dialog → employee; leave admin balance-adjust and filters → employee
* organization chart → “Show team of (manager)” (`[formControl]="rootControl"`)
* user-create → employee

| CVA method | Behaviour |
|---|---|
| `writeValue(id)` | loads `GET /employees/:id` to display the name (no request for `null`) |
| `registerOnChange` | called when a suggestion is chosen, when the field is cleared, and with `null` when the user types after a selection (invalidating it) |
| `registerOnTouched` | on `blur` |
| `setDisabledState` | disables/enables the inner control with `form.disable()/enable()` |

Search stream: `valueChanges → filter(string) → debounceTime(250) → distinctUntilChanged → switchMap(list(q, status, limit 8))`, cancelling older lookups; errors degrade to an empty list.

Tests — `shared/components/employee-select.component.spec.ts` (7 cases): model→view load, `null` clears with no request, debounced search + selection updates the control, typing after a selection nulls the value, disabled state, touched-on-blur. Also exercised end-to-end in the employee form and org chart specs.

## 4. Relevant file paths
`src/app/shared/components/employee-select.component.ts` (+ `.spec.ts`), `src/app/features/employees/employee-form.component.html`.

## 5. Practical implementation explanation
* **Value ≠ display.** The control stores an id (what the API needs); the visible text is derived. This keeps forms typed (`FormControl<number | null>`) and the payload trivial.
* **Avoid loops.** Internal `setValue(..., { emitEvent: false })` on the display control prevents `writeValue` from re-triggering the search stream.
* **Standalone-friendly provider.** `forwardRef` is needed because the provider references the class being defined.
* **Server errors reach it.** The employee form maps backend errors onto `managerId`; the host `mat-form-field` shows them.

## 6. Why this concept was selected
Choosing an employee appears in seven places; a CVA makes it a drop-in form control with consistent search, loading, clearing and validation — instead of seven copies of autocomplete code.

## 7. Interview-related considerations
* *What are the four methods for?* write (model→view), onChange (view→model), onTouched (blur), setDisabledState (form disable).
* *Why `NG_VALUE_ACCESSOR` with `multi: true` and `forwardRef`?* The forms directives collect all accessors on the element; `forwardRef` allows referencing the class before its declaration finishes.
* *How do validators apply?* They live on the `FormControl` outside the component; optionally implement `Validator` to ship validation with the control.
* *CVA vs `input()`/`output()` pair?* A CVA integrates with the Forms API (touched, disabled, validity, `reset`), an input/output pair doesn't.
* *Signal-forms future:* Angular is moving toward signal-based forms; CVAs remain the compatibility path.
