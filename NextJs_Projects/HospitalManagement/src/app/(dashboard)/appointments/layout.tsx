import type { ReactNode } from 'react';
/**
 * PARALLEL ROUTE slot `@modal`: rendered next to {children}. On a soft navigation from the list, the INTERCEPTING route
 * `@modal/(.)[appointmentId]` fills this slot (modal over the list); on a hard load, children render the full page instead.
 */
export default function AppointmentsLayout({ children, modal }: { children: ReactNode; modal: ReactNode }) {
  return <>{children}{modal}</>;
}
