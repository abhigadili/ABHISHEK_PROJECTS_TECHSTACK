import { TrainFront } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { NotificationBell } from '@/components/NotificationBell';
import { UserMenu } from '@/components/UserMenu';
import { Button } from '@/components/ui/Button';
import { useAuth, useScrollTopOnNavigate } from '@/hooks';

export function Header() {
  const { isAuthenticated } = useAuth();
  const link = ({ isActive }: { isActive: boolean }) => `rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'text-indigo-700' : 'text-slate-600 hover:text-slate-900'}`;
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur dark:bg-slate-900/90 dark:border-slate-800">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold text-indigo-700"><TrainFront />TrainTicket</Link>
        <nav className="flex items-center gap-1" aria-label="Main">
          <NavLink to="/" end className={link}>Search</NavLink>
          {isAuthenticated && <NavLink to="/account/bookings" className={link}>My bookings</NavLink>}
          {isAuthenticated && <NavLink to="/account/pnr" className={link}>PNR status</NavLink>}
        </nav>
        <div className="flex items-center gap-1">
          {isAuthenticated ? <><NotificationBell /><UserMenu /></> : <><Button variant="ghost" asChild><Link to="/login">Sign in</Link></Button><Button asChild><Link to="/register">Register</Link></Button></>}
        </div>
      </div>
    </header>
  );
}
export function PublicLayout() {
  useScrollTopOnNavigate();
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8"><Outlet /></main>
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500">Train Ticket Booking · a learning project - payments are simulated, no real money moves.</footer>
    </div>
  );
}
