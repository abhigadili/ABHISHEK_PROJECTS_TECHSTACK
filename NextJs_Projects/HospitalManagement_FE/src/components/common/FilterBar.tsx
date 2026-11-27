'use client';
import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/radix-extras';
import { useUrlState } from '@/hooks/useUrlState';
import { useDebounce } from '@/hooks/useDebounce';
const ALL = '__all__'; // Radix Select forbids empty-string values
/** Search + select filters (Radix Select) stored in the URL; the server page re-renders with the new data (debounced search). */
export function FilterBar({ placeholder = 'Search…', selects = [] }: { placeholder?: string; selects?: { name: string; label: string; options: { value: string; label: string }[] }[] }) {
  const { params, set, pending } = useUrlState(); const [q, setQ] = useState(params.get('q') ?? ''); const d = useDebounce(q, 400);
  useEffect(() => { if (d !== (params.get('q') ?? '')) set({ q: d }); }, [d]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="mb-4 flex flex-wrap items-center gap-2"><div className="relative min-w-56 flex-1 sm:max-w-sm"><Search className="absolute top-3 left-3 size-4 text-muted" /><Input aria-label="Search" placeholder={placeholder} className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} /></div>{selects.map((s) => <Select key={s.name} label={s.label} value={params.get(s.name) ?? ALL} onValueChange={(v) => set({ [s.name]: v === ALL ? '' : v })} options={[{ value: ALL, label: s.label }, ...s.options]} />)}{pending && <span className="text-xs text-muted">Updating…</span>}</div>;
}
