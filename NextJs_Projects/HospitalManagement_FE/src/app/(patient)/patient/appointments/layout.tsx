import type { ReactNode } from 'react';
/** PARALLEL ROUTE slot @modal rendered next to the list; the INTERCEPTING route (.)[id] fills it on soft navigation. */
export default function Layout({ children, modal }: { children: ReactNode; modal: ReactNode }) { return <>{children}{modal}</>; }
