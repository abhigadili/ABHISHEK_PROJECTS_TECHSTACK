import type { ReactNode } from 'react';
import { Info, TriangleAlert } from 'lucide-react';
import { cn } from '@/utils/cn';

/** Inline banner used to state backend limitations honestly (e.g. "no endpoint for this"). */
export function Notice({ children, tone = 'info', title }: { children: ReactNode; tone?: 'info' | 'warning'; title?: string }) {
  return (
    <div className={cn('flex gap-3 rounded-lg border px-4 py-3 text-sm', tone === 'info' ? 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200' : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200')}>
      {tone === 'info' ? <Info className="mt-0.5 h-4 w-4 shrink-0" /> : <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />}
      <div>
        {title && <div className="font-semibold">{title}</div>}
        <div className="opacity-90">{children}</div>
      </div>
    </div>
  );
}
