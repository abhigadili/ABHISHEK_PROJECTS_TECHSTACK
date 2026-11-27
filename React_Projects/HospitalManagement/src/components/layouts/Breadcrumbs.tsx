import { Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { humanize } from '@/utils/format';

const LABELS: Record<string, string> = { lab: 'Laboratory', records: 'Medical Records', 'access-denied': 'Access denied', new: 'New', system: 'System', cache: 'Cache Monitor', 'my': 'Mine' };

/** Breadcrumbs derived from the URL (useLocation); numeric ids are shown as "#id". */
export function Breadcrumbs() {
  const { pathname } = useLocation();
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return null;
  let acc = '';
  return (
    <nav aria-label="Breadcrumb" className="no-print mb-3 flex flex-wrap items-center gap-1 text-xs text-muted">
      <Link to="/dashboard" className="inline-flex items-center gap-1 hover:text-fg"><Home className="h-3.5 w-3.5" /> Home</Link>
      {parts.map((p, i) => {
        acc += `/${p}`;
        const label = /^\d+$/.test(p) ? `#${p}` : (LABELS[p] ?? humanize(p.replace(/-/g, ' ')));
        const last = i === parts.length - 1;
        return (
          <Fragment key={acc}>
            <ChevronRight className="h-3 w-3" />
            {last ? <span aria-current="page" className="font-semibold text-fg">{label}</span> : <Link to={acc} className="hover:text-fg">{label}</Link>}
          </Fragment>
        );
      })}
    </nav>
  );
}
