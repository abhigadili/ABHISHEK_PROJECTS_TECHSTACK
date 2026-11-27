'use client';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider, isServer } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ApiClientError } from '@/lib/api/client';
import { emitToast } from '@/components/ui/toast';
/** QueryClient defaults (stale/gc time, retry policy, back-off) + cache-level error toasts. */
function make() {
  return new QueryClient({
    queryCache: new QueryCache({ onError: (e, q) => { if (!q.meta?.silent && !(e instanceof ApiClientError && [401, 403].includes(e.status))) emitToast({ kind: 'error', text: e.message }); } }),
    mutationCache: new MutationCache({ onError: (e, _v, _c, m) => { if (!m.meta?.silent) emitToast({ kind: 'error', text: e.message }); } }),
    defaultOptions: { queries: { staleTime: 30_000, gcTime: 5 * 60_000, retry: (n, e) => !(e instanceof ApiClientError && e.status >= 400 && e.status < 500) && n < 2, retryDelay: (n) => Math.min(1000 * 2 ** n, 8000), refetchOnWindowFocus: true }, mutations: { retry: 0 } },
  });
}
let browser: QueryClient | undefined;
const get = () => (isServer ? make() : (browser ??= make()));
export function QueryProvider({ children }: { children: ReactNode }) { const [c] = useState(get); return <QueryClientProvider client={c}>{children}</QueryClientProvider>; }
