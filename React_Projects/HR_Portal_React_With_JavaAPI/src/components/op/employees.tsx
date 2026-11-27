import { useEffect, useMemo, useState } from 'react';
import { Autocomplete, TextField, CircularProgress } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { call } from '@/api/client/call';
import { useOp } from './useOp';
import { useDebounced } from '@/hooks/useDebounced';
import type { DirectoryEntry, EmployeeSummary } from '@/api/types/employee';

/** Bulk id -> summary resolution through POST /employees/lookup (one cached request per distinct id set). */
export function useEmployeeLookup(ids: (string | undefined | null)[]) {
  const uniq = useMemo(() => [...new Set(ids.filter(Boolean) as string[])].sort(), [ids.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  const q = useQuery<EmployeeSummary[]>({
    queryKey: ['api', 'employee', 'employee.lookup', uniq], enabled: uniq.length > 0, staleTime: 5 * 60_000,
    queryFn: async () => {
      try { return await call<EmployeeSummary[]>('employee.lookup', { body: { ids: uniq } }); }
      catch (e: any) {
        // One unreadable record makes the bulk call fail (HTTP 5xx) - fall back to per-id summaries so the readable ones still resolve.
        if (e?.network || (e?.status ?? 0) < 500) throw e;
        const r = await Promise.allSettled(uniq.slice(0, 40).map((id) => call<EmployeeSummary>('employee.summary', { path: { id } })));
        return r.flatMap((x) => (x.status === 'fulfilled' ? [x.value] : []));
      }
    },
  });
  return useMemo(() => { const m = new Map<string, EmployeeSummary>(); (q.data ?? []).forEach((e) => e.id && m.set(e.id, e)); return m; }, [q.data]);
}
export function EmployeeName({ id, fallback }: { id?: string | null; fallback?: string }) {
  const m = useEmployeeLookup([id]);
  if (!id) return <span className="text-muted">{fallback ?? '—'}</span>;
  const e = m.get(id);
  return <span title={id}>{e?.fullName ?? fallback ?? `${id.slice(0, 8)}…`}{e?.employeeCode ? <span className="text-muted"> · {e.employeeCode}</span> : null}</span>;
}

/** Async employee autocomplete (company directory search, debounced). Value = employee id. */
export function EmployeePicker({ value, onChange, label, error, disabled, size = 'small' }: { value?: string | null; onChange: (id: string | null) => void; label?: string; error?: string; disabled?: boolean; size?: 'small' | 'medium' }) {
  const [input, setInput] = useState('');
  const q = useDebounced(input, 300);
  const list = useOp<{ content: DirectoryEntry[] }>('employee.directory', { query: { q: q || undefined, size: 20 } }, { staleTime: 60_000 });
  const cur = useEmployeeLookup([value]);
  const options = useMemo(() => {
    const o = (list.data?.content ?? []).map((e) => ({ id: e.id!, label: `${e.fullName} (${e.employeeCode})` }));
    const c = value ? cur.get(value) : undefined;
    if (c && !o.some((x) => x.id === c.id)) o.unshift({ id: c.id!, label: `${c.fullName} (${c.employeeCode})` });
    return o;
  }, [list.data, cur, value]);
  const sel = options.find((o) => o.id === value) ?? null;
  useEffect(() => { if (sel) setInput(sel.label); }, [sel?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Autocomplete size={size} disabled={disabled} options={options} value={sel} loading={list.isFetching}
      filterOptions={(x) => x} isOptionEqualToValue={(a, b) => a.id === b.id} getOptionLabel={(o) => o.label}
      onInputChange={(_, v, reason) => { if (reason === 'input') setInput(v); }}
      onChange={(_, v) => onChange(v?.id ?? null)}
      renderInput={(p) => <TextField {...p} label={label} error={!!error} helperText={error} slotProps={{ input: { ...p.InputProps, endAdornment: <>{list.isFetching ? <CircularProgress size={14} /> : null}{p.InputProps.endAdornment}</> } }} />} />
  );
}
