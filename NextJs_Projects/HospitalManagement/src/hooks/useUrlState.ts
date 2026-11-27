'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useTransition } from 'react';

/** URL state (search params) as shared, linkable, server-readable state. Uses router.replace inside useTransition. */
export function useUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const set = useCallback((patch: Record<string, string | number | undefined | null>, mode: 'replace' | 'push' = 'replace') => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) { if (v === undefined || v === null || v === '') sp.delete(k); else sp.set(k, String(v)); }
    if (!('page' in patch)) sp.delete('page');
    startTransition(() => { const url = `${pathname}${sp.size ? `?${sp}` : ''}`; if (mode === 'push') router.push(url); else router.replace(url); });
  }, [params, pathname, router]);
  return { params, set, pending };
}
