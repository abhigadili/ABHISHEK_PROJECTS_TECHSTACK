import { useCallback, useEffect, useRef, useState } from 'react';
import { isCancel } from '@/api/httpClient';
import { errorMessage } from '@/api/errors';

export interface UseApiResult<T, A extends unknown[]> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  /** Run (or re-run) the request. Resolves with the data, or `undefined` if it failed / was superseded. */
  run: (...args: A) => Promise<T | undefined>;
  reset: () => void;
}

/**
 * Generic, typed async-request hook for one-off Axios calls (the org chart uses it; list/detail screens use RTK Query).
 *  - AbortController: unmount or a newer `run` cancels the in-flight request
 *  - stale-response guard: only the LATEST request may write state
 *  - cleanup: no "set state on unmounted component" and no leaked requests
 */
export function useApi<T, A extends unknown[] = []>(
  fn: (signal: AbortSignal, ...args: A) => Promise<T>,
  options: { immediate?: boolean; args?: A } = {},
): UseApiResult<T, A> {
  const { immediate = false, args } = options;
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(immediate);
  const controller = useRef<AbortController | null>(null);
  const seq = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async (...a: A) => {
    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;
    const id = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fnRef.current(ctrl.signal, ...a);
      if (id === seq.current) {
        setData(result);
        setLoading(false);
      }
      return result;
    } catch (e) {
      if (isCancel(e) || ctrl.signal.aborted) return undefined; // superseded or unmounted → not an error
      if (id === seq.current) {
        setError(errorMessage(e));
        setLoading(false);
      }
      return undefined;
    }
  }, []);

  const reset = useCallback(() => {
    controller.current?.abort();
    seq.current += 1;
    setData(undefined);
    setError(null);
    setLoading(false);
  }, []);

  const argsKey = JSON.stringify(args ?? []);
  useEffect(() => {
    if (immediate) void run(...((args ?? []) as A));
    return () => controller.current?.abort(); // cleanup on unmount / when args change
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `args` is compared through its JSON key
  }, [immediate, argsKey, run]);

  return { data, error, loading, run, reset };
}
