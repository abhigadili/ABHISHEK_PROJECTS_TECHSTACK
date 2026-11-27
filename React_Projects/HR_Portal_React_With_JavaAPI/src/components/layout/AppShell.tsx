import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Menu as MenuIcon, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { Breadcrumbs } from './Breadcrumbs';
import { useUiStore } from '@/store/zustand/uiStore';
import { useConnectionStore } from '@/store/zustand/connectionStore';
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary';
import { LoadingBlock } from '@/components/feedback/states';

export function AppShell() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed); const { pathname } = useLocation(); const { t } = useTranslation();
  const { online, message } = useConnectionStore();
  void MenuIcon;
  return (
    <div>
      <Sidebar />
      <div className="app-main" style={{ ['--sw' as any]: collapsed ? '72px' : '264px' }}>
        <Topbar />
        {!online && <div role="alert" className="d-flex align-items-center gap-2 bg-warning/20 px-4 py-2 text-[13px]"><WifiOff size={16} /><strong>{t('common.backendDown')}</strong><span className="text-muted">{message ?? t('common.backendDownHint')}</span></div>}
        <main className="p-3 p-md-4">
          <Breadcrumbs />
          <ErrorBoundary resetKey={pathname}>
            <Suspense fallback={<LoadingBlock rows={6} />}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}><Outlet /></motion.div>
              </AnimatePresence>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
