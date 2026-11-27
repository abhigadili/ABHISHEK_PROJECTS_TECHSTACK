import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Timer, Check, X, RotateCcw } from 'lucide-react';
import dayjs from 'dayjs';
import { PageHeader } from '@/components/common/PageHeader';
import { Tabs } from '@/components/ui/tabs';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Modal } from '@/components/ui/dialog';
import { Input, NativeSelect } from '@/components/ui/input';
import { WeeklyGrid } from './WeeklyGrid';
import { OpButton } from '@/components/op/OpButton';
import { OpView } from '@/components/op/OpView';
import { OpTable } from '@/components/tables/OpTable';
import { CrudSection } from '@/components/op/CrudSection';
import { EmployeeScope } from '@/components/op/EmployeeScope';
import { Calendar, type CalEvent } from '@/components/common/Calendar';
import { DataTable } from '@/components/tables/DataTable';
import { Detail } from '@/components/common/Detail';
import { StatusBadge } from '@/components/common/values';
import { useOp } from '@/components/op/useOp';
import { useRefOptions } from '@/components/op/refs';
import { usePermissions } from '@/hooks/usePermissions';
import { useAppSelector } from '@/store/redux';
import { LoadingBlock } from '@/components/feedback/states';
import { EmployeeName } from '@/components/op/employees';

const DEC = { comment: { rich: true } };
function SheetDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useOp<any>('timesheet.get', { path: { id } }); const d = q.data; const p = usePermissions();
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={`Timesheet · ${d?.weekStart ?? ''}`} size="xl"
      footer={d && p.canCall('timesheet.approve') && <>{d.status === 'SUBMITTED' && <><OpButton op="timesheet.approve" path={{ id }} label="Approve" icon={<Check size={14} />} variant="success" size="md" overrides={DEC} /><OpButton op="timesheet.reject" path={{ id }} label="Reject" icon={<X size={14} />} variant="danger" size="md" overrides={DEC} /></>}{d.status === 'APPROVED' && <OpButton op="timesheet.reopen" path={{ id }} label="Reopen" icon={<RotateCcw size={14} />} size="md" />}</>}>
      {q.isLoading ? <LoadingBlock /> : d && <div className="d-grid gap-3"><Detail data={d} hide={['id', 'entries']} render={{ approverId: (v) => <EmployeeName id={v} /> }} /><DataTable id="ts-entries" rows={d.entries ?? []} /><OpView op="timesheet.history" path={{ id }} title="History" /></div>}
    </Modal>
  );
}
function History() {
  const [month, setMonth] = useState(dayjs().format('YYYY-MM')); const [open, setOpen] = useState<string | null>(null);
  const from = dayjs(month + '-01').startOf('month').format('YYYY-MM-DD'); const to = dayjs(month + '-01').endOf('month').format('YYYY-MM-DD');
  const q = useOp<any>('timesheet.mine', { query: { from, to, size: 100 } });
  const events: CalEvent[] = [];
  const byDay = new Map<string, number>();
  (q.data?.content ?? []).forEach((s: any) => (s.entries ?? []).forEach((e: any) => byDay.set(e.workDate, (byDay.get(e.workDate) ?? 0) + Number(e.hours))));
  byDay.forEach((h, date) => events.push({ date, label: `${h.toFixed(1)} h`, tone: h >= 8 ? 'success' : 'warning' }));
  const total = [...byDay.values()].reduce((a, b) => a + b, 0);
  return (
    <div className="d-grid gap-3">
      <div className="d-flex align-items-center gap-3"><Input type="month" className="w-auto" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} /><span className="text-muted">Monthly total: <strong>{total.toFixed(1)} h</strong></span></div>
      <Calendar key={month} initial={dayjs(month + '-01')} events={events} />
      <Card><CardHeader><CardTitle>Timesheets</CardTitle></CardHeader><CardBody className="p-3"><OpTable op="timesheet.mine" query={{ from, to }} tableId="ts-mine" onRowClick={(r) => setOpen(r.id)} columns={[{ key: 'weekStart' }, { key: 'status', cell: (r) => <StatusBadge value={r.status} /> }, { key: 'totalHours' }, { key: 'billableHours' }, { key: 'submittedAt', defaultHidden: true }, { key: 'decisionComment', defaultHidden: true }]} /></CardBody></Card>
      {open && <SheetDetail id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
function Approvals() {
  const [open, setOpen] = useState<string | null>(null);
  return (<>
    <Card><CardHeader><CardTitle>Timesheets awaiting approval</CardTitle></CardHeader><CardBody className="p-3">
      <OpTable op="timesheet.pending" tableId="ts-pending" onRowClick={(r) => setOpen(r.id)} columns={[{ key: 'employeeName' }, { key: 'weekStart' }, { key: 'totalHours' }, { key: 'billableHours' }, { key: 'status', cell: (r) => <StatusBadge value={r.status} /> }]}
        rowActions={(r) => <><OpButton op="timesheet.approve" path={{ id: r.id }} label="Approve" variant="success" overrides={DEC} icon={<Check size={13} />} /><OpButton op="timesheet.reject" path={{ id: r.id }} label="Reject" variant="danger" overrides={DEC} icon={<X size={13} />} /></>} /></CardBody></Card>
    {open && <SheetDetail id={open} onClose={() => setOpen(null)} />}</>);
}
function Tasks() {
  const projects = useRefOptions('project'); const [pid, setPid] = useState(''); const project = pid || projects.options[0]?.value;
  return (<>
    <NativeSelect className="mb-3 w-auto" value={project ?? ''} onChange={(e) => setPid(e.target.value)} aria-label="project">{projects.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect>
    {project && <CrudSection title="Project tasks" list={{ op: 'timesheet.tasks', query: { projectId: project } }} create={{ op: 'timesheet.createTask', initial: { projectId: project } }} update={{ op: 'timesheet.updateTask', path: (r) => ({ id: r.id }) }} />}</>);
}
export default function TimesheetsPage() {
  const { t } = useTranslation(); const p = usePermissions(); const self = useAppSelector((s) => s.auth.user?.employeeId);
  return (
    <>
      <PageHeader title={t('hr.timesheets.title')} description={t('hr.timesheets.sub')} icon={<Timer size={20} />} />
      <Tabs tabs={[
        { key: 'week', label: 'Weekly grid', hidden: !self, content: <WeeklyGrid /> },
        { key: 'history', label: 'History & calendar', hidden: !self, content: <History /> },
        { key: 'approvals', label: t('hr.leave.approvals'), hidden: !p.canCall('timesheet.pending'), content: <Approvals /> },
        { key: 'tasks', label: 'Tasks', hidden: !p.canCall('timesheet.createTask') && !p.isManager, content: <Tasks /> },
        { key: 'reports', label: t('nav.reports'), hidden: !p.isManager, content: <EmployeeScope>{(id) => <div className="d-grid gap-3"><OpView op="timesheet.employee" path={{ employeeId: id }} title="Hours summary" /><OpTable op="timesheet.forEmployee" path={{ employeeId: id }} tableId="ts-emp" /></div>}</EmployeeScope> },
      ]} />
    </>
  );
}
