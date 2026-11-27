import { memo } from 'react';
import { NavLink } from 'react-router-dom';
import { Cross, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { NAV_ITEMS } from '@/constants/navigation';
import { can } from '@/constants/permissions';
import { useAuth } from '@/contexts/AuthContext';
import { useAppDispatch, useAppSelector } from '@/store/redux/hooks';
import { layoutActions } from '@/store/slices/layoutSlice';
import { cn } from '@/utils/cn';

/** Responsive sidebar: permanent on desktop (collapsible, Redux layout slice), slide-over drawer on mobile. */
export const Sidebar = memo(function Sidebar() {
  const { role } = useAuth();
  const dispatch = useAppDispatch();
  const collapsed = useAppSelector((s) => s.layout.sidebarCollapsed);
  const mobileOpen = useAppSelector((s) => s.layout.mobileNavOpen);

  const visible = NAV_ITEMS.filter((n) => !n.permission || can(role, n.permission));
  const groups = ['Care', 'Clinical', 'Operations', 'System'] as const;

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden no-print" onClick={() => dispatch(layoutActions.mobileNavSet(false))} aria-hidden />}
      <aside
        aria-label="Primary navigation"
        className={cn(
          'no-print fixed inset-y-0 left-0 z-40 flex flex-col bg-[var(--hms-sidebar)] text-[var(--hms-sidebar-fg)] transition-all duration-200 lg:static lg:translate-x-0',
          collapsed ? 'lg:w-[68px]' : 'lg:w-64',
          'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b border-white/10 px-4">
          <span className="rounded-lg bg-brand-600 p-1.5 text-white"><Cross className="h-5 w-5" /></span>
          {!collapsed && <span className="text-sm font-bold tracking-wide text-white">Hospital<span className="text-brand-300">Care</span></span>}
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {groups.map((g) => {
            const items = visible.filter((n) => n.group === g);
            if (items.length === 0) return null;
            return (
              <div key={g} className="mb-3">
                {!collapsed && <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest opacity-50">{g}</div>}
                <ul className="space-y-0.5">
                  {items.map((n) => (
                    <li key={n.to}>
                      <NavLink
                        to={n.to}
                        title={collapsed ? n.label : undefined}
                        onClick={() => dispatch(layoutActions.mobileNavSet(false))}
                        className={({ isActive }) => cn('flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-white/10', isActive && 'bg-brand-600 text-white hover:bg-brand-600', collapsed && 'lg:justify-center lg:px-0')}
                      >
                        {n.icon}
                        <span className={cn(collapsed && 'lg:hidden')}>{n.label}</span>
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>
        <button type="button" onClick={() => dispatch(layoutActions.sidebarToggled())} className="hidden items-center justify-center gap-2 border-t border-white/10 py-3 text-xs hover:bg-white/10 lg:flex" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <><PanelLeftClose className="h-4 w-4" /> Collapse</>}
        </button>
      </aside>
    </>
  );
});
