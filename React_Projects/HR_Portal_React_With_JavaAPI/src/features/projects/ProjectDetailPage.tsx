import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Pencil, UserCog, Flag } from 'lucide-react';
import dayjs from 'dayjs';
import { OpView } from '@/components/op/OpView';
import { OpButton } from '@/components/op/OpButton';
import { CrudSection } from '@/components/op/CrudSection';
import { EmployeePicker, EmployeeName } from '@/components/op/employees';
import { Tabs } from '@/components/ui/tabs';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Detail } from '@/components/common/Detail';
import { StatusBadge } from '@/components/common/values';
import { SafeHtml } from '@/components/editors/SafeHtml';
import { useOp } from '@/components/op/useOp';
import { useRefNames } from '@/components/op/refs';
import { ErrorState, LoadingBlock } from '@/components/feedback/states';
import { ProgressBar, scheduleProgress } from './progress';
import { Link } from 'react-router-dom';

function AllocationCheck({ id }: { id: string }) {
  const [emp, setEmp] = useState<string | null>(null); const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  return (
    <Card><CardHeader><CardTitle>Allocation check</CardTitle></CardHeader><CardBody>
      <div className="row g-2 align-items-end"><div className="col-md-5"><EmployeePicker value={emp} onChange={setEmp} label="Employee" /></div><div className="col-md-3"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div></div>
      {emp && <div className="mt-3"><OpView op="project.check" path={{ id }} query={{ employeeId: emp, date }} bare /></div>}</CardBody></Card>
  );
}
function TimesheetReport({ id }: { id: string }) {
  const [from, setFrom] = useState(dayjs().startOf('month').format('YYYY-MM-DD')); const [to, setTo] = useState(dayjs().format('YYYY-MM-DD'));
  return (<>
    <div className="mb-3 d-flex gap-2"><Input type="date" className="w-auto" value={from} onChange={(e) => setFrom(e.target.value)} /><Input type="date" className="w-auto" value={to} onChange={(e) => setTo(e.target.value)} /></div>
    <OpView op="timesheet.project" path={{ projectId: id }} query={{ from, to }} title="Project hours" />
  </>);
}
export default function ProjectDetailPage() {
  const { id = '' } = useParams(); const { t } = useTranslation(); const nav = useNavigate();
  const q = useOp<any>('project.get', { path: { id } }); const cust = useRefNames('customer');
  if (q.isLoading) return <LoadingBlock rows={5} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const p = q.data; const prog = scheduleProgress(p.startDate, p.endDate, p.status);
  return (
    <>
      <Card className="mb-3"><CardBody className="d-flex flex-wrap align-items-center gap-3">
        <div className="flex-grow-1"><h1 className="page-title">{p.name} <StatusBadge value={p.status} /></h1>
          <div className="text-muted" style={{ fontSize: 13 }}>{p.code} · {p.customerId ? <Link to={`/customers/${p.customerId}`}>{cust(p.customerId)}</Link> : '—'} · {t('common.manager')}: <EmployeeName id={p.projectManagerId} /></div>
          <div className="mt-2" style={{ maxWidth: 360 }}><ProgressBar value={prog} /></div></div>
        <OpButton op="project.update" path={{ id }} initial={p} label={t('common.edit')} icon={<Pencil size={13} />} dialogSize="lg" overrides={{ description: { rich: true }, status: { hidden: true } }} />
        <OpButton op="project.status" path={{ id }} label={t('common.status')} icon={<Flag size={13} />} />
        <OpButton op="project.manager" path={{ id }} label={t('common.manager')} icon={<UserCog size={13} />} />
      </CardBody></Card>
      <Tabs tabs={[
        { key: 'overview', label: t('common.overview'), content: <Card><CardBody><Detail data={p} hide={['id', 'description', 'version']} />{p.description && <div className="mt-3"><div className="field-label">{t('fields.description')}</div><SafeHtml html={p.description} /></div>}</CardBody></Card> },
        { key: 'team', label: 'Team & allocation', content: <div className="d-grid gap-3">
          <CrudSection title="Project members" list={{ op: 'project.team', path: { id } }} create={{ op: 'project.allocate', path: { id } }} update={{ op: 'project.updateAllocation', path: (r) => ({ id, allocationId: r.id }) }} remove={{ op: 'project.endAllocation', path: (r) => ({ id, allocationId: r.id }) }} tableId="proj-team" />
          <AllocationCheck id={id} /></div> },
        { key: 'timesheets', label: t('nav.timesheets'), content: <TimesheetReport id={id} /> },
        { key: 'history', label: t('common.history'), content: <OpView op="project.history" path={{ id }} title={t('common.history')} /> },
      ]} />
      <span hidden>{nav.length}</span>
    </>
  );
}
