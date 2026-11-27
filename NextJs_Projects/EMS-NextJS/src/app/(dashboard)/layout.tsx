import { Suspense, type ReactNode } from 'react';
import type { Metadata } from 'next';
import { AuthProvider } from '@/contexts/AuthContext';
import { StoreProvider } from '@/store/StoreProvider';
import { requireSession } from '@/lib/server/session';
import { can } from '@/constants/roles';
import { NAV } from '@/constants/navigation';
import { Sidebar } from '@/features/layout/Sidebar';
import { Topbar, Breadcrumbs } from '@/features/layout/Topbar';
import { getMyProfile } from '@/lib/server/employees';
import { Skeleton } from '@/components/common/ui';

/** Everything behind login is excluded from search engines (also enforced by robots.ts and the X-Robots-Tag-equivalent metadata). */
export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } };

/** Server Component: resolves the session, filters navigation by role on the server, and passes only plain props to client islands. */
async function AuthedShell({ children }: { children: ReactNode }) {
  const user = await requireSession(); // server-side route protection (redirects to /login)
  const items = NAV.filter((n) => !n.permission || can(user.role, n.permission));
  // own picture flag for the avatar; failure must never break the shell
  const hasPicture = user.employeeId ? await getMyProfile().then((p) => !!p.profilePictureUrl).catch(() => false) : false;
  return (
    <AuthProvider user={{ id: user.id, employeeId: user.employeeId, username: user.username, email: user.email, role: user.role, name: user.name, employeeCode: user.employeeCode }}>
      <StoreProvider>
        <div className="flex min-h-screen">
          <Sidebar items={items} />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar hasPicture={hasPicture} />
            <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">
              <Breadcrumbs />
              {children}
            </main>
            <footer className="border-t border-border px-6 py-3 text-center text-xs text-muted">© {new Date().getUTCFullYear()} EMS · Next.js + Express</footer>
          </div>
        </div>
      </StoreProvider>
    </AuthProvider>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-screen" aria-busy="true">
      <aside className="hidden w-64 space-y-3 border-r border-border bg-surface p-4 lg:block">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-8" />)}</aside>
      <div className="flex-1 p-6"><Skeleton className="mb-6 h-8 w-64" /><Skeleton className="h-64" /></div>
    </div>
  );
}

/**
 * (dashboard) ROUTE-GROUP layout: sidebar + top bar for every authenticated page; the group name is not part of the URL. The session
 * read is a runtime API, so it sits inside <Suspense>: the skeleton is the prerendered static shell, the real shell streams in.
 */
export default function DashboardLayout({ children }: LayoutProps<'/'>) {
  return <Suspense fallback={<ShellSkeleton />}><AuthedShell>{children}</AuthedShell></Suspense>;
}
