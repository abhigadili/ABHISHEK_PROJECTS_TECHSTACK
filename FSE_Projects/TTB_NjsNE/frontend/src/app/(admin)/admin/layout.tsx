import { ArrowLeft, Banknote, TrainFront } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { SideNav, type NavItem } from '@/components/layout/SideNav';
import { UserMenu } from '@/components/layout/UserMenu';
import { ADMIN_ROLES } from '@/lib/constants';
import { requireUser } from '@/lib/server/session';
import { AuthProvider } from '@/providers/AuthProvider';

const items: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: 'LayoutDashboard', segment: null },
  { href: '/admin/bookings', label: 'Bookings', icon: 'Ticket', segment: 'bookings', roles: ['ADMIN', 'BOOKING_STAFF'] }, { href: '/admin/payments', label: 'Payments', icon: 'CreditCard', segment: 'payments', roles: ['ADMIN', 'BOOKING_STAFF'] },
  { href: '/admin/refunds', label: 'Refunds', icon: 'Undo2', segment: 'refunds', roles: ['ADMIN', 'BOOKING_STAFF'] }, { href: '/admin/cancellations', label: 'Cancellations', icon: 'XCircle', segment: 'cancellations', roles: ['ADMIN', 'BOOKING_STAFF'] },
  { href: '/admin/trains', label: 'Trains', icon: 'TrainFront', segment: 'trains', roles: ['ADMIN', 'TRAIN_OPERATOR'] }, { href: '/admin/routes', label: 'Routes', icon: 'Route', segment: 'routes', roles: ['ADMIN', 'TRAIN_OPERATOR'] },
  { href: '/admin/schedules', label: 'Schedules', icon: 'CalendarClock', segment: 'schedules', roles: ['ADMIN', 'TRAIN_OPERATOR'] }, { href: '/admin/stations', label: 'Stations', icon: 'MapPin', segment: 'stations', roles: ['ADMIN'] },
  { href: '/admin/users', label: 'Users & roles', icon: 'Users', segment: 'users', roles: ['ADMIN'] },
];
/** Role-gated layout: only staff roles get in (others see forbidden.tsx). Every page below additionally checks its own role, and Express has the final say. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireUser(ADMIN_ROLES);
  return (
    <AuthProvider initialUser={user}>
      <div className="grid min-h-screen md:grid-cols-[240px_1fr]">
        <aside className="bg-slate-900 p-4 text-slate-200">
          <Link href="/admin" className="mb-6 flex items-center gap-2 px-2 text-lg font-bold text-white"><TrainFront />Admin</Link>
          <SideNav items={items} label="Admin" dark />
          <Link href="/" className="mt-6 flex items-center gap-2 px-2 text-xs text-slate-400 hover:text-white"><ArrowLeft size={14} />Back to site</Link>
          <span className="sr-only"><Banknote /></span>
        </aside>
        <div className="min-w-0"><div className="flex h-16 items-center justify-end gap-1 border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900"><NotificationBell /><UserMenu /></div><main className="p-6">{children}</main></div>
      </div>
    </AuthProvider>
  );
}
