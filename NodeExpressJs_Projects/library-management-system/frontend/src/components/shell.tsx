'use client';
import clsx from 'clsx';
import { Bell, BookMarked, BookOpen, ClipboardList, CreditCard, FileBarChart, Heart, History, Home, IdCard, Layers, LayoutDashboard, LogOut, Menu, Receipt, Settings, ShieldCheck, Star, Tag, Upload, User as UserIcon, UserCog, Users, X, BookCopy, Undo2, Redo2, Building2, PenLine, Library, ScrollText, Wallet } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { homeFor, useAuth } from '@/lib/auth';
import type { Role } from '@/lib/types';
import { Avatar, Spinner } from '@/components/ui';

interface NavItem { href: string; label: string; icon: ReactNode; roles?: Role[] }
const I = 'h-4 w-4';
export const MEMBER_NAV: NavItem[] = [
  { href: '/member/dashboard', label: 'Dashboard', icon: <LayoutDashboard className={I} /> },
  { href: '/member/loans', label: 'Borrowed books', icon: <BookOpen className={I} /> },
  { href: '/member/history', label: 'Borrowing history', icon: <History className={I} /> },
  { href: '/member/reservations', label: 'Reservations', icon: <BookMarked className={I} /> },
  { href: '/member/fines', label: 'Dues & payments', icon: <CreditCard className={I} /> },
  { href: '/member/favorites', label: 'Reading list', icon: <Heart className={I} /> },
  { href: '/member/notifications', label: 'Notifications', icon: <Bell className={I} /> },
  { href: '/member/membership', label: 'Membership', icon: <IdCard className={I} /> },
  { href: '/member/profile', label: 'My profile', icon: <UserIcon className={I} /> },
  { href: '/books', label: 'Browse catalogue', icon: <Library className={I} /> },
];
export const STAFF_NAV: NavItem[] = [
  { href: '/staff/dashboard', label: 'Dashboard', icon: <LayoutDashboard className={I} /> },
  { href: '/staff/issue', label: 'Issue books', icon: <Redo2 className={I} /> },
  { href: '/staff/return', label: 'Return books', icon: <Undo2 className={I} /> },
  { href: '/staff/loans', label: 'Loans & renewals', icon: <ClipboardList className={I} /> },
  { href: '/staff/reservations', label: 'Reservations', icon: <BookMarked className={I} /> },
  { href: '/staff/members', label: 'Members', icon: <Users className={I} /> },
  { href: '/staff/books', label: 'Books & copies', icon: <BookCopy className={I} /> },
  { href: '/staff/books/import', label: 'Bulk import', icon: <Upload className={I} /> },
  { href: '/staff/categories', label: 'Categories', icon: <Tag className={I} /> },
  { href: '/staff/authors', label: 'Authors', icon: <PenLine className={I} /> },
  { href: '/staff/publishers', label: 'Publishers', icon: <Building2 className={I} /> },
  { href: '/staff/fines', label: 'Fines', icon: <Wallet className={I} /> },
  { href: '/staff/payments', label: 'Payments', icon: <Receipt className={I} /> },
  { href: '/staff/reviews', label: 'Review moderation', icon: <Star className={I} /> },
  { href: '/staff/reports', label: 'Reports', icon: <FileBarChart className={I} /> },
  { href: '/staff/admin/staff', label: 'Staff accounts', icon: <UserCog className={I} />, roles: ['admin'] },
  { href: '/staff/admin/member-types', label: 'Membership types', icon: <Layers className={I} />, roles: ['admin'] },
  { href: '/staff/admin/settings', label: 'Library settings', icon: <Settings className={I} />, roles: ['admin'] },
  { href: '/staff/admin/audit', label: 'Audit log', icon: <ScrollText className={I} />, roles: ['admin'] },
];

export function AppShell({ allow, nav, title, children }: { allow: Role[]; nav: NavItem[]; title: string; children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter(); const path = usePathname();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(`/login?next=${encodeURIComponent(path)}`);
    else if (!allow.includes(user.role)) router.replace(homeFor(user));
  }, [loading, user, allow, router, path]);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!user || user.role !== 'member') return;
    let live = true;
    const tick = () => api.get<{ unread: number }>('/notifications/unread-count').then((r) => live && setUnread(r.unread)).catch(() => {});
    void tick(); const t = setInterval(tick, 60_000);
    return () => { live = false; clearInterval(t); };
  }, [user, path]);

  if (loading || !user || !allow.includes(user.role)) return <div className="grid min-h-screen place-items-center"><Spinner label="Checking your session" /></div>;
  const items = nav.filter((n) => !n.roles || n.roles.includes(user.role));
  const active = (href: string) => path === href || (href !== '/books' && path.startsWith(href + '/') && !items.some((o) => o.href !== href && o.href.length > href.length && path.startsWith(o.href)));

  const sidebar = (
    <nav aria-label="Main" className="flex h-full flex-col">
      <Link href="/" className="flex items-center gap-2 px-5 py-4 text-lg font-bold text-white"><Library className="h-6 w-6" aria-hidden />Library</Link>
      <ul className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {items.map((n) => (
          <li key={n.href}>
            <Link href={n.href} aria-current={active(n.href) ? 'page' : undefined} className={clsx('flex items-center gap-3 rounded-lg px-3 py-2 text-sm', active(n.href) ? 'bg-white/15 font-medium text-white' : 'text-brand-100 hover:bg-white/10')}>
              {n.icon}<span className="flex-1">{n.label}</span>
              {n.href === '/member/notifications' && unread > 0 && <span className="rounded-full bg-amber-400 px-1.5 text-xs font-semibold text-slate-900">{unread}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
  return (
    <div className="min-h-screen lg:flex">
      <aside className="no-print hidden w-64 shrink-0 bg-brand-900 lg:block"><div className="sticky top-0 h-screen">{sidebar}</div></aside>
      {open && <div className="no-print fixed inset-0 z-40 lg:hidden"><div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} /><aside className="absolute inset-y-0 left-0 w-64 bg-brand-900">{sidebar}</aside></div>}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-2.5 backdrop-blur">
          <button className="rounded p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen(!open)}>{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
          <span className="hidden text-sm font-medium text-slate-500 sm:block">{title}</span>
          <div className="ml-auto flex items-center gap-3">
            {user.role === 'member' && <Link href="/member/notifications" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} className="relative rounded p-1.5 text-slate-500 hover:bg-slate-100"><Bell className="h-5 w-5" />{unread > 0 && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500" />}</Link>}
            <Link href={user.role === 'member' ? '/member/profile' : '/staff/dashboard'} className="flex items-center gap-2">
              <Avatar userId={user.id} name={user.fullName} hasPicture={user.hasPicture} version={user.pictureUpdatedAt} size={32} />
              <span className="hidden text-left text-sm leading-tight sm:block"><span className="block font-medium">{user.fullName}</span><span className="block text-xs capitalize text-slate-500">{user.role}</span></span>
            </Link>
            <button onClick={async () => { await logout(); router.push('/login'); }} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Log out"><LogOut className="h-5 w-5" /></button>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">
          {user.status === 'pending' && <div role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Your account is awaiting approval by library staff. You can browse, but borrowing is not available yet.</div>}
          {children}
        </main>
      </div>
    </div>
  );
}
export { Home, ShieldCheck };
