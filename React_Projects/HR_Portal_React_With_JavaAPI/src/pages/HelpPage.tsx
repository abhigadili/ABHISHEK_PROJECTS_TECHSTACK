import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardBody } from '@/components/ui/card';
import { usePermissions } from '@/hooks/usePermissions';
export default function HelpPage() {
  const { t } = useTranslation(); const p = usePermissions();
  return (
    <>
      <PageHeader title={t('nav.help')} description={t('nav.search')} />
      <div className="row g-3">
        <div className="col-md-6"><Card><CardBody><h3 className="fs-6">Getting started</h3><ul className="ps-3 mb-0 text-[13px]"><li>Use the sidebar to open a module; menu items appear only when your role allows them.</li><li>Press Ctrl/⌘ + K to search employees, departments, projects and customers.</li><li>Quick actions (top bar) start the most common requests: leave, check-in, work from home, feedback.</li><li>Tables support sorting, column selection and CSV / Excel / PDF export.</li></ul></CardBody></Card></div>
        <div className="col-md-6"><Card><CardBody><h3 className="fs-6">Your access</h3><div className="text-[13px]"><div><strong>Roles:</strong> {p.user?.roles?.join(', ') || '—'}</div><div className="mt-1"><strong>Permissions:</strong> <span className="text-muted">{p.user?.permissions?.length ?? 0}</span></div><div className="mt-2 text-muted">Frontend visibility mirrors the backend rules for convenience only; the API enforces every permission.</div></div></CardBody></Card></div>
        {p.isAdmin && <div className="col-12"><Card><CardBody><h3 className="fs-6">For administrators</h3><div className="text-[13px]"><Link to="/admin/api-explorer">API explorer</Link> lists all 410 backend endpoints; <Link to="/admin/coverage">Endpoint coverage</Link> shows which UI exposes each one.</div></CardBody></Card></div>}
      </div>
    </>
  );
}
