import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import {
  bootstrapSession,
  clearAuthError,
  login as loginThunk,
  logout as logoutThunk,
  sessionExpired,
} from '@/store/slices/authSlice';
import { registerSessionExpiredHandler } from '@/api/httpClient';
import type { CurrentUser, SessionUser } from '@/types/api';

export interface AuthContextValue {
  user: SessionUser | null;
  profile: CurrentUser | null;
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
  isAuthenticated: boolean;
  /** True until the start-up session restore has finished (guards flash-of-login-page). */
  isBootstrapping: boolean;
  error: string | null;
  login: (identifier: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Context API façade over the Redux auth slice: Redux owns the session STATE and its transitions (thunks), Context gives
 * components a tiny, stable, framework-agnostic API (`useAuth`). Swapping Redux out would not change a single consumer.
 */
export function AuthenticationProvider({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const { user, profile, status, error, bootstrapped } = useAppSelector((s) => s.auth);

  useEffect(() => {
    registerSessionExpiredHandler(() => dispatch(sessionExpired())); // HTTP layer → Redux
    void dispatch(bootstrapSession());
  }, [dispatch]);

  const login = useCallback(
    async (identifier: string, password: string) => {
      const r = await dispatch(loginThunk({ identifier, password }));
      return loginThunk.fulfilled.match(r);
    },
    [dispatch],
  );
  const logout = useCallback(async () => {
    await dispatch(logoutThunk());
  }, [dispatch]);
  const clearError = useCallback(() => {
    dispatch(clearAuthError());
  }, [dispatch]);

  // useMemo: consumers re-render only when something they can see actually changed (Context performance)
  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      status,
      error,
      isAuthenticated: status === 'authenticated',
      isBootstrapping: !bootstrapped,
      login,
      logout,
      clearError,
    }),
    [user, profile, status, error, bootstrapped, login, logout, clearError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthenticationProvider>');
  return ctx;
}
