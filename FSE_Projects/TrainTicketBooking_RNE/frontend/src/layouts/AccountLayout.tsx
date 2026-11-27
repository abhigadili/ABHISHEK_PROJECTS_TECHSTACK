import { Bell, CreditCard, History, Search, Ticket, Undo2, UserRound, Users } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useScrollTopOnNavigate } from '@/hooks';
import { Header } from './PublicLayout';

const items = [
  { to: '/account', label: 'Overview', icon: Ticket, end: true }, { to: '/account/bookings', label: 'My bookings', icon: History }, { to: '/account/pnr', label: 'PNR status', icon: Search },
  { to: '/account/passengers', label: 'Saved passengers', icon: Users }, { to: '/account/payments', label: 'Payments', icon: CreditCard }, { to: '/account/refunds', label: 'Refunds', icon: Undo2 },
  { to: '/account/notifications', label: 'Notifications', icon: Bell }, { to: '/account/profile', label: 'Profile & security', icon: UserRound },
];
export function AccountLayout() {
  useScrollTopOnNavigate();
  return (
    <div className="min-h-screen"><Header />
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 md:grid-cols-[220px_1fr]">
        <nav aria-label="Account" className="flex gap-1 overflow-x-auto md:flex-col">
          {items.map(({ to, label, icon: I, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}><I size={16} />{label}</NavLink>)}
        </nav>
        <main className="min-w-0"><ErrorBoundary><Outlet /></ErrorBoundary></main>
      </div>
    </div>
  );
}
