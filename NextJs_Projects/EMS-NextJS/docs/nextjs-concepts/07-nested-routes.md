# 7. Nested routes

> **Version:** Next.js 16.4.5 · React 19.3.0 · TypeScript 5.9 (App Router, `cacheComponents` enabled). Examples use the App Router only (no Pages Router APIs). Deprecated or removed APIs are called out where relevant.

## 1. Concept explanation
Nested folders create nested URL segments **and** nested layouts: a child route renders inside its parent’s layout.

## 2. Syntax
```text
app/employees/[id]/layout.tsx          (shared header + tabs)
app/employees/[id]/page.tsx            /employees/42
app/employees/[id]/profile/page.tsx    /employees/42/profile
app/employees/[id]/attendance/page.tsx
app/employees/[id]/leave-history/page.tsx
app/employees/[id]/job-history/page.tsx
app/employees/[id]/edit/page.tsx
```

## 3. How Next.js implements it
Layouts wrap their children and are not re-rendered when sibling pages change. `useSelectedLayoutSegment()` (Client) tells a layout which child is active so tabs can highlight themselves.

## 4. Actual EMS implementation
`EmployeeTabs` (client) uses `useSelectedLayoutSegment()` from the `[id]` layout: `null` ⇒ Overview, otherwise the folder name. Each tab page fetches only its own data (attendance rows, leave history, job history) while the header comes from the layout once.

## 5. Relevant file paths
- `src/app/(dashboard)/employees/[id]/layout.tsx`
- `src/features/employees/EmployeeTabs.tsx`
- `src/app/(dashboard)/employees/[id]/job-history/page.tsx`
- `src/app/(dashboard)/employees/[id]/attendance/page.tsx`

## 6. Practical use case
HR flips between *Profile*, *Attendance* and *Job history* of one employee; the header (name, status, actions) never reloads.

## 7. Why the concept is used
Shared UI and data live at the highest segment that needs them; per-tab data stays lazy.

## 8. Advantages
- No duplicate fetch/markup.
- Independent loading UI per tab (`[id]/loading.tsx`).

## 9. Limitations
- A layout cannot know the search params of the page.
- Deeply nested layouts make error boundaries harder to reason about.

## 10. Common mistakes
- Putting the tabs in each page (duplication).
- Expecting the header to refetch when the tab changes (it does not — `router.refresh()` or revalidation does that).

## 11. Interview-related considerations
- How do layouts behave across navigation?
