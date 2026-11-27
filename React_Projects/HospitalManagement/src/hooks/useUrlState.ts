import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Query parameters as state: filters/pagination live in the URL (shareable, back-button friendly) via useSearchParams.
 * Setting a filter resets `page` to 0.
 */
export function useUrlState<K extends string>(keys: readonly K[], defaults: Partial<Record<K, string>> = {}) {
  const [params, setParams] = useSearchParams();
  const values = useMemo(() => {
    const out = {} as Record<K, string>;
    for (const k of keys) out[k] = params.get(k) ?? defaults[k] ?? '';
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, keys.join('|')]);

  const set = useCallback(
    (patch: Partial<Record<K, string | number | undefined>>, opts: { keepPage?: boolean } = {}) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch) as [K, string | number | undefined][]) {
            if (v === undefined || v === '' || String(v) === (defaults[k] ?? '')) next.delete(k);
            else next.set(k, String(v));
          }
          if (!opts.keepPage && !('page' in patch)) next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setParams],
  );
  return [values, set] as const;
}
