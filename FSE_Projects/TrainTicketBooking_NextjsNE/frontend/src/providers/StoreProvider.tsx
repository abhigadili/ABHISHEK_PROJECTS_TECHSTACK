'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { Provider } from 'react-redux';
import { makeStore, type AppStore } from '@/store';
import { hydrate, markHydrated } from '@/store/bookingSlice';
import { loadBookingFlow } from '@/store/middleware';

/** One Redux store per browser tab (created lazily in a ref - never at module scope). Restores the booking draft after mount. */
export function StoreProvider({ children }: { children: ReactNode }) {
  const ref = useRef<AppStore | null>(null); if (!ref.current) ref.current = makeStore();
  useEffect(() => { const saved = loadBookingFlow(); ref.current!.dispatch(saved ? hydrate(saved) : markHydrated()); }, []);
  return <Provider store={ref.current}>{children}</Provider>;
}
