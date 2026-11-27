import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ListChecks } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardBody } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { NativeSelect } from '@/components/ui/input';
import { KpiCard } from '@/components/common/KpiCard';
import { DataTable } from '@/components/tables/DataTable';
import { COVERAGE } from '@/coverage';
import { ProgressBar } from '@/features/projects/progress';
import { EmptyState } from '@/components/feedback/states';

export default function CoveragePage() {
  const { t } = useTranslation(); const [q, setQ] = useState(''); const [st, setSt] = useState('');
  const total = COVERAGE.length; const integ = COVERAGE.filter((c) => c.status !== 'not-integrated').length; const restricted = COVERAGE.filter((c) => c.authorize).length;
  const bySvc = useMemo(() => { const m = new Map<string, { n: number; ok: number }>(); COVERAGE.forEach((c) => { const x = m.get(c.service) ?? { n: 0, ok: 0 }; x.n++; if (c.status !== 'not-integrated') x.ok++; m.set(c.service, x); }); return [...m].map(([service, v]) => ({ service, endpoints: v.n, integrated: v.ok, percent: Math.round((v.ok / v.n) * 100) })); }, []);
  const rows = COVERAGE.filter((c) => (!st || c.status === st) && (!q || `${c.id} ${c.path} ${c.module}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <>
      <PageHeader title={t('hr.admin.coverage')} description={t('hr.admin.coverageSub')} icon={<ListChecks size={20} />} />
      {!total ? <Card><CardBody><EmptyState title="Coverage not generated" hint="Run: npm run verify:coverage" /></CardBody></Card> : <>
        <div className="row g-3 mb-3">
          <div className="col-6 col-lg-3"><KpiCard label="Discovered endpoints" value={total} icon={<ListChecks size={20} />} /></div>
          <div className="col-6 col-lg-3"><KpiCard label="Integrated in UI" value={integ} tone="success" icon={<ListChecks size={20} />} /></div>
          <div className="col-6 col-lg-3"><KpiCard label="Not integrated" value={total - integ} tone={total - integ ? 'danger' : 'success'} icon={<ListChecks size={20} />} /></div>
          <div className="col-6 col-lg-3"><KpiCard label="Integration" value={`${Math.round((integ / total) * 100)}%`} hint={`${restricted} restricted endpoints`} icon={<ListChecks size={20} />} /></div></div>
        <div className="mb-3"><DataTable id="cov-svc" rows={bySvc} exportName="coverage-by-service" columns={[{ key: 'service' }, { key: 'endpoints' }, { key: 'integrated' }, { key: 'percent', cell: (r: any) => <ProgressBar value={r.percent} /> }]} /></div>
        <DataTable id="cov" rows={rows} exportName="endpoint-coverage" search={{ value: q, onChange: setQ }} rowKey={(r) => r.id}
          toolbar={<NativeSelect className="w-auto" value={st} onChange={(e) => setSt(e.target.value)} aria-label="status"><option value="">All</option><option value="integrated">integrated</option><option value="infrastructure">infrastructure</option><option value="not-integrated">not integrated</option></NativeSelect>}
          columns={[{ key: 'id' }, { key: 'method' }, { key: 'path', cell: (r: any) => <code style={{ fontSize: 12 }}>{r.path}</code> }, { key: 'module' }, { key: 'files', cell: (r: any) => (r.files ?? []).map((f: string) => f.split('/').pop()).join(', '), exportValue: (r: any) => (r.files ?? []).join(' ') }, { key: 'authorize', header: 'Authorization', cell: (r: any) => (r.authorize ? <Badge tone="warning" title={r.authorize}>restricted</Badge> : '—'), exportValue: (r: any) => r.authorize },
            { key: 'status', cell: (r: any) => <Badge tone={r.status === 'not-integrated' ? 'danger' : 'success'}>{r.status}</Badge> }, { key: 'reason', defaultHidden: true }]} /></>}
    </>
  );
}
