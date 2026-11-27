import type { ReactNode } from 'react';

export interface DetailItem {
  label: string;
  value: ReactNode;
  wide?: boolean;
}

/** Definition list used by every "details" view (CSS Grid, responsive 1→2→3 columns). */
export function DetailList({ items, columns = 2 }: { items: DetailItem[]; columns?: 1 | 2 | 3 }) {
  const grid = columns === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : columns === 2 ? 'sm:grid-cols-2' : '';
  return (
    <dl className={`grid grid-cols-1 gap-x-8 gap-y-4 ${grid}`}>
      {items.map((it) => (
        <div key={it.label} className={it.wide ? 'sm:col-span-full' : undefined}>
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{it.label}</dt>
          <dd className="mt-0.5 break-words text-sm">{it.value === null || it.value === undefined || it.value === '' ? '—' : it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
