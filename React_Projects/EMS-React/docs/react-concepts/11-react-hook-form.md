# 11 · React Hook Form

## 1. Concept explanation
React Hook Form (RHF) manages form state **outside** React state: inputs are *registered* (via refs) so typing does not re-render the
form; components subscribe only to the slices they need (`useWatch`, `formState` proxy). It validates through a *resolver* — here
**Zod** (`@hookform/resolvers/zod`) — so the schema is the single definition of "valid" (doc 12).

## 2. Syntax
```tsx
const methods = useForm<V>({ resolver: zodResolver(schema), defaultValues, mode: 'onTouched' });
const { register, handleSubmit, control, formState: { errors, isDirty, isSubmitting } } = methods;
<form onSubmit={handleSubmit(async (values) => { … })}>
  <input {...register('email')} />                      {/* uncontrolled */}
  <Controller name="role" control={control} render={({ field }) => <Select {...field} />} />   {/* controlled bridge */}
</form>
<FormProvider {...methods}>…<Child/>…</FormProvider>    // child: const { control } = useFormContext<V>()
```

## 3. Actual EMS implementation — every API and where it is used
| API | Real use | File |
|---|---|---|
| `useForm` + `zodResolver` + `defaultValues` + `mode: 'onTouched'` | every form (the *touched* semantics come from `onTouched`: errors appear after a field is blurred, then re-validate on change) | `EmployeeFormPage.tsx`, `DepartmentFormPage.tsx`, `LeaveApplyPage.tsx`, … |
| **`register`** (uncontrolled) | login fields (`registration={register('email')}`; MUI needs the ref on `inputRef`) | `features/auth/LoginPage.tsx` |
| **`handleSubmit`** | all submit handlers; server errors are mapped back with `setError` | `EmployeeFormPage.tsx#onSubmit` |
| **`Controller`** | `FormSelect`, `FormCheckbox` (MUI inputs need controlled `value`/`onChange`) | `components/forms/fields.tsx` |
| **`useController`** | `FormTextField` (hook form of `Controller`) | `components/forms/fields.tsx` |
| **`useFieldArray`** | emergency contacts, education, experience, skills, certifications | `features/employees/form/FieldArraySections.tsx` (doc 13) |
| **`FormProvider` / `useFormContext`** | one `<FormProvider>` per form; nested sections/fields call `useFormContext` — no `control` prop drilling | `EmployeeFormPage.tsx` → `fields.tsx`, `FieldArraySections.tsx` |
| **`useWatch`** | `createAccount` toggles the login fields; `designationId` pre-fills job title; `LeaveApplyPage` watches type + dates for the balance hint. Only the *watching* component re-renders | `EmployeeFormPage.tsx`, `LeaveApplyPage.tsx` |
| **`watch`** (subscription form) | upper-cases the department code as you type, without re-rendering | `DepartmentFormPage.tsx` |
| **`setValue`** | choosing a designation pre-fills an *empty* job title, marked dirty so it is saved | `EmployeeFormPage.tsx` |
| **`getValues`** | read without subscribing (job title check, field-name list for server-error mapping) | `EmployeeFormPage.tsx` |
| **`reset`** | load an existing record, re-baseline after save/cancel, reset dialog forms on open | `MyProfilePage.tsx`, `DesignationsPage.tsx`, `HolidaysPage.tsx` |
| **`resetField`** | switching "create a login" off restores/clears password fields (value, dirty, touched, error) | `EmployeeFormPage.tsx` |
| **`setError`** | map backend `VALIDATION_ERROR` details and `409 DUPLICATE` onto the right inputs | `EmployeeFormPage.tsx`, `DepartmentFormPage.tsx`, `DesignationsPage.tsx`, `UsersPage.tsx` |
| **`clearErrors`** | clear password errors when the login section is switched off | `EmployeeFormPage.tsx` |
| **`trigger`** | validate only the current wizard step when pressing **Next** | `EmployeeFormPage.tsx` (`STEPS[step].fields`) |
| **`formState`** | `errors` (step error badges), `isDirty` ("Unsaved changes" chip + navigation blocker), `dirtyFields` (count), `isSubmitting` | `EmployeeFormPage.tsx`, `MyProfilePage.tsx` |
| **Async validation** | duplicate e-mail rule in the Zod schema (`createEmployeeSchema({ isEmailTaken })`) | `schemas/employee.ts`, `hooks/useFormValidation.ts` |
| **Custom validation / conditional fields / cross-field** | `superRefine` rules (doc 12) | `schemas/*.ts` |
| **Nested / dynamic forms** | `education.2.degree` style paths; add/remove rows at runtime | `FieldArraySections.tsx` |

Not claimed because not needed: `useFormState` (the `formState` proxy suffices).

## 4. Relevant file paths
`src/features/employees/EmployeeFormPage.tsx`, `src/features/employees/form/*`, `src/components/forms/fields.tsx`, `src/schemas/*.ts`, `src/features/auth/LoginPage.tsx`.

## 5. Practical implementation — the 5-step wizard
```tsx
const next = async () => {
  const valid = await trigger(STEPS[step].fields as never);          // validate just this step
  if (valid) setStep((s) => s + 1);
};
// leaving with edits asks first; a ref (not isSubmitSuccessful) avoids blocking our own post-save navigation
const done = useRef(false);
const blocker = useBlocker(({ currentLocation, nextLocation }) => isDirty && !done.current && currentLocation.pathname !== nextLocation.pathname);
```
That ref fixes a real bug caught by the E2E test: `isSubmitSuccessful` only becomes true *after* `handleSubmit` resolves, i.e. after
`navigate()` — so the blocker used to fire on a successful save.
On submit, the payload is built by `formMapping.toPayload` (omit empties on create, `null` to *clear* on edit — verified live against the backend — never `workLocation:null`, which the backend answers with HTTP 500).

## 6. Why the concept is used
Forms with ~40 fields, nested lists, async rules and server errors would be slow and verbose with plain `useState`. RHF keeps typing
cheap, gives precise subscriptions, and `trigger`/`setError`/`reset` map neatly onto a wizard and a server-validated API.

## 7. Advantages and limitations
**+** minimal re-renders, small API surface, great TypeScript path inference (`Path<T>`), resolver-agnostic. **−** uncontrolled model needs `Controller` for controlled UI kits (extra code — wrapped once in `fields.tsx`); async resolver rules run on every validation (cache them, see `useFormValidation`); the wizard keeps all steps mounted (`hidden`) so values persist — fine here, heavy for huge forms; field-array paths are stringly-typed template literals.

## 8. Interview-related considerations
* Why is RHF faster than a controlled `useState` form? (refs + subscriptions.)
* `register` vs `Controller`/`useController`; `watch` vs `useWatch` vs `getValues`; `reset` vs `resetField`; `defaultValues` vs `values`.
* `mode`/`reValidateMode`; `formState` proxy subscription rule (read it during render to subscribe).
* How do you show server-side errors? (`setError` with `type:'server'`.) How do you do step-by-step validation? (`trigger`.)
* Why use a stable `id` (not the index) as the key in field arrays? (doc 13)
