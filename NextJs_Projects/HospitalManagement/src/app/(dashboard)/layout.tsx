import type { Metadata } from 'next';
import { getCurrentUser } from '@/lib/auth/user';
import { requireSession } from '@/lib/auth/session';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { NotificationsProvider } from '@/components/providers/NotificationsProvider';
import { ReduxProvider } from '@/components/providers/ReduxProvider';
import { DashboardShell } from '@/components/layouts/DashboardShell';

/**
 * Route Group "(dashboard)" layout - the authenticated application shell. SERVER-SIDE authentication: the session is required and
 * validated against the backend before anything renders, and only a serialisable user snapshot (no token) is handed to the client.
 * Nested layouts: modules below (patients/[patientId], appointments, ...) add their own layouts inside {children}.
 */
export const metadata: Metadata = { title: { default: 'Dashboard', template: '%s · CityCare HMS' }, robots: { index: false, follow: false } };

export default async function DashboardLayout({ children }: LayoutProps<'/'>) {
  await requireSession();
  const me = await getCurrentUser();
  return (
    <AuthProvider user={{ id: me.id, username: me.username, email: me.email, role: me.role }}>
      <ReduxProvider>
        <NotificationsProvider>
          <DashboardShell>{children}</DashboardShell>
        </NotificationsProvider>
      </ReduxProvider>
    </AuthProvider>
  );
}
