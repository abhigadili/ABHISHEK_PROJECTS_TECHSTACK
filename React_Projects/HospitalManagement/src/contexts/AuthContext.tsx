import { createContext, use, useCallback, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { authApi } from '@/services/endpoints/authApi';
import { tokenStore } from '@/services/axios/tokenStore';
import { refreshSession } from '@/services/axios/refresh';
import { sessionExpiredChannel, forbiddenChannel } from '@/services/axios/authEvents';
import { queryClient } from '@/app/queryClient';
import { config } from '@/constants/config';
import { can, type Permission } from '@/constants/permissions';
import { useIdleTimer } from '@/hooks/useIdleTimer';
import { decodeJwt } from '@/utils/jwt';
import type { LoginRequest, RegisterAccountRequest, Role, UserAccount } from '@/types';

/* ---------------------------- state (useReducer) ---------------------------- */
type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'anonymous'; user: null; reason?: 'expired' | 'idle' | 'logout' }
  | { status: 'authenticated'; user: UserAccount };

type AuthAction =
  | { type: 'AUTHENTICATED'; user: UserAccount }
  | { type: 'ANONYMOUS'; reason?: 'expired' | 'idle' | 'logout' };

function reducer(_state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'AUTHENTICATED':
      return { status: 'authenticated', user: action.user };
    case 'ANONYMOUS':
      return { status: 'anonymous', user: null, reason: action.reason };
  }
}

/* --------------------- two contexts: state vs. actions ---------------------- */
// Splitting avoids re-rendering action-only consumers (e.g. a logout button) when the user object changes, and the
// value objects are memoised so unrelated provider re-renders do not propagate (Optimizing Context API).
interface AuthStateValue {
  status: AuthState['status'];
  user: UserAccount | null;
  role: Role | undefined;
  isAuthenticated: boolean;
  logoutReason?: 'expired' | 'idle' | 'logout';
}
interface AuthActionsValue {
  login: (c: LoginRequest) => Promise<UserAccount>;
  register: (r: RegisterAccountRequest) => Promise<UserAccount>;
  logout: (reason?: 'expired' | 'idle' | 'logout') => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
  can: (permission: Permission) => boolean;
}

const AuthStateContext = createContext<AuthStateValue | null>(null);
const AuthActionsContext = createContext<AuthActionsValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { status: 'loading', user: null });
  const roleRef = useRef<Role | undefined>(undefined);
  roleRef.current = state.user?.role;

  /* Session restore: a refresh token in sessionStorage means the tab already had a session. */
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!tokenStore.getRefreshToken()) return alive && dispatch({ type: 'ANONYMOUS' });
      try {
        const t = await refreshSession();
        if (alive) dispatch({ type: 'AUTHENTICATED', user: t.user });
      } catch {
        if (alive) dispatch({ type: 'ANONYMOUS' });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const logout = useCallback(async (reason: 'expired' | 'idle' | 'logout' = 'logout') => {
    const rt = tokenStore.getRefreshToken();
    tokenStore.clear();
    dispatch({ type: 'ANONYMOUS', reason });
    queryClient.clear(); // Query Removal: nothing of the previous user may stay in the cache
    if (rt) {
      try {
        await authApi.logout(rt);
      } catch {
        /* the token family is revoked on a best-effort basis; local session is already gone */
      }
    }
  }, []);

  /* Unauthorized / forbidden handling coming from the HTTP layer. */
  useEffect(() => {
    const offExpired = sessionExpiredChannel.subscribe(() => {
      if (roleRef.current) {
        toast.error('Your session has expired. Please sign in again.', { id: 'session-expired' });
        void logout('expired');
      }
    });
    const offForbidden = forbiddenChannel.subscribe(() => toast.error('You do not have permission to perform this action.', { id: 'forbidden' }));
    return () => {
      offExpired();
      offForbidden();
    };
  }, [logout]);

  /* Token renewal: renew one minute before the access token expires (and re-arm after every renewal). */
  const userId = state.user?.id;
  useEffect(() => {
    if (userId === undefined) return;
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      const exp = tokenStore.getAccessTokenExpiresAt() || (decodeJwt(tokenStore.getAccessToken() ?? '')?.exp ?? 0) * 1000;
      const delay = Math.max(exp - Date.now() - 60_000, 5_000);
      timer = setTimeout(async () => {
        try {
          await refreshSession();
          arm();
        } catch {
          /* session-expired event already fired */
        }
      }, delay);
    };
    arm();
    return () => clearTimeout(timer);
  }, [userId]);

  /* Automatic logout after inactivity. */
  useIdleTimer(config.idleLogoutMinutes, () => {
    toast('You were signed out after a period of inactivity.', { icon: '⏱️', id: 'idle' });
    void logout('idle');
  }, state.status === 'authenticated');

  const login = useCallback(async (c: LoginRequest) => {
    const t = await authApi.login(c);
    queryClient.clear();
    tokenStore.set(t);
    dispatch({ type: 'AUTHENTICATED', user: t.user });
    return t.user;
  }, []);

  const register = useCallback((r: RegisterAccountRequest) => authApi.register(r), []);

  const actions = useMemo<AuthActionsValue>(
    () => ({
      login,
      register,
      logout,
      hasRole: (...roles) => !!roleRef.current && roles.includes(roleRef.current),
      can: (p) => can(roleRef.current, p),
    }),
    [login, register, logout],
  );

  const value = useMemo<AuthStateValue>(
    () => ({
      status: state.status,
      user: state.user,
      role: state.user?.role,
      isAuthenticated: state.status === 'authenticated',
      logoutReason: state.status === 'anonymous' ? state.reason : undefined,
    }),
    [state],
  );

  return (
    <AuthActionsContext value={actions}>
      <AuthStateContext value={value}>{children}</AuthStateContext>
    </AuthActionsContext>
  );
}

/* React 19: `use(Context)` replaces useContext and can be called conditionally. */
export function useAuth(): AuthStateValue {
  const v = use(AuthStateContext);
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>');
  return v;
}
export function useAuthActions(): AuthActionsValue {
  const v = use(AuthActionsContext);
  if (!v) throw new Error('useAuthActions must be used inside <AuthProvider>');
  return v;
}
/** Permission checks that re-render with the user (state) but read stable action functions. */
export function useCan(permission: Permission): boolean {
  const { role } = useAuth();
  return can(role, permission);
}
