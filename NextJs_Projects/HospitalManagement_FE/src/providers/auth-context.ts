'use client';
import { createContext, useContext } from 'react';
import type { RoleKey } from '@/lib/constants/rbac';
/** Context API - authentication snapshot passed from the server as serialisable props (never contains a token). */
export interface AuthUser { id: number; name: string; email: string; role: RoleKey; hospitalId: number | null }
export const AuthContext = createContext<AuthUser | null>(null);
export function useAuth(): AuthUser { const u = useContext(AuthContext); if (!u) throw new Error('useAuth must be used inside <AppProviders>'); return u; }
