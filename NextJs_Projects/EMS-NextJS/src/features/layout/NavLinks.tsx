'use client';
import Link from 'next/link';
import { useSelectedLayoutSegment } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { useAppDispatch } from '@/store/hooks';
import { closeSidebar } from '@/store/uiSlice';
import type { NavItem } from '@/constants/navigation';

/**
 * Client Component (needs the router state). The Server Component Sidebar filters the items by role and passes plain objects down;
 * `useSelectedLayoutSegment()` returns the active child segment of the layout this renders in ("employees" for /employees/4/edit).
 */
export function NavLinks({ items }: { items: NavItem[] }) {
  const active = useSelectedLayoutSegment();
  const dispatch = useAppDispatch();
  const groups = [...new Set(items.map((i) => i.group))];
  return (
    <nav aria-label="Main navigation" className="space-y-5">
      {groups.map((g) => (
        <div key={g}>
          {g !== 'Main' && <p className="mb-1 px-3 text-xs font-semibold tracking-wide text-muted uppercase">{g}</p>}
          <ul className="space-y-0.5">
            {items.filter((i) => i.group === g).map((i) => (
              <li key={i.href}>
                <Link href={i.href} onClick={() => dispatch(closeSidebar())} aria-current={active === i.segment ? 'page' : undefined}
                  className={cn('block rounded-lg px-3 py-2 text-sm font-medium transition', active === i.segment ? 'bg-primary text-primary-foreground' : 'hover:bg-black/5 dark:hover:bg-white/10')}>
                  {i.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
