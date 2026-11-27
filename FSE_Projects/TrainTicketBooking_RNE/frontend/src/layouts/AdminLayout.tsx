import { Banknote, CalendarClock, CreditCard, LayoutDashboard, MapPin, Ticket, TrainFront, Undo2, Users, ArrowLeft } from 'lucide-react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { NotificationBell } from '@/components/NotificationBell';
import { UserMenu } from '@/components/UserMenu';
import { useAuth, useScrollTopOnNavigate } from '@/hooks';
import type { RoleKey } from '@/types';

const nav: { to: string; label: string; icon: typeof Users; roles: RoleKey[]; end?: boolean }[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'BOOKING_STAFF', 'TRAIN_OPERATOR'], end: true },
  { to: '/admin/bookings', label: 'Bookings', icon: Ticket, roles: ['ADMIN', 'BOOKING_STAFF'] }, { to: '/admin/payments', label: 'Payments', icon: CreditCard, roles: ['ADMIN', 'BOOKING_STAFF'] },
  { to: '/admin/refunds', label: 'Refunds', icon: Undo2, roles: ['ADMIN', 'BOOKING_STAFF'] }, { to: '/admin/trains', label: 'Trains', icon: TrainFront, roles: ['ADMIN', 'TRAIN_OPERATOR'] },
  { to: '/admin/stations', label: 'Stations', icon: MapPin, roles: ['ADMIN'] }, { to: '/admin/schedules', label: 'Schedules', icon: CalendarClock, roles: ['ADMIN', 'TRAIN_OPERATOR'] },
  { to: '/admin/users', label: 'Users & roles', icon: Users, roles: ['ADMIN'] }, { to: '/admin/cancellation-rules', label: 'Cancellation rules', icon: Banknote, roles: ['ADMIN'] },
];
export function AdminLayout() {
  const { hasRole } = useAuth(); useScrollTopOnNavigate();
  return (
    <div className="grid min-h-screen md:grid-cols-[240px_1fr]">
      <aside className="border-r border-slate-200 bg-slate-900 p-4 text-slate-200">
        <Link to="/admin" className="mb-6 flex items-center gap-2 px-2 text-lg font-bold text-white"><TrainFront />Admin</Link>
        <nav aria-label="Admin" className="flex gap-1 overflow-x-auto md:flex-col">
          {nav.filter((n) => hasRole(...n.roles)).map(({ to, label, icon: I, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}><I size={16} />{label}</NavLink>)}
        </nav>
        <Link to="/" className="mt-6 flex items-center gap-2 px-2 text-xs text-slate-400 hover:text-white"><ArrowLeft size={14} />Back to site</Link>
      </aside>
      <div className="min-w-0">
        <div className="flex h-16 items-center justify-end gap-1 border-b border-slate-200 bg-white px-4 dark:bg-slate-900"><NotificationBell /><UserMenu /></div>
        <main className="p-6"><ErrorBoundary><Outlet /></ErrorBoundary></main>
      </div>
    </div>
  );
}
