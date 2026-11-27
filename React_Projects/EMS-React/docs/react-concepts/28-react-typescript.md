# 28 · React with TypeScript (strict mode, generics, reusable generic components)

## 1. Concept explanation
TypeScript adds a static type system on top of JavaScript. In React it types **props**, **state**, **event objects**, **refs**, **Context**,
**Hooks**, **Redux state/actions** and **API contracts**, turning a large class of runtime bugs (misspelt props, `undefined` access, wrong
payload shape) into compile errors. The project compiles with **`"strict": true`** plus `noUnusedLocals`, `noUnusedParameters`,
`noFallthroughCasesInSwitch` (`tsconfig.app.json`), and ESLint **forbids `any`** (`@typescript-eslint/no-explicit-any: error`). `npm run typecheck`
and `npm run build` (`tsc -b`) must pass.

## 2. Syntax
```ts
interface Props { title: string; subtitle?: string; onClose: () => void }                  // required / optional / callback
function DataTable<T>(props: { rows: T[]; getRowId: (row: T) => string | number }) {}      // generic component
function FormTextField<T extends FieldValues>({ name }: { name: Path<T> }) {}              // constrained generic + library path type
type Action = { type: 'push'; toast: Toast } | { type: 'dismiss'; id: number } | { type: 'clear' };   // discriminated union
const PERMISSIONS = { 'employee:manage': ADMIN_ROLES } as const satisfies Record<string, readonly Role[]>;
```

## 3. Actual EMS implementation
| Concept | Where |
|---|---|
| **Strict config, no `any`** | `tsconfig.app.json`, `eslint.config.js` |
| **API contracts** | `types/api.ts` — `Employee`, `Department`, `LeaveRequest`, `DashboardData`, `Paged<T>`, … mirroring `docs/backend-api-integration.md`; request payload types (`EmployeePayload`, `AttendanceCorrection`, `LeaveApplication`) |
| **Generic reusable components** | `DataTable<T>` + `Column<T>` (`components/tables/DataTable.tsx`), `List<T>` (`features/lab/patterns/RenderProp.tsx`), `FormTextField<T extends FieldValues>` / `FormSelect<T>` / `ManagerSelect<T>` (`components/forms/*.tsx`) — callers write `<DataTable<Employee> … />` and column renderers are type-checked against `Employee` |
| **Generic Hooks** | `useApi<T, A extends unknown[]>` (`hooks/useApi.ts`), `useLocalStorage<T>`, `useModal<T>` |
| **Inferred types from schemas** | `type EmployeeFormValues = z.infer<typeof employeeSchema>` — the form type can't drift from the validation rules (`schemas/*.ts`) |
| **Typed Redux** | `useSelector.withTypes<RootState>()`, `useDispatch.withTypes<AppDispatch>()` (`app/store/hooks.ts`); `createAsyncThunk.withTypes<{ state; dispatch; rejectValue: string }>()` (`store/thunk.ts`); `PayloadAction<T>` in slices |
| **Typed RTK Query** | `build.query<Paged<Employee>, EmployeeListQuery \| void>`; `MutationResult` types flow into generated hooks |
| **Discriminated unions / exhaustive `switch`** | `toastReducer` actions (`contexts/NotificationContext.tsx`), `cartReducer` (`BasicHooksDemo.tsx`) |
| **Literal unions + lookup tables** | `Role`, `Permission = keyof typeof PERMISSIONS` (`constants/roles.ts`), `AttendanceStatus`, `LeaveStatus` → `Record<Status, Color>` in calendars/badges |
| **`as const satisfies`** | `PERMISSIONS` — typo'd role or permission names are compile errors, yet literal types are preserved |
| **Typed events & refs** | `ChangeEvent<HTMLInputElement>` (`FileUpload`), `useRef<HTMLInputElement>(null)`, `forwardRef<FileUploadHandle, Props>` |
| **Typed Context** | `createContext<Value \| null>(null)` + guard hook that narrows to `Value` |
| **Module augmentation** | `declare module 'axios' { interface AxiosRequestConfig { skipGlobalError?: boolean; _retried?: boolean } }` (`api/httpClient.ts`); `vite-env.d.ts` for `import.meta.env` |
| **Router typing** | `UIMatch<unknown, RouteHandle>` for breadcrumbs; typed `useOutletContext<EmployeeOutletContext>()` |
| **Type-only imports** | `import type { … }` used consistently (`isolatedModules`) |

Where a cast remains it is documented: e.g. RTK `build.query` endpoint args typed as `X | void` for optional params; `zodResolver` returns need no cast thanks to non-transforming schemas.

## 4. Relevant file paths
`tsconfig.app.json`, `eslint.config.js`, `src/types/api.ts`, `src/components/tables/DataTable.tsx`, `src/components/forms/fields.tsx`,
`src/hooks/useApi.ts`, `src/app/store/hooks.ts`, `src/store/thunk.ts`, `src/constants/roles.ts`.

## 5. Practical implementation — a generic form field
```tsx
export function FormTextField<T extends FieldValues>({ name, label, type = 'text' }: BaseProps<T> & Pick<TextFieldProps, 'type'>) {
  const { control } = useFormContext<T>();
  const { field, fieldState } = useController({ name, control });      // `name` is Path<T> → "education.0.degree" is checked
  return <TextField {...field} label={label} type={type} value={field.value ?? ''} error={!!fieldState.error} helperText={fieldState.error?.message} />;
}
<FormTextField<EmployeeFormValues> name="education.0.degree" label="Degree" />   // ✔      name="education.0.degre" → compile error
```
The same idea makes `DataTable<Employee>` reject a column that reads `e.fullname`. Typing is also *tested indirectly*: `npm run typecheck` is part of the
completion checklist and caught real bugs during development (e.g. an unused import, a missing `skip` option on a hook).

## 6. Why the concept is used
The API surface is large (52 endpoints, nested form values, roles, statuses). Types document it, make refactors safe, and give editor
autocompletion for form paths and Redux state.

## 7. Advantages and limitations
**+** compile-time safety, self-documenting props, refactor confidence, inference from Zod/RTK removes duplication. **−** generics make some
signatures heavy (`Path<T>`, `withTypes`); server data can still violate the declared types at runtime (types are erased — hence runtime validation in Zod for *inputs* and defensive `?.` for outputs); library types sometimes need casts (`as never` in `trigger(fields)`); strictness slows initial development but pays back quickly.

## 8. Interview-related considerations
* `interface` vs `type`; `unknown` vs `any`; discriminated unions and exhaustiveness; `satisfies`; `as const`.
* Typing `useState`, `useRef`, `useReducer`, Context, event handlers, `forwardRef`, children (`ReactNode`).
* Generic components and hooks — how is `T` inferred? Constraints (`extends FieldValues`)?
* Why is `React.FC` unnecessary? How do you type a polymorphic component (`as` prop)?
* Runtime validation vs static typing (Zod), and the "types are erased" caveat.
