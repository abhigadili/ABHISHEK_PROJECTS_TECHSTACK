'use client';
import { useId, useState } from 'react';
import { useEmployeeSearch } from '@/hooks/useEmployees';
import { cn } from '@/lib/utils/cn';

/**
 * Searchable employee picker (ARIA combobox pattern): typing debounces a request to the BFF (`/api/employees?search=`), stale requests are
 * aborted, results appear in a listbox, Arrow/Enter/Escape work. Replaces a fixed "first 100 employees" <select>, so it scales to any headcount.
 * Controlled: `value` is the employee id as a string ('' = none); `initialLabel` is the display name of the preselected employee.
 */
export function EmployeePicker({ label, value, onChange, initialLabel, excludeId, name, error }: { label: string; value: string; onChange: (id: string) => void; initialLabel?: string; excludeId?: number; name?: string; error?: string }) {
  const uid = useId();
  const [term, setTerm] = useState('');
  const [picked, setPicked] = useState(initialLabel ?? '');
  const [active, setActive] = useState(0);
  const { hits, loading, error: searchError } = useEmployeeSearch(term);
  const options = hits.filter((h) => h.id !== excludeId);
  const open = term.trim().length >= 2;
  const select = (id: number, fullName: string) => { onChange(String(id)); setPicked(fullName); setTerm(''); setActive(0); };
  return (
    <div className="relative">
      <label htmlFor={`${uid}-in`} className="mb-1 block text-sm font-medium">{label}</label>
      {name && <input type="hidden" name={name} value={value} />}
      {value && !term ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm" data-testid="picker-selected">
          <span className="flex-1">{picked || `Employee #${value}`}</span>
          <button type="button" className="text-xs underline" onClick={() => { onChange(''); setPicked(''); }} aria-label={`Clear ${label}`}>Clear</button>
        </div>
      ) : (
        <input id={`${uid}-in`} role="combobox" aria-expanded={open} aria-controls={`${uid}-list`} aria-autocomplete="list" aria-activedescendant={open && options[active] ? `${uid}-o${options[active].id}` : undefined} aria-invalid={!!error}
          value={term} onChange={(e) => { setTerm(e.target.value); setActive(0); }} placeholder="Type at least 2 letters to search" autoComplete="off"
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, options.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            else if (e.key === 'Enter' && open && options[active]) { e.preventDefault(); select(options[active].id, options[active].fullName); }
            else if (e.key === 'Escape') setTerm('');
          }}
          className={cn('w-full rounded-lg border bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40', error ? 'border-red-500' : 'border-border')} />
      )}
      {open && (
        <ul id={`${uid}-list`} role="listbox" aria-label={`${label} results`} className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-surface shadow-lg">
          {loading && <li className="px-3 py-2 text-sm text-muted" role="status">Searching…</li>}
          {!loading && searchError && <li className="px-3 py-2 text-sm text-red-600" role="alert">{searchError}</li>}
          {!loading && !searchError && options.length === 0 && <li className="px-3 py-2 text-sm text-muted">No matches</li>}
          {options.map((h, i) => (
            <li key={h.id} id={`${uid}-o${h.id}`} role="option" aria-selected={i === active} onMouseDown={(e) => { e.preventDefault(); select(h.id, h.fullName); }} className={cn('cursor-pointer px-3 py-2 text-sm', i === active && 'bg-primary/10')}>
              {h.fullName} <span className="text-xs text-muted">{h.employeeCode}{h.department ? ` · ${h.department}` : ''}</span>
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
