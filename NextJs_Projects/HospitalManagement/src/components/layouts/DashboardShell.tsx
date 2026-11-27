'use client';
import Link from 'next/link';
import { usePathname, useRouter, useSelectedLayoutSegment, useSelectedLayoutSegments } from 'next/navigation';
import { Fragment, useEffect, useState, useTransition, type ReactNode } from 'react';
import { Bell, ChevronRight, Cross, LogOut, Menu, UserRound, WifiOff, X } from 'lucide-react';
import { NAV } from '@/constants/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { useNotifications } from '@/components/providers/NotificationsProvider';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { DropdownContent, DropdownItem, DropdownLabel, DropdownMenu, DropdownSeparator, DropdownTrigger } from '@/components/ui/dropdown';
import { logoutAction } from '@/actions/auth';
import { useIdleLogout } from '@/hooks/useIdleLogout';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useHospitalStore } from '@/store/zustand/hospitalStore';
import { usePharmacyStore } from '@/store/zustand/pharmacyStore';
import { useShortlist } from "@/store/zustand/shortlistStore";
import { cn } from '@/lib/utilities/cn';
import { humanize } from '@/lib/utilities/format';
import { APP_NAME } from '@/lib/config/public';

/** Active module: segment 0 of the (dashboard) layout; "/patients/me" is a distinct nav entry. */
function useActiveSegment() {
  const seg = useSelectedLayoutSegment();
  const segs = useSelectedLayoutSegments();
  return seg === 'patients' && segs[1] === 'me' ? 'patients-me' : seg;
}

function Breadcrumbs() {
  const pathname = usePathname();
  const parts = pathname.split('/').filter(Boolean);
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1 text-sm text-muted sm:flex">
      <Link href="/dashboard" className="hover:text-fg">Home</Link>
      {parts.map((p, i) => (
        <Fragment key={i}>
          <ChevronRight className="size-3.5 shrink-0" />
          {i === parts.length - 1 ? <span aria-current="page" className="truncate font-medium text-fg">{/^\d+$/.test(p) ? `#${p}` : humanize(p.replace(/-/g, '_'))}</span> : <Link href={`/${parts.slice(0, i + 1).join('/')}`} className="truncate hover:text-fg">{/^\d+$/.test(p) ? `#${p}` : humanize(p.replace(/-/g, '_'))}</Link>}
        </Fragment>
      ))}
    </nav>
  );
}

function NotificationBell() {
  const { unread } = useNotifications();
  return (
    <Link href="/notifications" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} className="relative grid size-9 place-items-center rounded-lg border border-line bg-surface hover:bg-surface2">
      <Bell className="size-4" />
      {unread > 0 && <span className="num absolute -top-1.5 -right-1.5 grid min-w-5 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{unread > 99 ? '99+' : unread}</span>}
    </Link>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const { user, can } = useAuth();
  const active = useActiveSegment();
  const router = useRouter();
  const pathname = usePathname();
  const online = useOnlineStatus();
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname; // mobile drawer closes automatically when the route changes (derived state, no effect)
  const setOpen = (v: boolean) => setOpenAt(v ? pathname : null);
  const [, startTransition] = useTransition();

  // persisted Zustand stores use skipHydration -> rehydrate once on the client (no SSR/client mismatch)
  useEffect(() => { void useHospitalStore.persist.rehydrate(); void usePharmacyStore.persist.rehydrate(); void useShortlist.persist.rehydrate(); }, []);
  // Automatic logout after 20 idle minutes
  useIdleLogout(20, () => { void fetch('/api/auth/logout', { method: 'POST' }).finally(() => router.replace('/login?reason=expired')); });

  const items = NAV.filter((n) => (!n.permission || can(n.permission)) && (!n.onlyRole || n.onlyRole === user.role));
  const sidebar = (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
      {items.map((n) => (
        <Link key={n.href} href={n.href} prefetch aria-current={active === n.segment ? 'page' : undefined} className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-surface2 hover:text-fg', active === n.segment && 'bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary')}>
          <n.icon className="size-4 shrink-0" />{n.label}
        </Link>
      ))}
    </nav>
  );
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface lg:flex">
        <Link href="/dashboard" className="flex h-16 items-center gap-2 border-b border-line px-5 font-semibold"><span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-fg"><Cross className="size-5" /></span>{APP_NAME}</Link>
        {sidebar}
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden"><div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-surface shadow-xl"><div className="flex h-16 items-center justify-between border-b border-line px-5 font-semibold">{APP_NAME}<button aria-label="Close menu" onClick={() => setOpen(false)}><X className="size-5" /></button></div>{sidebar}</aside>
        </div>
      )}
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur">
          <button aria-label="Open menu" className="grid size-9 place-items-center rounded-lg border border-line lg:hidden" onClick={() => setOpen(true)}><Menu className="size-4" /></button>
          <Breadcrumbs />
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle /><NotificationBell />
            <DropdownMenu>
              <DropdownTrigger aria-label="User menu" className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-2 hover:bg-surface2">
                <span className="grid size-6 place-items-center rounded-full bg-primary text-xs font-bold text-primary-fg">{user.username.slice(0, 1).toUpperCase()}</span><span className="hidden text-sm sm:block">{user.username}</span>
              </DropdownTrigger>
              <DropdownContent>
                <DropdownLabel>{user.email}<br />Role: {humanize(user.role)}</DropdownLabel>
                <DropdownSeparator />
                <DropdownItem onSelect={() => router.push('/profile')}><UserRound className="size-4" />Account & preferences</DropdownItem>
                <DropdownItem onSelect={() => startTransition(() => { void logoutAction(); })} className="text-danger"><LogOut className="size-4" />Sign out</DropdownItem>
              </DropdownContent>
            </DropdownMenu>
          </div>
        </header>
        {!online && <div role="alert" className="flex items-center gap-2 bg-warn/15 px-4 py-2 text-sm text-warn"><WifiOff className="size-4" />You are offline - changes will not be saved until the connection returns.</div>}
        <main id="content" className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
