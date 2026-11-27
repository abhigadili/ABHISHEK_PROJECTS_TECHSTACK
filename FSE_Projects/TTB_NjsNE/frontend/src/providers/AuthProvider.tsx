'use client';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { RoleKey, User } from '@/types';

interface AuthCtx { user: User | null; loading: boolean; isAuthenticated: boolean; isStaff: boolean; isAdmin: boolean; hasRole: (...r: RoleKey[]) => boolean }
const Ctx = createContext<AuthCtx | null>(null);

/**
 * Auth state via Context. Protected layouts (server) pass `initialUser` straight from the verified session, so there is no flash.
 * Public/static pages pass nothing: the user is then fetched once from /api/session after hydration (keeps those pages statically rendered).
 */
export function AuthProvider({ initialUser, children }: { initialUser?: User | null; children: ReactNode }) {
  const q = useQuery({
    queryKey: ['session'], staleTime: 60_000, initialData: initialUser === undefined ? undefined : { user: initialUser },
    queryFn: async () => (await (await fetch('/api/session', { cache: 'no-store' })).json()) as { user: User | null },
  });
  const user = q.data?.user ?? null;
  const value = useMemo<AuthCtx>(() => ({
    user, loading: q.isLoading, isAuthenticated: !!user, isStaff: !!user?.roles.some((r) => r !== 'PASSENGER'), isAdmin: !!user?.roles.includes('ADMIN'),
    hasRole: (...r) => !!user && r.some((x) => user.roles.includes(x)),
  }), [user, q.isLoading]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useAuth() { const c = useContext(Ctx); if (!c) throw new Error('useAuth must be used inside <AuthProvider>'); return c; }
