'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, api, type Paged } from '@/lib/api';

export function errMsg(e: unknown) { return e instanceof ApiError ? e.message : 'Something went wrong'; }

/** GET helper with loading / error state and manual reload. `path === null` skips the request. */
export function useApi<T = any>(path: string | null) {
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  const seq = useRef(0);
  const load = useCallback(async () => {
    if (!path) return;
    const my = ++seq.current; setLoading(true);
    try { const d = await api.get<T>(path); if (my === seq.current) { setData(d); setError(null); } }
    catch (e) { if (my === seq.current) setError(errMsg(e)); }
    finally { if (my === seq.current) setLoading(false); }
  }, [path]);
  useEffect(() => { void load(); }, [load]);
  return { data, error, loading, reload: load, setData };
}

export function usePaged<T = any>(path: string | null) {
  const [res, setRes] = useState<Paged<T> | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  const seq = useRef(0);
  const load = useCallback(async () => {
    if (!path) return;
    const my = ++seq.current; setLoading(true);
    try { const d = await api.getPaged<T>(path); if (my === seq.current) { setRes(d); setError(null); } }
    catch (e) { if (my === seq.current) setError(errMsg(e)); }
    finally { if (my === seq.current) setLoading(false); }
  }, [path]);
  useEffect(() => { void load(); }, [load]);
  return { rows: res?.data, meta: res?.meta, error, loading, reload: load };
}

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}
