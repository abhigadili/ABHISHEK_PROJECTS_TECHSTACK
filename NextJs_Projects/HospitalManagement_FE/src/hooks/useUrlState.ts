'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useTransition } from 'react';
/** URL (search-param) state with router.replace inside useTransition: shareable, server-readable filters. */
export function useUrlState() {
  const router = useRouter(); const pathname = usePathname(); const params = useSearchParams(); const [pending, start] = useTransition();
  const set = useCallback((patch: Record<string, string | number | null | undefined>) => { const sp = new URLSearchParams(params.toString()); for (const [k, v] of Object.entries(patch)) { if (v === undefined || v === null || v === '') sp.delete(k); else sp.set(k, String(v)); } if (!('page' in patch)) sp.delete('page'); start(() => router.replace(`${pathname}${sp.size ? `?${sp}` : ''}`)); }, [params, pathname, router]);
  return { params, set, pending };
}
