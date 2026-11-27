'use client';
import { useState, type ReactNode } from 'react';
import { Provider } from 'react-redux';
import { makeStore } from '@/store/redux/store';

/** One store per browser session, created lazily in state (never a module singleton, so SSR requests never share state). */
export function ReduxProvider({ children }: { children: ReactNode }) {
  const [store] = useState(makeStore);
  return <Provider store={store}>{children}</Provider>;
}
