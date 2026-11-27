'use client';
import Link from 'next/link';
import { useParams, usePathname, useRouter, useSelectedLayoutSegment, useSelectedLayoutSegments } from 'next/navigation';
import { Fragment, useState, useTransition, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Bell, Boxes, Building2, CalendarDays, CalendarPlus, CalendarX, ChevronRight, ClipboardList, Clock, Cross, FileText, FlaskConical, History, LayoutDashboard, ListChecks, LogOut, Menu, PanelLeftClose, Pill, ReceiptText, ScrollText, Settings, ShieldCheck, Stethoscope, UserCog, UserRound, Users, Wallet, X, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/providers/auth-context';
import { useUiStore } from '@/store/uiStore';
import { ThemeToggle } from './ThemeToggle';
import { DropdownContent, DropdownItem, DropdownLabel, DropdownMenu, DropdownSeparator, DropdownTrigger } from '@/components/ui/dropdown';
import { get, send } from '@/lib/api/client';
import { ROLE_LABEL } from '@/lib/constants/rbac';
import { cn } from '@/lib/utilities/cn';
import { APP_NAME } from '@/lib/configuration/public';
import type { NavItem } from '@/lib/constants/navigation';

const ICONS: Record<string, LucideIcon> = { BarChart3, Bell, Boxes, Building2, CalendarDays, CalendarPlus, CalendarX, ClipboardList, Clock, FileText, FlaskConical, History, LayoutDashboard, ListChecks, Pill, ReceiptText, ScrollText, Settings, ShieldCheck, Stethoscope, UserCog, UserRound, Users, Wallet };

/** Active menu entry = longest nav href that prefixes the pathname (usePathname). */
function useActiveHref(items: NavItem[]) { const p = usePathname(); return [...items].sort((a, b) => b.href.length - a.href.length).find((i) => p === i.href || p.startsWith(i.href + '/'))?.href; }

function Breadcrumbs() {
  const segs = useSelectedLayoutSegments(); const pathname = usePathname(); const params = useParams<Record<string, string>>(); const dyn = new Set(Object.values(params).flat()); const parts = pathname.split('/').filter(Boolean);
  if (!segs.length && parts.length <= 1) return null;
  return <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1 text-sm text-muted sm:flex">{parts.map((p, i) => <Fragment key={i}>{i > 0 && <ChevronRight className="size-3.5 shrink-0" />}{i === parts.length - 1 ? <span aria-current="page" className="truncate font-medium text-fg capitalize">{dyn.has(p) ? `#${p}` : p.replace(/-/g, ' ')}</span> : <Link href={`/${parts.slice(0, i + 1).join('/')}`} className="truncate capitalize hover:text-fg">{p.replace(/-/g, ' ')}</Link>}</Fragment>)}</nav>;
}

/** Unread count: TanStack Query polls the REST API every 30 s (Axios under the hood). */
function Bell_({ href }: { href: string }) {
  const q = useQuery({ queryKey: ['notifications', 'unread'], queryFn: ({ signal }) => get<{ items: unknown[]; unread: number }>('/notifications', { unread: true, size: 1 }, signal), refetchInterval: 30_000, meta: { silent: true } });
  const n = q.data?.data.unread ?? 0;
  return <Link href={href} aria-label={`Notifications${n ? `, ${n} unread` : ''}`} className="relative grid size-9 place-items-center rounded-lg border border-line bg-surface hover:bg-surface2"><Bell className="size-4" />{n > 0 && <span className="num absolute -top-1.5 -right-1.5 grid min-w-5 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{n > 99 ? '99+' : n}</span>}</Link>;
}

export function AppShell({ nav, children, accountHref = '/account' }: { nav: NavItem[]; children: ReactNode; accountHref?: string }) {
  const user = useAuth(); const router = useRouter(); const pathname = usePathname(); const section = useSelectedLayoutSegment();
  const collapsed = useUiStore((s) => s.sidebarCollapsed); const toggle = useUiStore((s) => s.toggleSidebar);
  const [openAt, setOpenAt] = useState<string | null>(null); const open = openAt === pathname; // mobile drawer auto-closes on navigation
  const [, start] = useTransition(); const active = useActiveHref(nav);
  const bellHref = nav.find((n) => n.icon === 'Bell')?.href ?? '/account';
  const list = (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">{nav.map((n) => { const I = ICONS[n.icon] ?? LayoutDashboard; return <Link key={n.href} href={n.href} title={n.label} aria-current={active === n.href ? 'page' : undefined} className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-surface2 hover:text-fg', active === n.href && 'bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary', collapsed && 'lg:justify-center lg:px-2')}><I className="size-4 shrink-0" /><span className={cn(collapsed && 'lg:hidden')}>{n.label}</span></Link>; })}</nav>
  );
  const logout = () => start(async () => { await send('post', '/auth/logout').catch(() => undefined); router.replace('/login'); router.refresh(); });
  return (
    <div className={cn('min-h-dvh lg:grid', collapsed ? 'lg:grid-cols-[72px_1fr]' : 'lg:grid-cols-[250px_1fr]')}>
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface lg:flex"><div className="flex h-16 items-center gap-2 border-b border-line px-4 font-semibold"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-fg"><Cross className="size-5" /></span><span className={cn('truncate', collapsed && 'hidden')}>{APP_NAME}</span></div>{list}<button onClick={toggle} aria-label="Collapse sidebar" className="m-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-line py-2 text-xs text-muted hover:bg-surface2"><PanelLeftClose className={cn('size-4', collapsed && 'rotate-180')} /><span className={cn(collapsed && 'hidden')}>Collapse</span></button></aside>
      {open && <div className="fixed inset-0 z-50 lg:hidden"><div className="absolute inset-0 bg-black/50" onClick={() => setOpenAt(null)} /><aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-surface shadow-xl"><div className="flex h-16 items-center justify-between border-b border-line px-5 font-semibold">{APP_NAME}<button aria-label="Close menu" onClick={() => setOpenAt(null)}><X className="size-5" /></button></div>{list}</aside></div>}
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur"><button aria-label="Open menu" className="grid size-9 place-items-center rounded-lg border border-line lg:hidden" onClick={() => setOpenAt(pathname)}><Menu className="size-4" /></button><Breadcrumbs />
          <div className="ml-auto flex items-center gap-2"><ThemeToggle /><Bell_ href={bellHref} />
            <DropdownMenu><DropdownTrigger aria-label="User menu" className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-2 hover:bg-surface2"><span className="grid size-6 place-items-center rounded-full bg-primary text-xs font-bold text-primary-fg">{user.name.slice(0, 1).toUpperCase()}</span><span className="hidden text-sm sm:block">{user.name}</span></DropdownTrigger>
              <DropdownContent><DropdownLabel>{user.email}<br />{ROLE_LABEL[user.role]}</DropdownLabel><DropdownSeparator /><DropdownItem onSelect={() => router.push(accountHref)}><Settings className="size-4" />Account & security</DropdownItem><DropdownItem onSelect={() => router.back()}>← Back</DropdownItem><DropdownItem onSelect={() => router.forward()}>Forward →</DropdownItem><DropdownSeparator /><DropdownItem onSelect={logout} className="text-danger"><LogOut className="size-4" />Sign out</DropdownItem></DropdownContent></DropdownMenu></div></header>
        <main id="content" data-section={section ?? 'home'} className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
