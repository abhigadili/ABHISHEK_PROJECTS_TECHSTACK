'use client';
import Image from 'next/image';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { closeSidebar } from '@/store/uiSlice';
import { NavLinks } from './NavLinks';
import type { NavItem } from '@/constants/navigation';
import { cn } from '@/lib/utils/cn';

/** Responsive sidebar: static column from `lg`, slide-over drawer below (visibility lives in Redux so the top-bar button can toggle it). */
export function Sidebar({ items }: { items: NavItem[] }) {
  const open = useAppSelector((s) => s.ui.sidebarOpen);
  const dispatch = useAppDispatch();
  return (
    <>
      {open && <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => dispatch(closeSidebar())} />}
      <aside className={cn('fixed inset-y-0 left-0 z-40 w-64 overflow-y-auto border-r border-border bg-surface p-4 transition-transform lg:static lg:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')}>
        <div className="mb-6 flex items-center gap-2 px-2 text-lg font-bold"><Image src="/images/logo.svg" alt="" width={28} height={28} />EMS</div>
        <NavLinks items={items} />
      </aside>
    </>
  );
}
