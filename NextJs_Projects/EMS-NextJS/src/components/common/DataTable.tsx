import type { Key, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export interface Column<T> { key: string; header: ReactNode; render: (row: T) => ReactNode; className?: string; hideBelow?: 'sm' | 'md' | 'lg' }
const hide = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell' } as const;

/**
 * Generic, server-compatible table: `DataTable<Employee>` infers the row type from `rows`, so every column renderer is type-checked.
 * Columns are functions, which can't cross the server→client boundary — which is exactly why this stays a Server Component.
 */
export function DataTable<T>({ rows, columns, rowKey, caption }: { rows: T[]; columns: Column<T>[]; rowKey: (row: T) => Key; caption?: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full text-left text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="border-b border-border bg-black/[.03] text-xs tracking-wide text-muted uppercase dark:bg-white/5">
          <tr>{columns.map((c) => <th key={c.key} scope="col" className={cn('px-4 py-3 font-semibold', c.hideBelow && hide[c.hideBelow], c.className)}>{c.header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={rowKey(r)} className="hover:bg-black/[.03] dark:hover:bg-white/5">
              {columns.map((c) => <td key={c.key} className={cn('px-4 py-3 align-middle', c.hideBelow && hide[c.hideBelow], c.className)}>{c.render(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
