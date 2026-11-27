'use client';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { can, type Permission, type Role } from '@/constants/roles';

/** Only NON-sensitive display data crosses the server→client boundary: never tokens, never the cookie. */
export interface ClientUser { id: number; employeeId: number | null; username: string | null; email: string; role: Role; name: string; employeeCode: string | null }
interface AuthCtx { user: ClientUser; can: (p: Permission) => boolean }
const Ctx = createContext<AuthCtx | null>(null);

/** The server layout resolves the session and hands the plain user object to this provider (props must be serialisable). */
export function AuthProvider({ user, children }: { user: ClientUser; children: ReactNode }) {
  const value = useMemo(() => ({ user, can: (p: Permission) => can(user.role, p) }), [user]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useAuthContext(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used inside <AuthProvider> (dashboard area)');
  return c;
}
