import type { ReactNode } from 'react';

/**
 * Layout for /employees/** with a PARALLEL-ROUTE slot `@modal`. On a SOFT navigation from the list to /employees/4 the intercepting route
 * `@modal/(.)[id]` fills `modal` (the list stays visible underneath); on a HARD navigation / refresh the slot falls back to default.tsx
 * (null) and `children` renders the full /employees/[id] page.
 */
export default function EmployeesLayout({ children, modal }: LayoutProps<'/employees'>) {
  return <>{children}{modal as ReactNode}</>;
}
