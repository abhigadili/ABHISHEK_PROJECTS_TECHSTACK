import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Users } from 'lucide-react';
import { LanguageSwitcher, ThemeSwitcher } from '@/components/layout/Switchers';
import { useAppConfig } from '@/contexts/ConfigContext';

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const { title: app } = useAppConfig(); const { t } = useTranslation();
  return (
    <div className="d-flex min-vh-100 flex-column flex-lg-row">
      <div className="d-none d-lg-flex col-lg-5 flex-column justify-content-between p-5 text-white" style={{ background: 'linear-gradient(145deg,#312e81,#4f46e5 60%,#0ea5a4)' }}>
        <div className="d-flex align-items-center gap-2 fs-5 fw-semibold"><Users size={26} />{app}</div>
        <div><h2 className="mb-3" style={{ fontSize: 34 }}>{t('hr.dashboard.sub')}</h2><p className="opacity-75 mb-0" style={{ maxWidth: 420 }}>Employees · Leave · Attendance · Payroll · Tax · Performance · Projects · Timesheets · Exit</p></div>
        <small className="opacity-50">Secured by JWT · role-based access control</small>
      </div>
      <div className="flex-grow-1 d-flex flex-column">
        <div className="d-flex justify-content-end gap-2 p-3"><LanguageSwitcher /><ThemeSwitcher /></div>
        <div className="flex-grow-1 d-flex align-items-center justify-content-center p-3">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="hr-card w-100 p-4 p-md-5" style={{ maxWidth: 440 }}>
            <h1 className="fs-4 mb-1">{title}</h1>{subtitle && <p className="text-muted mb-4" style={{ fontSize: 13 }}>{subtitle}</p>}
            {children}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
