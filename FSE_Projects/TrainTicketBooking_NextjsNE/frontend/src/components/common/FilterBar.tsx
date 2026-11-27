'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useDeferredValue, useEffect, useState, useTransition } from 'react';
import { Input } from '@/components/ui/Field';
import { RadixSelect } from '@/components/ui/RadixSelect';
import { usePrefs } from '@/store/zustand';

const SORTS = [{ value: 'departure', label: 'Earliest departure' }, { value: 'duration', label: 'Shortest journey' }, { value: 'fare', label: 'Lowest fare' }, { value: 'name', label: 'Train name' }];
const TYPES = ['EXPRESS', 'SUPERFAST', 'PREMIUM', 'PASSENGER', 'SUBURBAN'];

/**
 * Filters/sorting live in the URL (useSearchParams + router.replace), so results are shareable and the Server Component re-renders
 * with the new query. useTransition keeps the old list on screen (dimmed) while the server renders the new one.
 */
export function FilterBar() {
  const router = useRouter(); const pathname = usePathname(); const params = useSearchParams(); const [pending, start] = useTransition();
  const setSortPref = usePrefs((s) => s.setSortBy);
  const [text, setText] = useState(params.get('q') ?? ''); const deferred = useDeferredValue(text);
  const push = (k: string, v: string) => start(() => { const n = new URLSearchParams(params.toString()); if (v) n.set(k, v); else n.delete(k); router.replace(`${pathname}?${n.toString()}`, { scroll: false }); });
  useEffect(() => { if ((params.get('q') ?? '') !== deferred) { const t = setTimeout(() => push('q', deferred), 250); return () => clearTimeout(t); } // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferred]);
  return (
    <div className="flex flex-wrap items-center gap-2" aria-busy={pending}>
      <Input aria-label="Filter by train name or number" placeholder="Filter by name / number" className="w-52" value={text} onChange={(e) => setText(e.target.value)} />
      <RadixSelect label="Train type" value={params.get('type') || 'ALL'} onValueChange={(v) => push('type', v === 'ALL' ? '' : v)} options={[{ value: 'ALL', label: 'All types' }, ...TYPES.map((t) => ({ value: t, label: t[0] + t.slice(1).toLowerCase() }))]} />
      <RadixSelect label="Sort by" value={params.get('sort') || 'departure'} onValueChange={(v) => { setSortPref(v as never); push('sort', v); }} options={SORTS} />
      {pending && <span className="text-xs text-slate-500">Updating…</span>}
    </div>
  );
}
