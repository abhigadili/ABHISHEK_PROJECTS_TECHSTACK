import type { ReactNode } from 'react';
import { SideNav, type NavItem } from '@/components/layout/SideNav';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { requireUser } from '@/lib/server/session';
import { AuthProvider } from '@/providers/AuthProvider';

const items: NavItem[] = [
  { href: '/account', label: 'Overview', icon: 'Ticket', segment: null }, { href: '/account/bookings', label: 'My bookings', icon: 'History', segment: 'bookings' }, { href: '/account/pnr', label: 'PNR status', icon: 'Search', segment: 'pnr' },
  { href: '/account/passengers', label: 'Saved passengers', icon: 'Users', segment: 'passengers' }, { href: '/account/payments', label: 'Payments', icon: 'CreditCard', segment: 'payments' }, { href: '/account/refunds', label: 'Refunds', icon: 'Undo2', segment: 'refunds' },
  { href: '/account/notifications', label: 'Notifications', icon: 'Bell', segment: 'notifications' }, { href: '/account/profile', label: 'Profile & security', icon: 'UserRound', segment: 'profile' },
];
/**
 * PROTECTED layout (dynamic: it reads the session cookie). The user is verified on the SERVER before anything renders and handed to
 * the client AuthProvider, so there is no signed-out flash. Unauthenticated -> /login?next=..., role missing -> forbidden().
 */
export default async function PassengerLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return (
    <AuthProvider initialUser={user}>
      <div className="min-h-screen"><SiteHeader />
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 md:grid-cols-[220px_1fr]">
          <aside><SideNav items={items} label="Account" /></aside>
          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </AuthProvider>
  );
}
