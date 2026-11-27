'use client';
import { ArrowLeft, Banknote, Bell, CalendarClock, CreditCard, History, LayoutDashboard, MapPin, Route, Search, Ticket, TrainFront, Undo2, UserRound, Users, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useSelectedLayoutSegments } from 'next/navigation';
import { useAuth } from '@/hooks';
import type { RoleKey } from '@/types';
import { cn } from '@/utils/cn';

/** Icons are referenced by NAME: Server layouts can only pass serializable props to this Client Component (component functions cannot cross the boundary). */
const ICONS = { ArrowLeft, Banknote, Bell, CalendarClock, CreditCard, History, LayoutDashboard, MapPin, Route, Search, Ticket, TrainFront, Undo2, UserRound, Users, XCircle };
export type NavIcon = keyof typeof ICONS;
export interface NavItem { href: string; label: string; icon: NavIcon; segment: string | null; roles?: RoleKey[] }
/**
 * Sidebar for the account and admin areas. `useSelectedLayoutSegments()` (relative to the layout that renders it)
 * decides the active item; `roles` hides items the signed-in user may not use (role-aware navigation - Express still enforces).
 */
export function SideNav({ items, label, dark }: { items: NavItem[]; label: string; dark?: boolean }) {
  const segments = useSelectedLayoutSegments(); const { hasRole } = useAuth(); const current = segments[0] ?? null;
  return (
    <nav aria-label={label} className="flex gap-1 overflow-x-auto md:flex-col">
      {items.filter((i) => !i.roles || hasRole(...i.roles)).map(({ href, label: l, icon, segment }) => {
        const I = ICONS[icon]; const active = current === segment;
        return <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={cn('flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium', dark ? (active ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800') : (active ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'))}><I size={16} />{l}</Link>;
      })}
    </nav>
  );
}
