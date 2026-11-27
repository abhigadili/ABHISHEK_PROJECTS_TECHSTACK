'use client';
import { History, X } from 'lucide-react';
import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { selectRecent, usePrefs } from '@/store/zustand';

const noop = () => () => {};
/** Zustand-persisted recent searches. `useSyncExternalStore` supplies a server snapshot of `false`, so SSR and the first client render match (no hydration warning). */
export function RecentSearches() {
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const recent = usePrefs(selectRecent); const clear = usePrefs((s) => s.clearRecent);
  if (!hydrated || recent.length === 0) return null;
  return (
    <section aria-label="Recent searches" className="flex flex-wrap items-center gap-2 text-sm">
      <History size={16} className="text-slate-400" />
      {recent.map((r) => <Link key={`${r.from}-${r.to}`} href={`/search?from=${r.from}&to=${r.to}&date=${r.date}`} className="rounded-full border border-slate-200 bg-white px-3 py-1 hover:border-indigo-400 dark:border-slate-700 dark:bg-slate-900">{r.fromName} → {r.toName}</Link>)}
      <button onClick={clear} className="text-slate-400 hover:text-slate-600" aria-label="Clear recent searches"><X size={14} /></button>
    </section>
  );
}
