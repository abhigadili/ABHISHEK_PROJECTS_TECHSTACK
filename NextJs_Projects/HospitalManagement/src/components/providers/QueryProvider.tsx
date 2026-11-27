'use client';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider, isServer } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ApiError } from '@/lib/utilities/api-error';
import { emitToast } from '@/components/ui/toast';

/** QueryClient + defaults (stale time, gc time, retry, retry delay, network mode) + Query/Mutation caches that surface errors as toasts. */
function makeClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (query.meta?.silent) return;
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return; // handled by auth flow / forbidden UI
        emitToast({ kind: 'error', text: error.message });
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _v, _c, mutation) => { if (!mutation.meta?.silent) emitToast({ kind: 'error', text: error.message }); },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000, // fresh for 30s -> no refetch on remount
        gcTime: 5 * 60_000, // garbage-collect unused cache entries after 5 min
        retry: (n, e) => !(e instanceof ApiError && e.status >= 400 && e.status < 500) && n < 2, // never retry 4xx
        retryDelay: (n) => Math.min(1000 * 2 ** n, 8000), // exponential back-off
        refetchOnWindowFocus: true, // background refetching
        networkMode: 'online',
      },
      mutations: { retry: 0, networkMode: 'online' },
    },
  });
}
let browserClient: QueryClient | undefined;
export const getQueryClient = () => (isServer ? makeClient() : (browserClient ??= makeClient()));

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(getQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
