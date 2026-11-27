import type { ReactNode } from 'react';
export function SimpleTable<T>({ rows, cols, empty = 'No records' }: { rows: T[]; cols: { head: string; cell: (r: T) => ReactNode; right?: boolean }[]; empty?: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:bg-slate-900"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800"><tr>{cols.map((c) => <th key={c.head} className={`px-4 py-2 font-medium ${c.right ? 'text-right' : ''}`}>{c.head}</th>)}</tr></thead>
      <tbody>{rows.length === 0 ? <tr><td colSpan={cols.length} className="px-4 py-8 text-center text-slate-500">{empty}</td></tr> : rows.map((r, i) => <tr key={i} className="border-t border-slate-100">{cols.map((c) => <td key={c.head} className={`px-4 py-2.5 ${c.right ? 'text-right' : ''}`}>{c.cell(r)}</td>)}</tr>)}</tbody></table></div>
  );
}
