import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useAuth } from './AuthenticationContext';
import { ROLE_LABEL, type Role } from '@/constants/roles';
import { initials } from '@/utils/format';

export interface UserContextValue {
  displayName: string;
  initials: string;
  email: string;
  roleLabel: string;
  role: Role | null;
  employeeId: number | null;
  employeeCode: string | null;
}
const UserContext = createContext<UserContextValue | null>(null);

/** A NESTED provider: it sits inside AuthenticationProvider and derives presentation data (display name, initials) from it. */
export function UserProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const value = useMemo<UserContextValue>(() => {
    const e = profile?.employee;
    const displayName = e ? `${e.firstName} ${e.lastName}` : (user?.email ?? 'Guest');
    return {
      displayName,
      initials: initials(displayName),
      email: user?.email ?? '',
      role: user?.role ?? null,
      roleLabel: user ? ROLE_LABEL[user.role] : '',
      employeeId: user?.employeeId ?? null,
      employeeCode: e?.employeeCode ?? null,
    };
  }, [user, profile]);
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useCurrentUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useCurrentUser must be used inside <UserProvider>');
  return ctx;
}
