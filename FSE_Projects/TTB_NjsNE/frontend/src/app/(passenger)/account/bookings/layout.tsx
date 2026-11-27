import type { ReactNode } from 'react';

/** PARALLEL ROUTES: `children` is the history list / full booking page, `modal` is the intercepted booking-detail dialog rendered on top. */
export default function BookingsLayout({ children, modal }: { children: ReactNode; modal: ReactNode }) { return <>{children}{modal}</>; }
