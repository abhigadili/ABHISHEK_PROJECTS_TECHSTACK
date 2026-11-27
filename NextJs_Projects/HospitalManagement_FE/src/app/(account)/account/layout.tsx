import { requireUser } from '@/server/auth/guard';
import { AppProviders } from '@/providers/AppProviders';
import { AppShell } from '@/components/layout/AppShell';
import { NAV } from '@/lib/constants/navigation';
/** Shared account/security page for every role - the shell menu adapts to the signed-in role. */
export default async function Layout({ children }: { children: React.ReactNode }) {
  const p = await requireUser();
  return <AppProviders user={{ id: p.userId, name: p.name, email: p.email, role: p.role, hospitalId: p.hospitalId }}><AppShell nav={NAV[p.role]}>{children}</AppShell></AppProviders>;
}
