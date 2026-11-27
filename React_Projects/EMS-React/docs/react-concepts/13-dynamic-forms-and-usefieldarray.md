# 13 · Dynamic forms and `useFieldArray` (the React equivalent of Angular's `FormArray`)

## 1. Concept explanation
React has no `FormArray` class. React Hook Form's **`useFieldArray`** provides the same capability: a list of repeated groups
(education records, work experience, contacts…) that the user can **add and remove at runtime**, where *every row is validated
individually* and has its own error messages.

Mapping from Angular:
| Angular | React Hook Form |
|---|---|
| `FormArray` | `useFieldArray({ control, name: 'education' })` |
| `FormGroup` row | one object in the array; fields registered as `education.${i}.degree` |
| `array.push(group)` / `removeAt(i)` | `append(obj)` / `remove(i)` (also `insert`, `move`, `swap`, `replace`, `update`) |
| `trackBy` | the generated **`field.id`** used as the React `key` |
| `array.controls[i].errors` | `formState.errors.education?.[i]?.degree` (shown automatically by `FormTextField`) |

## 2. Syntax
```tsx
const { fields, append, remove } = useFieldArray({ control, name: 'education' });
{fields.map((f, i) => (
  <Row key={f.id} onRemove={() => remove(i)}>               {/* key = f.id, NEVER the index */}
    <FormTextField name={`education.${i}.degree`} label="Degree" />
  </Row>
))}
<Button onClick={() => append({ institution: '', degree: '', fieldOfStudy: '', startYear: '', endYear: '' })}>Add education</Button>
```

## 3. Actual EMS implementation
The employee form (`features/employees/EmployeeFormPage.tsx`, 5 steps) contains:

| Required section | Component (in `features/employees/form/FieldArraySections.tsx`) | Schema |
|---|---|---|
| Personal details · Contact details · Address | plain registered fields (step 1) | `employeeSchema` |
| **Emergency contacts** (dynamic) | `EmergencyContactsSection` (max 5; first one is saved to the server) | `emergencyContactSchema` |
| **Education history** (dynamic add/remove) | `EducationSection` | `educationSchema` |
| **Previous work experience** (dynamic add/remove) | `ExperienceSection` | `experienceSchema` |
| **Skills and certifications** (two arrays in one section) | `SkillsSection` | inline objects in `employeeSchema` |

* Users can **add** and **remove** education and experience records; each row displays **its own** validation errors (e.g. "Institution is required" only under the incomplete row); *conditional fields* (login section) and *nested* paths work together with arrays.
* `useFormContext` lets each section reach `control` without props; the section components are therefore reusable and testable.
* **Persistence note:** the backend has no endpoint for these lists (see `docs/backend-api-integration.md` → Missing APIs), so they are kept in `localStorage` per employee via `services/qualificationsStore.ts` and the form says so. The first emergency contact *is* sent to the server.

## 4. Relevant file paths
`src/features/employees/form/FieldArraySections.tsx`, `form/formMapping.ts` (`toFormValues`, `toPayload`, `toQualifications`),
`src/schemas/employee.ts`, `src/services/qualificationsStore.ts`, tests in `src/features/pages.test.tsx` and `e2e/ems.spec.ts`.

## 5. Practical implementation — what the tests prove
Unit test (`pages.test.tsx` → *"dynamic rows: add, validate each entry individually, remove"*):
1. add two education rows → two `Education-row` elements;
2. fill only row 1, press **Next** → row 2 shows *"Institution is required"*, row 1 shows no error (**per-entry validation**);
3. remove row 2 → one row remains **and still holds "MIT"** (stable keys — with index keys React would keep the wrong DOM state).

E2E (`e2e/ems.spec.ts`, scenario 3) does the same in a real browser against the real backend and then creates the employee.
Mapping on save (`toQualifications`): the *extra* emergency contacts (index ≥ 1) go to the browser store; `toPayload` sends contact #1 as
`emergencyContactName/Phone/Relation`.

## 6. Why the concept is used
HR data is naturally one-to-many (a person has several degrees and jobs). A fixed number of inputs can't model that; arrays keep the form
data identical in shape to the domain (`education: EducationRecord[]`) and validation declarative (`z.array(educationSchema)`).

## 7. Advantages and limitations
**+** add/remove/reorder with identity-safe keys; per-row errors for free; arrays validate through the same Zod schema; very low re-render cost. **−** field names are template strings (typos aren't caught by TypeScript beyond `Path<T>`); `useFieldArray` must be the sole owner of its array (don't also `setValue` the whole array); `remove()` + async state can reorder errors — always key by `field.id`; arrays held only in the browser (here) are not shared across devices until a backend endpoint exists (proposed in the integration doc).

## 8. Interview-related considerations
* What replaces Angular's `FormArray` in React? (`useFieldArray`.) Why must the key be `field.id`, not `index`?
* `append` vs `insert` vs `update` vs `replace`; how do you validate array length (`.min/.max` on `z.array`)?
* How does RHF track dirty/touched state inside arrays? How do you show an error for the whole array (`errors.education.root`)?
* Dynamic forms driven by schema/config — how would you generate fields from metadata?
