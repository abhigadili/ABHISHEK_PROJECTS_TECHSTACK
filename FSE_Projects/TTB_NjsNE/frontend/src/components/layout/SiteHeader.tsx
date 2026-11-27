'use client';
import { TrainFront } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useSelectedLayoutSegment } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks';
import { NavLink } from './NavLink';
import { NotificationBell } from './NotificationBell';
import { UserMenu } from './UserMenu';

const link = 'rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300';
/** Site header (Client Component: it reads auth state and the active route segment). */
export function SiteHeader() {
  const { isAuthenticated, loading } = useAuth(); const segment = useSelectedLayoutSegment(); // first segment under the current layout, e.g. "search" | "trains" | null
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold text-indigo-700 dark:text-indigo-300"><Image src="/images/logo.png" alt="" width={28} height={28} priority /><span>TrainTicket</span></Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          <NavLink href="/" exact className={link}>Search</NavLink><NavLink href="/trains" className={link}>Trains</NavLink><NavLink href="/stations" className={link}>Stations</NavLink><NavLink href="/help" className={link}>Help</NavLink>
          {isAuthenticated && <NavLink href="/account/bookings" className={link}>My bookings</NavLink>}
          {isAuthenticated && <NavLink href="/pnr-status" className={link}>PNR status</NavLink>}
        </nav>
        <div className="flex items-center gap-1" data-segment={segment ?? 'home'}>
          {loading ? <span className="h-9 w-24 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" aria-hidden /> : isAuthenticated ? <><NotificationBell /><UserMenu /></> : <><Button variant="ghost" asChild><Link href="/login">Sign in</Link></Button><Button asChild><Link href="/register">Register</Link></Button></>}
        </div>
      </div>
    </header>
  );
}
export const BrandMark = () => <TrainFront className="text-indigo-600" />;
