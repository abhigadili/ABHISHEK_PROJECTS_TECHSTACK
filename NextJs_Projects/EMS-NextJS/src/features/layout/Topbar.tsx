'use client';
import Link from 'next/link';
import { useSelectedLayoutSegments } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Avatar } from '@/components/common/Avatar';
import { logoutAction } from '@/actions/auth';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { useNotifications } from '@/hooks/useNotifications';
import { useAppDispatch } from '@/store/hooks';
import { toggleSidebar } from '@/store/uiSlice';
import { ROLE_LABEL } from '@/constants/roles';
import { formatDateTime } from '@/lib/utils/format';

const LABELS: Record<string, string> = { dashboard: 'Dashboard', employees: 'Employees', departments: 'Departments', designations: 'Designations', organization: 'Organization', attendance: 'Attendance', leaves: 'Leave', holidays: 'Holidays', reports: 'Reports', users: 'Users & roles', notifications: 'Notifications', profile: 'My profile', new: 'New', edit: 'Edit', apply: 'Apply', approvals: 'Approvals', admin: 'Administration', calendar: 'Calendar', 'job-history': 'Job history', 'leave-history': 'Leave history', unauthorized: 'Unauthorized' };

/** Breadcrumbs from `useSelectedLayoutSegments()` (all active segments below this layout). Numeric ids render as "#4". */
function Breadcrumbs() {
  const segs = useSelectedLayoutSegments().filter((s) => !s.startsWith('('));
  if (segs.length < 2) return null;
  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-1">
        <li><Link className="hover:underline" href="/dashboard">Home</Link></li>
        {segs.map((s, i) => {
          const href = '/' + segs.slice(0, i + 1).join('/');
          const label = /^\d+$/.test(s) ? `#${s}` : (LABELS[s] ?? s);
          return <li key={href} className="flex items-center gap-1"><span aria-hidden>/</span>{i === segs.length - 1 ? <span aria-current="page" className="text-foreground">{label}</span> : <Link className="hover:underline" href={href}>{label}</Link>}</li>;
        })}
      </ol>
    </nav>
  );
}
export { Breadcrumbs };

function useClickOutside(onOut: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onOut(); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, [onOut]);
  return ref;
}

function NotificationBell() {
  const { unread, items, markAll } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  return (
    <div className="relative" ref={ref}>
      <button aria-label={`Notifications (${unread} unread)`} aria-expanded={open} onClick={() => setOpen((o) => !o)} className="relative rounded-lg p-2 hover:bg-black/5 dark:hover:bg-white/10">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
        {unread > 0 && <span data-testid="unread-badge" className="absolute -top-0.5 -right-0.5 grid min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[90vw] rounded-xl border border-border bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-2"><b className="text-sm">Notifications</b><button disabled={unread === 0} onClick={markAll} className="text-xs text-primary disabled:opacity-40">Mark all read</button></div>
          <ul className="max-h-80 divide-y divide-border overflow-y-auto">
            {items.length === 0 && <li className="p-4 text-sm text-muted">You&apos;re all caught up.</li>}
            {items.map((n) => <li key={n.id} className={`px-4 py-2 text-sm ${n.isRead ? '' : 'bg-primary/5'}`}><p className={n.isRead ? '' : 'font-semibold'}>{n.title}</p><p className="text-xs text-muted">{n.message} · {formatDateTime(n.createdAt)}</p></li>)}
          </ul>
          <Link href="/notifications" onClick={() => setOpen(false)} className="block border-t border-border px-4 py-2 text-center text-sm text-primary">View all</Link>
        </div>
      )}
    </div>
  );
}

function UserMenu({ hasPicture }: { hasPicture: boolean }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  return (
    <div className="relative" ref={ref}>
      <button aria-label="Account menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="rounded-full"><Avatar employeeId={user.employeeId ?? 0} name={user.name} hasPicture={hasPicture && !!user.employeeId} size={34} /></button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-60 rounded-xl border border-border bg-surface p-1 shadow-xl">
          <div className="border-b border-border px-3 py-2"><p className="text-sm font-semibold">{user.name}</p><p className="truncate text-xs text-muted">{user.email} · {ROLE_LABEL[user.role]}</p></div>
          <Link role="menuitem" href="/profile" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10">My profile</Link>
          {/* a plain <form action={serverAction}> — logout works even if JavaScript fails to load */}
          <form action={logoutAction}><button role="menuitem" type="submit" className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10">Sign out</button></form>
        </div>
      )}
    </div>
  );
}

export function Topbar({ hasPicture }: { hasPicture: boolean }) {
  const dispatch = useAppDispatch();
  const { theme, toggle } = useTheme();
  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-surface/90 px-4 py-2 backdrop-blur">
      <button aria-label="Open navigation" className="rounded-lg p-2 hover:bg-black/5 lg:hidden dark:hover:bg-white/10" onClick={() => dispatch(toggleSidebar())}>☰</button>
      <div className="flex-1" />
      <button onClick={toggle} aria-label="Toggle theme" className="rounded-lg p-2 hover:bg-black/5 dark:hover:bg-white/10" suppressHydrationWarning>{theme === 'dark' ? '☀️' : '🌙'}</button>
      <NotificationBell />
      <UserMenu hasPicture={hasPicture} />
    </header>
  );
}
