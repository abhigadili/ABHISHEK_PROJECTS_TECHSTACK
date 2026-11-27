'use client';
import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils/cn';

export interface Option { value: string; label: string }

/**
 * Client island for the filter bar. State lives in the URL (shareable, back/forward-friendly): typing updates a local controlled input,
 * the DEBOUNCED value is pushed to the query string with `router.replace` inside `useTransition`, so the server re-renders the list
 * while the current page stays interactive (`isPending` dims it). Any filter change resets `page`.
 */
export function EmployeeFilters({ departments, designations }: { departments: Option[]; designations: Option[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(params.get('search') ?? '');
  const debounced = useDebounce(search, 350);

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    if (!('page' in patch)) next.delete('page');
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  useEffect(() => { if (debounced !== (params.get('search') ?? '')) update({ search: debounced }); }, [debounced]); // eslint-disable-line react-hooks/exhaustive-deps
  // back/forward changes the URL → adopt it ("derived state": adjust during render instead of syncing in an effect)
  const urlSearch = params.get('search') ?? '';
  const [seenUrlSearch, setSeenUrlSearch] = useState(urlSearch);
  if (seenUrlSearch !== urlSearch) { setSeenUrlSearch(urlSearch); setSearch(urlSearch); }

  const sel = 'rounded-lg border border-border bg-surface px-3 py-2 text-sm';
  return (
    <form role="search" aria-label="Filter employees" onSubmit={(e) => e.preventDefault()} className={cn('mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5', isPending && 'opacity-70')} aria-busy={isPending}>
      <label className="sm:col-span-2"><span className="sr-only">Search</span>
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, code or title" className={cn(sel, 'w-full')} aria-label="Search" /></label>
      <label><span className="sr-only">Department</span>
        <select aria-label="Department" value={params.get('department') ?? ''} onChange={(e) => update({ department: e.target.value })} className={cn(sel, 'w-full')}><option value="">All departments</option>{departments.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</select></label>
      <label><span className="sr-only">Status</span>
        <select aria-label="Status" value={params.get('status') ?? ''} onChange={(e) => update({ status: e.target.value })} className={cn(sel, 'w-full')}><option value="">Active</option><option value="INACTIVE">Inactive</option><option value="ALL">All statuses</option></select></label>
      <label><span className="sr-only">Sort</span>
        <select aria-label="Sort" value={params.get('sort') ?? ''} onChange={(e) => update({ sort: e.target.value })} className={cn(sel, 'w-full')}><option value="">Name (A–Z)</option><option value="name:desc">Name (Z–A)</option><option value="joiningDate:desc">Newest joiners</option><option value="joiningDate">Oldest joiners</option><option value="department">Department</option></select></label>
      <input type="hidden" value={designations.length} readOnly />
    </form>
  );
}
