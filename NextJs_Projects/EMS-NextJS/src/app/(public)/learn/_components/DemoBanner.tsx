import type { ReactNode } from 'react';
/** PRIVATE FOLDER (`_components`): never becomes a URL segment, so it safely co-locates the demo's shared UI with its routes. */
export function DemoBanner({ children }: { children: ReactNode }) {
  return <p role="note" className="mb-6 rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100"><strong>Learning demo — not part of the EMS workflow.</strong> {children}</p>;
}
export function DemoModalShell({ title, children }: { title: string; children: ReactNode }) { return <div data-testid="demo-modal" className="space-y-2"><h2 className="text-lg font-bold">{title}</h2>{children}</div>; }
