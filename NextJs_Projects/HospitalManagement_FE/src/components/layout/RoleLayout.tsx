import type { ReactNode } from 'react';
import { requireRole } from '@/server/auth/guard';
import { AppProviders } from '@/providers/AppProviders';
import { AppShell } from './AppShell';
import { MuiProvider } from '@/providers/MuiProvider';
import { NAV } from '@/lib/constants/navigation';
import type { RoleKey } from '@/lib/constants/rbac';

/**
 * Authoritative server-side area guard + authenticated shell. Each role area (patient, doctor, ...) has a one-line layout using this.
 * Only a serialisable user snapshot (no token) crosses to the client.
 */
export async function RoleLayout({ roles, children, mui = false }: { roles: RoleKey[]; children: ReactNode; mui?: boolean }) {
  const p = await requireRole(roles);
  const shell = <AppShell nav={NAV[p.role]}>{children}</AppShell>;
  return <AppProviders user={{ id: p.userId, name: p.name, email: p.email, role: p.role, hospitalId: p.hospitalId }}>{mui ? <MuiProvider>{shell}</MuiProvider> : shell}</AppProviders>;
}
