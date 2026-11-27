'use client';
import { useState } from 'react';
import { usePatientSearch } from '@/features/appointments/hooks';
import { useDebounce } from '@/hooks/useDebounce';
import { Input } from '@/components/ui/input';
import type { Patient } from '@/types';

/** Reusable patient search-and-select: debounced input + TanStack Query (enabled at 2+ chars, cancelled automatically by AbortSignal). */
export function PatientPicker({ value, onChange, error }: { value: Patient | null; onChange: (p: Patient | null) => void; error?: string }) {
  const [text, setText] = useState('');
  const q = usePatientSearch(useDebounce(text, 350));
  if (value) return <div className="flex items-center justify-between rounded-lg border border-primary bg-primary/5 px-3 py-2 text-sm"><span>{value.firstName} {value.lastName} <span className="text-muted">· #{value.id} · {value.phone}</span></span><button type="button" className="text-primary" onClick={() => onChange(null)}>change</button></div>;
  return (
    <div><Input placeholder="Search patient by name, e-mail or phone (min 2 letters)" aria-label="Search patient" aria-invalid={!!error} value={text} onChange={(e) => setText(e.target.value)} />
      {q.isFetching && <p className="mt-1 text-xs text-muted">Searching…</p>}
      <ul className="mt-1 max-h-48 overflow-y-auto rounded-lg border-line">{(q.data?.content ?? []).map((p) => <li key={p.id}><button type="button" className="w-full cursor-pointer px-3 py-2 text-left text-sm hover:bg-surface2" onClick={() => onChange(p)}>{p.firstName} {p.lastName} <span className="text-xs text-muted">· {p.phone}</span></button></li>)}</ul>
      {error && <p role="alert" className="mt-1 text-xs text-danger">{error}</p>}</div>
  );
}
