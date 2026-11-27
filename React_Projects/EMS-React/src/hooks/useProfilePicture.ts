import { useEffect, useState, useSyncExternalStore } from 'react';
import { employeeApi } from '@/services/employeeApi';

/** Downloaded pictures (as object URLs) keyed by employee id. `null` = "known to have no picture". */
const cache = new Map<string, string | null>();

/* Tiny external store: bumping `generation` re-runs every mounted picture hook, so the header avatar, the profile page and any
   list row all refresh together after an upload/delete — regardless of which key (`'me'` or the numeric id) each one used. */
let generation = 0;
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

/** Forget every cached picture (after an upload or delete). */
export function invalidateProfilePicture(_id?: number | 'me') {
  cache.forEach((url) => {
    if (url) URL.revokeObjectURL(url);
  });
  cache.clear();
  generation += 1;
  listeners.forEach((l) => l());
}

/**
 * Pictures are authenticated endpoints, so the browser can't load them from an <img src>. Download the Blob with Axios and
 * expose it as an object URL. `hasPicture` (from the API's `profilePictureUrl`) avoids requesting a picture that would 404.
 */
export function useProfilePicture(id: number | 'me' | null | undefined, hasPicture = true, version = 0) {
  const key = id == null ? '' : String(id);
  const gen = useSyncExternalStore(
    subscribe,
    () => generation,
    () => 0,
  );
  const [src, setSrc] = useState<string | null>(() => cache.get(key) ?? null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id == null || !hasPicture) {
      setSrc(null);
      return;
    }
    const cached = cache.get(key);
    if (cached !== undefined) {
      setSrc(cached);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    employeeApi
      .picture(id, ctrl.signal)
      .then((blob) => {
        const url = blob ? URL.createObjectURL(blob) : null;
        cache.set(key, url);
        if (!ctrl.signal.aborted) setSrc(url);
      })
      .catch(() => {
        /* aborted or failed → initials fallback */
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [id, key, hasPicture, version, gen]);

  return { src, loading };
}
