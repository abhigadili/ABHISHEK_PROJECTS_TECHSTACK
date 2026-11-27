# 12 · Zod validation

## 1. Concept explanation
Zod is a TypeScript-first schema library: you declare the *shape and rules* once, get a **runtime validator** and a **static type**
(`z.infer<typeof schema>`) from the same declaration. With `@hookform/resolvers/zod` it becomes React Hook Form's validation engine,
returning one error per field path (e.g. `education.1.institution`).

> **Backend validation remains the final authority.** Zod gives fast, friendly feedback and prevents obviously-bad requests; the
> Express API re-validates everything (express-validator) and its `VALIDATION_ERROR`/`409` responses are mapped back onto fields.

## 2. Syntax
```ts
const schema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  endDate: z.string(),
}).superRefine((v, ctx) => { if (v.endDate < v.startDate) ctx.addIssue({ code: 'custom', path: ['endDate'], message: '…' }); });
type Values = z.infer<typeof schema>;
await schema.safeParseAsync(data);   // async refinements
```

## 3. Actual EMS implementation (all eight required schemas)
| Required schema | File → export |
|---|---|
| Employee registration | `schemas/employee.ts` → `employeeSchema` / `createEmployeeSchema({ isEmailTaken })` |
| Employee profile | `schemas/employee.ts` → `employeeProfileSchema` (only the fields the backend lets people change) |
| Department creation | `schemas/organization.ts` → `departmentSchema` |
| Designation creation | `schemas/organization.ts` → `designationSchema` |
| Leave application | `schemas/leaveAttendance.ts` → `leaveApplicationSchema` |
| Attendance correction | `schemas/leaveAttendance.ts` → `attendanceCorrectionSchema` |
| Login | `schemas/auth.ts` → `loginSchema` |
| User creation | `schemas/auth.ts` → `userCreateSchema` (+ `resetPasswordSchema`, `changePasswordSchema`) |
Extras: job-change (`jobHistorySchema`), holiday, leave type, balance adjustment.

| Required rule | Implementation |
|---|---|
| Required fields | `requiredText('First name', 60)`, `requiredDate('Joining date')` in `schemas/common.ts` |
| Email | `requiredEmail`, `optionalEmail` (`''` allowed when optional) |
| Phone | `PHONE_RE` identical to the backend regex `^[+\d][\d\s().-]{5,28}$` |
| Password | `passwordSchema` mirrors the backend policy: 10–72 chars, upper, lower, digit, special |
| Confirm password | `.refine(v => v.newPassword === v.confirmPassword, { path: ['confirmPassword'] })` in `resetPasswordSchema`, `changePasswordSchema`, `userCreateSchema` |
| Date range | `leaveApplicationSchema` (end ≥ start), `experienceSchema`, `educationSchema` (end year ≥ start year), `employeeSchema` (probation end ≥ joining) |
| Conditional | half-day leave must be a single day; login fields validated **only when** `createAccount` is ticked (`crossFieldRules` in `employee.ts`) |
| Cross-field | `superRefine` — date ranges, password/confirm, DOB in the past |
| Backend-dependent duplicate email | `createEmployeeSchema({ isEmailTaken })` adds an **async** `.refine(async email => !(await isEmailTaken(email)))`; the lookup is cached by `hooks/useFormValidation.ts` |

Tested exhaustively in `src/schemas/schemas.test.ts` (31 tests), e.g. `it.each` over five weak passwords asserting the exact message for each.

## 4. Relevant file paths
`src/schemas/common.ts`, `auth.ts`, `employee.ts`, `organization.ts`, `leaveAttendance.ts`, `src/schemas/schemas.test.ts`, `src/hooks/useFormValidation.ts`.

## 5. Practical implementation — async + conditional + per-row rules
```ts
export function createEmployeeSchema(opts: { isEmailTaken?: (email: string) => Promise<boolean> } = {}) {
  const shape = opts.isEmailTaken
    ? { ...baseShape, workEmail: requiredEmail.refine(async (e) => !(await opts.isEmailTaken!(e)), 'This email is already used by another employee') }
    : baseShape;
  return z.object(shape).superRefine(crossFieldRules);        // creates use the async version; edits use the plain sync one
}
```
`education: z.array(educationSchema).max(10)` makes every dynamic row validate individually; the test proves row 1's errors don't leak onto row 0.

## 6. Why the concept is used
One declaration gives validation, error messages and the TypeScript type, so the form type can't drift from the rules; schemas are
plain functions, so they're unit-tested without rendering anything.

## 7. Advantages and limitations
**+** single source of truth, composable (`educationSchema` reused inside the employee schema), async refinements, great error paths. **−** client rules can drift from the server's (keep them mirrored and treat the server as authoritative — see the PHONE/password constants); `superRefine` on an object only runs when all base fields passed (users may see cross-field errors after fixing basics); Zod 3 chosen over 4 for resolver compatibility; async refinements run on every validation pass (cache them); large schemas add bundle weight (Zod + RHF are shipped with the form pages' chunks, not the login page).

## 8. Interview-related considerations
* Why validate on both client and server? (UX vs security.) What would happen if only the client validated?
* `z.infer` vs writing interfaces by hand; `parse` vs `safeParse`; `refine` vs `superRefine`; `transform`/`coerce` (avoided here so input and output types match RHF).
* How do you validate "password confirmation" or "end date after start date"? (`refine`/`superRefine` with `path`.)
* How would you share rules between frontend and backend? (shared package or OpenAPI-generated schemas.)
