# 26. Server Actions

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
Server Actions are async functions marked `'use server'` that run on the server and can be invoked from forms or event handlers on the client. Next.js turns the call into a POST (with a built-in Origin check) and handles the round trip.

## 2. Syntax
```ts
'use server';
export async function saveDepartmentAction(_prev: ActionState, fd: FormData): Promise<ActionState> { … redirect(`/departments/${id}`); }
```
```tsx
const [state, formAction] = useActionState(action, {});
<form action={formAction}><SubmitButton /></form>   // useFormStatus inside the button
```

## 3. How Next.js implements it
Forms with `action={fn}` work **before hydration** (progressive enhancement: native POST) and after (no page reload). After a mutation, `revalidatePath`/`revalidateTag`/`updateTag` refresh data; `redirect()` navigates. Always treat the function as a **public endpoint**: authenticate, authorise and validate inside.

## 4. Actual EMS implementation
* Files: `src/actions/{auth,employees,departments,leaves,attendance,holidays,profile,notifications,users}.ts` with shared helpers in `_shared.ts`.
* **`secured(permission, fn, values)`** = guard (session + permission) → run → map errors; it re-throws framework control flow with `unstable_rethrow` so `redirect()` is not swallowed as a form error.
* **Validation** with zod on the server (`schemas/forms.ts`) — client validation is only UX. Field errors are returned as `{ fieldErrors }` and echoed `values` so the form re-renders with what the user typed.
* **UI:** `ActionForm` (`useActionState`), `SubmitButton` (`useFormStatus`: pending/disabled/`aria-busy`), `Field` (reads its own error by `name`, `useId` label wiring), toast on success.
* **File upload:** `FormData` with `File` (`uploadPictureAction`, `applyLeaveAction`, `registerAction`) validated by `checkFile` (type + size) before forwarding to Express.
* **Programmatic call with JSON:** the RHF `EmployeeForm` calls `saveEmployeeAction(mode, id, json)` inside `startTransition`; the action re-validates with the **same** zod schema.
* **Mutations → cache:** `updateTag` + `revalidatePath` (doc 32).

## 5. Relevant file paths
- `src/actions/_shared.ts`
- `src/actions/employees.ts`
- `src/actions/departments.ts`
- `src/actions/leaves.ts`
- `src/components/forms/ActionForm.tsx`
- `src/features/employees/EmployeeForm.tsx`
- `tests/actions.test.ts`
- `tests/components.test.tsx`

## 6. Practical use case
HR creates an employee: client RHF validation → Server Action → zod again → Express → `updateTag('departments')` (headcounts) → navigation to the new profile.

## 7. Why the concept is used
Less glue code than hand-written API routes, built-in CSRF protection, progressive enhancement, tight cache integration.

## 8. Advantages
- No bespoke endpoints for mutations.
- Works without JS.
- Type-safe end to end.
- Integrated revalidation and redirects.

## 9. Limitations
- POST-only and sequential per client (not for reads).
- Arguments/returns must be serialisable.
- Error/redirect semantics need care.
- Harder to call from non-React clients.

## 10. Common mistakes
- Trusting the UI to hide the button (always `secured(...)`).
- Catching `redirect()` inside `try/catch`.
- Returning raw backend errors.
- Doing reads with actions.

## 11. Interview-related considerations
- What is progressive enhancement here?
- How are Server Actions secured (Origin check, encrypted closures, you must authorise)?
- `useActionState` vs `useFormStatus`?
