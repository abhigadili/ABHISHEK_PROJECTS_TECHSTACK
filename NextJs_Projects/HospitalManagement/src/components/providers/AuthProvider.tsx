'use client';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { can as canDo, type Permission } from '@/constants/permissions';
import type { Role } from '@/types';

/** Context API - Authentication. The server passes a SERIALIZABLE snapshot (no token!) as props; client UI reads it with useAuth(). */
export interface AuthUser { id: number; username: string; email: string; role: Role }
interface AuthCtx { user: AuthUser; can: (p: Permission) => boolean }
const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ user, children }: { user: AuthUser; children: ReactNode }) {
  const value = useMemo<AuthCtx>(() => ({ user, can: (p) => canDo(user.role, p) }), [user]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used inside <AuthProvider>');
  return c;
}
