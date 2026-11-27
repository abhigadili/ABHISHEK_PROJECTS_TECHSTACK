import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookUser } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { OpTable } from '@/components/tables/OpTable';
import { OpView } from '@/components/op/OpView';
import { Tabs } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/common/values';
import { Card, CardBody } from '@/components/ui/card';
import { Avatar } from '@mui/material';
import { initials } from '@/utils/format';
import { useRefNames } from '@/components/op/refs';

function Grouped() {
  const nav = useNavigate(); const dep = useRefNames('department');
  return (
    <OpView op="employee.grouped" title="A–Z" bare>
      {(d: any) => {
        const groups = d?.byInitial ?? d?.groups ?? (d && typeof d === 'object' ? Object.fromEntries(Object.entries(d).filter(([, v]) => Array.isArray(v))) : {});
        const keys = Object.keys(groups).sort();
        return (
          <div>
            {d?.statusCounts && <div className="mb-3 d-flex gap-2 flex-wrap">{Object.entries(d.statusCounts).map(([k, v]) => <span key={k} className="rounded-md bg-primary-soft px-2 py-1 text-xs"><StatusBadge value={k} /> {String(v)}</span>)}</div>}
            {keys.map((k) => (
              <div key={k} className="mb-3"><div className="field-label">{k}</div>
                <div className="row g-2">{(groups[k] as any[]).map((e) => (
                  <div key={e.id} className="col-12 col-md-6 col-xl-4"><Card><CardBody className="d-flex align-items-center gap-2 p-2" ><Avatar sx={{ width: 34, height: 34, fontSize: 13 }}>{initials(e.fullName)}</Avatar>
                    <button className="border-0 bg-transparent p-0 text-start" onClick={() => nav(`/employees/${e.id}`)}><div className="fw-semibold" style={{ fontSize: 13 }}>{e.fullName}</div><div className="text-muted" style={{ fontSize: 11 }}>{e.employeeCode} · {dep(e.departmentId)}</div></button></CardBody></Card></div>
                ))}</div>
              </div>
            ))}
          </div>
        );
      }}
    </OpView>
  );
}

export default function DirectoryPage() {
  const { t } = useTranslation(); const nav = useNavigate(); const [q] = useState('');
  void q;
  return (
    <>
      <PageHeader title={t('nav.directory')} description={t('hr.employees.sub')} icon={<BookUser size={20} />} />
      <Tabs tabs={[
        { key: 'list', label: t('nav.directory'), content: <OpTable op="employee.directory" tableId="directory" searchParam="q" sortable={['fullName', 'employeeCode']}
            columns={[{ key: 'employeeCode', sortable: true }, { key: 'fullName', sortable: true }, { key: 'workEmail' }, { key: 'departmentId' }, { key: 'designationId' }, { key: 'locationId' }, { key: 'status', cell: (r) => <StatusBadge value={r.status} /> }]} onRowClick={(r) => nav(`/employees/${r.id}`)} /> },
        { key: 'grouped', label: 'A–Z', content: <Grouped /> },
        { key: 'span', label: 'Span of control', content: <OpView op="employee.span" query={{ limit: 10 }} /> },
        { key: 'headcount', label: t('hr.dashboard.totalEmployees'), content: <OpView op="employee.headcount" /> },
      ]} />
    </>
  );
}
