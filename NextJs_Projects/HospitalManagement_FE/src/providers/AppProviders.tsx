'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { Provider } from 'react-redux';
import { makeStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { AuthContext, type AuthUser } from './auth-context';
import { TooltipProvider } from '@/components/ui/radix-extras';
/** Providers of the authenticated app: Auth (Context), Redux (booking workflow), Radix tooltip, persisted Zustand rehydration. */
export function AppProviders({ user, children }: { user: AuthUser; children: ReactNode }) {
  const [store] = useState(makeStore);
  useEffect(() => { void useUiStore.persist.rehydrate(); }, []);
  return <AuthContext.Provider value={user}><Provider store={store}><TooltipProvider>{children}</TooltipProvider></Provider></AuthContext.Provider>;
}
