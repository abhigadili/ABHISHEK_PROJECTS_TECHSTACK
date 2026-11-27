import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { useTranslation } from 'react-i18next';
const KEYS: Record<string, string> = { employees: 'employees', directory: 'directory', 'org-chart': 'orgChart', organization: 'organization', leave: 'leave', attendance: 'attendance', holidays: 'holidays', timesheets: 'timesheets', payroll: 'payroll', tax: 'tax', performance: 'performance', exit: 'exit', customers: 'customers', projects: 'projects', documents: 'documents', approvals: 'approvals', reports: 'reports', notifications: 'notifications', admin: 'admin', users: 'users', roles: 'roles', audit: 'audit', 'api-explorer': 'apiExplorer', coverage: 'coverage', profile: 'profile', help: 'help' };
export function Breadcrumbs() {
  const { pathname } = useLocation(); const { t } = useTranslation();
  const parts = pathname.split('/').filter(Boolean);
  if (!parts.length) return null;
  return (
    <nav aria-label="breadcrumb" className="no-print mb-2 flex flex-wrap items-center gap-1 text-xs text-muted">
      <Link to="/" className="inline-flex items-center gap-1 text-muted"><Home size={12} />{t('nav.home')}</Link>
      {parts.map((p, i) => {
        const to = '/' + parts.slice(0, i + 1).join('/'); const last = i === parts.length - 1;
        const label = KEYS[p] ? t(`nav.${KEYS[p]}`) : p.length > 14 ? p.slice(0, 8) + '…' : p;
        return <span key={to} className="inline-flex items-center gap-1"><ChevronRight size={12} />{last ? <span className="font-semibold text-foreground">{label}</span> : <Link to={to} className="text-muted">{label}</Link>}</span>;
      })}
    </nav>
  );
}
