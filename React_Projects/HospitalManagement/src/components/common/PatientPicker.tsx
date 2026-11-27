import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, UserRound, X } from 'lucide-react';
import { patientApi } from '@/services/endpoints/patientApi';
import { queryKeys } from '@/services/queryKeys';
import { useDebouncedValue } from '@/hooks/useDebounce';
import { Spinner } from './Spinner';
import type { Patient } from '@/types';
import { cn } from '@/utils/cn';

/**
 * Search-and-select patient (staff). Debounced input -> GET /patients?q= with request cancellation (the query signal is
 * forwarded to Axios, so superseded searches are aborted). Used by booking, prescriptions, lab requests, bills, records.
 */
export function PatientPicker({ value, onChange, label = 'Patient', error, autoFocus }: { value: Patient | null; onChange: (p: Patient | null) => void; label?: string; error?: string; autoFocus?: boolean }) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const q = useDebouncedValue(text.trim(), 300);
  const id = useId();
  const results = useQuery({
    queryKey: queryKeys.patients.list({ q, page: 0, size: 8 }),
    queryFn: ({ signal }) => patientApi.list({ q: q || undefined, page: 0, size: 8 }, signal),
    enabled: open,
    staleTime: 15_000,
  });

  if (value) {
    return (
      <div>
        <span className="mb-1 block text-sm font-medium">{label}</span>
        <div className="flex items-center justify-between rounded-md border border-line bg-surface px-3 py-2 text-sm">
          <span className="flex items-center gap-2"><UserRound className="h-4 w-4 text-muted" /><b>{value.firstName} {value.lastName}</b><span className="text-muted">#{value.id} · {value.phone}</span></span>
          <button type="button" aria-label="Change patient" onClick={() => onChange(null)} className="rounded p-1 text-muted hover:text-fg"><X className="h-4 w-4" /></button>
        </div>
      </div>
    );
  }
  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1 block text-sm font-medium">{label}</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input id={id} autoFocus={autoFocus} value={text} onChange={(e) => { setText(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="Search by name, e-mail or phone…" role="combobox" aria-expanded={open} aria-controls={`${id}-list`} aria-invalid={!!error}
          className={cn('h-9 w-full rounded-md border border-line bg-surface pl-9 pr-3 text-sm text-fg placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500', error && 'border-red-500')} />
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {open && (
        <ul id={`${id}-list`} role="listbox" className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-md border border-line bg-surface shadow-lg">
          {results.isFetching && !results.data && <li className="p-3"><Spinner label="Searching…" /></li>}
          {results.isError && <li className="p-3 text-sm text-red-600">Search failed.</li>}
          {results.data?.content.length === 0 && <li className="p-3 text-sm text-muted">No matching patients.</li>}
          {results.data?.content.map((p) => (
            <li key={p.id} role="option" aria-selected={false}>
              <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10" onClick={() => { onChange(p); setOpen(false); setText(''); }}>
                <span><b>{p.firstName} {p.lastName}</b> <span className="text-muted">#{p.id}</span></span>
                <span className="text-xs text-muted">{p.phone}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
