# 10 · Controlled and uncontrolled components

## 1. Concept explanation
* **Controlled**: React state is the *single source of truth* for the input. The input shows `value={state}` and every keystroke
  goes `onChange → setState → re-render`. React always knows the value, so it can validate, format, disable buttons live.
* **Uncontrolled**: the **DOM** holds the value. You give an optional `defaultValue` and *read* it when you need it (a `ref`, or
  `FormData` on submit). React doesn't re-render per keystroke.

Neither is "better": controlled = more control, more renders; uncontrolled = less code and fewer renders, less live feedback.
**React Hook Form** is an uncontrolled-first library (it registers inputs with refs) that offers `Controller`/`useController` to bridge
controlled UI libraries like Material UI.

## 2. Syntax
```tsx
// controlled
const [email, setEmail] = useState('');  <input value={email} onChange={(e) => setEmail(e.target.value)} />
// uncontrolled with a ref
const ref = useRef<HTMLInputElement>(null);  <input ref={ref} defaultValue="" />;  ref.current?.value
// uncontrolled with FormData (React 19 form actions)
<form action={(formData) => save(String(formData.get('email')))}><input name="email" /></form>
// RHF: uncontrolled registration vs controlled bridge
<input {...register('email')} />        const { field } = useController({ name: 'email', control })
```

## 3. Actual EMS implementation
| Style | Where |
|---|---|
| **Controlled via `useState`** | `components/tables/SearchBox.tsx` (parent owns `value`), `AttendancePage.tsx` date range (local state committed to the URL on blur), `features/lab/FormsDemo.tsx#ControlledForm` (live validation message), `LeaveApprovalsPage.tsx` decision note |
| **Uncontrolled via `useRef`** | `FileUpload.tsx` (file inputs are *always* uncontrolled — their value is read-only for security), `FormsDemo.tsx#UncontrolledForm` |
| **Uncontrolled via form action / `FormData`** | `features/auth/ForgotPasswordPage.tsx` (`useActionState`, `<TextField name="email" defaultValue>`) |
| **React Hook Form, uncontrolled-style registration** | the whole-form state (`useForm`, validation, dirty tracking) in `EmployeeFormPage`, `LoginPage`, … |
| **Controlled bridge for MUI** | `components/forms/fields.tsx` — `FormTextField` uses `useController`; `FormSelect`/`FormCheckbox` use `<Controller render={…}>` (MUI inputs need `value`/`onChange`) |

## 4. Relevant file paths
`src/features/lab/FormsDemo.tsx`, `src/components/forms/fields.tsx`, `src/components/tables/SearchBox.tsx`,
`src/features/auth/ForgotPasswordPage.tsx`, `src/components/common/FileUpload.tsx`.

## 5. Practical implementation
Same field, two models (tested side by side in `lab.test.tsx`):
```tsx
// controlled: React re-renders per keystroke and can show "Live value" and an error instantly
<TextField value={email} onChange={(e) => setEmail(e.target.value)} error={invalid} helperText={invalid ? 'Not a valid email' : `Live value: "${email}"`} />
// uncontrolled: React learns the value only at submit time
<TextField inputRef={ref} defaultValue="" />   …   setSubmitted(ref.current?.value ?? '')
```
The test asserts the controlled version shows the live value after typing, while the uncontrolled one shows nothing until submit.

## 6. Why the concept is used
Controlled fields are used where *the UI depends on the value while typing* (search → URL, live validation). Large forms use RHF's
uncontrolled registration to avoid re-rendering 40 fields per keystroke, keeping the 5-step employee form fast. File inputs are
inherently uncontrolled.

## 7. Advantages and limitations
**Controlled** — **+** instant validation, conditional UI, single source of truth, easy to reset; **−** a re-render per keystroke, more boilerplate, can lag on huge forms.
**Uncontrolled** — **+** minimal code/renders, works with native forms, easy to integrate third-party widgets; **−** no live feedback unless you add listeners, harder to programmatically set/validate, state invisible to React DevTools.
A component must not *switch* between the two (`value` going from `undefined` to defined triggers a React warning) — `FormTextField` always passes `value={field.value ?? ''}`.

## 8. Interview-related considerations
* Define both; give a use case for each; why is `<input type="file">` uncontrolled?
* What's the warning "changing an uncontrolled input to be controlled" and how do you avoid it?
* Why does React Hook Form re-render less than a `useState` form? (subscriptions via `formState` proxy + `useWatch`/`useController` isolate renders.)
* `defaultValue` vs `value`; `key` to reset an uncontrolled input; `FormData` + form actions in React 19.
