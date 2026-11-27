import { NavLink, useLocation } from 'react-router-dom';
import { Drawer } from '@mui/material';
import { ChevronDown, PanelLeftClose, PanelLeftOpen, Users } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { NAV, type NavItem } from '@/constants/nav';
import { useUiStore } from '@/store/zustand/uiStore';
import { usePermissions } from '@/hooks/usePermissions';
import { Tip } from '@/components/ui/tooltip';
import { useAppConfig } from '@/contexts/ConfigContext';
import { cn } from '@/utils/cn';

function useVisibleNav() {
  const p = usePermissions();
  const ok = (i: NavItem) => (!i.roles && !i.anyOp) || (i.roles ? p.hasRole(...i.roles) : false) || (i.anyOp ? p.canAny(...i.anyOp) : false);
  return NAV.map((g) => ({ ...g, items: g.items.filter(ok) })).filter((g) => g.items.length);
}

function Content({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { t } = useTranslation(); const groups = useVisibleNav(); const { openGroups, toggleGroup } = useUiStore(); const { pathname } = useLocation(); const { title } = useAppConfig();
  return (
    <nav aria-label="Main" className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center gap-2 px-4 font-semibold"><span className="rounded-lg bg-primary p-1.5 text-white"><Users size={18} /></span>{!collapsed && <span className="truncate">{title}</span>}</div>
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {groups.map((g) => {
          const single = g.key === 'main';
          const open = single || (openGroups[g.key] ?? true) || g.items.some((i) => i.path !== '/' && pathname.startsWith(i.path));
          return (
            <div key={g.key} className="mb-1">
              {!single && !collapsed && (
                <button className="flex w-full items-center justify-between border-0 bg-transparent px-2 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-muted" onClick={() => toggleGroup(g.key)} aria-expanded={open}>
                  {t(`nav.${g.key}`)}<ChevronDown size={13} className={cn('transition-transform', !open && '-rotate-90')} />
                </button>
              )}
              {!single && collapsed && <div className="mx-3 my-2 border-t border-border" />}
              <AnimatePresence initial={false}>
                {(open || collapsed) && (
                  <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.16 }} className="m-0 list-none overflow-hidden p-0">
                    {g.items.map((i) => {
                      const link = (
                        <NavLink to={i.path} end={i.path === '/'} onClick={onNavigate}
                          className={({ isActive }) => cn('mb-0.5 flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium text-foreground no-underline hover:bg-surface-2 hover:no-underline', isActive && 'bg-primary-soft text-primary', collapsed && 'justify-center px-0')}>
                          <i.icon size={18} className="shrink-0" />{!collapsed && <span className="truncate">{t(`nav.${i.key}`)}</span>}
                        </NavLink>
                      );
                      return <li key={i.key}>{collapsed ? <Tip label={t(`nav.${i.key}`)}>{link}</Tip> : link}</li>;
                    })}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </nav>
  );
}

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, mobileNavOpen, setMobileNav } = useUiStore(); const { t } = useTranslation();
  return (
    <>
      <motion.aside animate={{ width: sidebarCollapsed ? 72 : 264 }} transition={{ duration: 0.2 }} className="no-print d-none d-lg-flex flex-column position-fixed top-0 bottom-0 start-0 border-end bg-surface" style={{ zIndex: 1100, borderColor: 'var(--hr-border)' }}>
        <Content collapsed={sidebarCollapsed} />
        <button onClick={toggleSidebar} aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={t('common.toggle', { defaultValue: 'Toggle' })} className="m-2 flex items-center justify-center rounded-md border border-border bg-surface p-2 text-muted hover:bg-surface-2">
          {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </motion.aside>
      <Drawer open={mobileNavOpen} onClose={() => setMobileNav(false)} slotProps={{ paper: { sx: { width: 276 } } }} sx={{ display: { lg: 'none' } }}>
        <Content collapsed={false} onNavigate={() => setMobileNav(false)} />
      </Drawer>
    </>
  );
}
