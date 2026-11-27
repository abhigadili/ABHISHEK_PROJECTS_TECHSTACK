import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LogOut, Check, X } from 'lucide-react';
import { Step, StepLabel, Stepper } from '@mui/material';
import { PageHeader } from '@/components/common/PageHeader';
import { Tabs } from '@/components/ui/tabs';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Modal } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { OpButton } from '@/components/op/OpButton';
import { OpView } from '@/components/op/OpView';
import { OpTable } from '@/components/tables/OpTable';
import { CrudSection } from '@/components/op/CrudSection';
import { Detail } from '@/components/common/Detail';
import { StatusBadge } from '@/components/common/values';
import { SafeHtml } from '@/components/editors/SafeHtml';
import { ChartCard, DonutSeries } from '@/components/charts/charts';
import { useOp } from '@/components/op/useOp';
import { usePermissions } from '@/hooks/usePermissions';
import { useAppSelector } from '@/store/redux';
import { LoadingBlock } from '@/components/feedback/states';
import { EmployeeName } from '@/components/op/employees';
import { InterviewDialog } from './InterviewDialog';

const STEPS = ['SUBMITTED', 'MANAGER_APPROVED', 'HR_CONFIRMED', 'CLEARED', 'INTERVIEW_DONE', 'SETTLEMENT_PENDING', 'COMPLETED'];
const RICH = { reason: { rich: true }, comment: { rich: true } };
const COLS = [{ key: 'employeeName' }, { key: 'submittedOn' }, { key: 'requestedLastWorkingDay' }, { key: 'confirmedLastWorkingDay', defaultHidden: true }, { key: 'noticePeriodDays', defaultHidden: true }, { key: 'departmentId', defaultHidden: true }, { key: 'status', cell: (r: any) => <StatusBadge value={r.status} /> }];

function ResignationDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation(); const p = usePermissions(); const self = useAppSelector((s) => s.auth.user?.employeeId); const [iv, setIv] = useState(false);
  const q = useOp<any>('exit.get', { path: { id } }); const r = q.data; const s = r?.status;
  const hr = p.canCall('exit.confirm'); const mgr = p.canCall('exit.managerDecision'); const pay = p.canCall('exit.calculate');
  const step = Math.max(0, STEPS.indexOf(s));
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={`Resignation · ${r?.employeeName ?? ''}`} size="xl"
      footer={r && <>
        {r.employeeId === self && ['SUBMITTED', 'MANAGER_APPROVED'].includes(s) && <OpButton op="exit.withdraw" path={{ id }} label="Withdraw" size="md" />}
        {mgr && s === 'SUBMITTED' && <OpButton op="exit.managerDecision" path={{ id }} label="Manager decision" size="md" variant="default" overrides={{ comment: { rich: true } }} />}
        {hr && s === 'MANAGER_APPROVED' && <OpButton op="exit.confirm" path={{ id }} label="HR confirm" size="md" variant="default" overrides={{ comment: { rich: true } }} />}
        {hr && ['HR_CONFIRMED', 'CLEARED'].includes(s) && <><OpButton op="exit.schedule" path={{ id }} label="Schedule interview" size="md" /><Button variant="default" onClick={() => setIv(true)}>Complete interview</Button></>}
        {pay && ['INTERVIEW_DONE', 'SETTLEMENT_PENDING'].includes(s) && <><OpButton op="exit.calculate" path={{ id }} label="Calculate settlement" size="md" /><OpButton op="exit.process" path={{ id }} label="Process settlement" size="md" variant="default" /></>}
        {hr && ['SETTLEMENT_PENDING', 'INTERVIEW_DONE'].includes(s) && <OpButton op="exit.completeExit" path={{ id }} label="Complete exit" size="md" variant="success" icon={<Check size={14} />} confirm="Complete the exit? The employee account is deactivated." />}
      </>}>
      {q.isLoading ? <LoadingBlock /> : r && <div className="d-grid gap-3">
        <Stepper activeStep={step} alternativeLabel>{STEPS.map((x) => <Step key={x} completed={STEPS.indexOf(x) < step || s === 'COMPLETED'}><StepLabel>{t(`hr.statuses.${x}`, { defaultValue: x.replace(/_/g, ' ') })}</StepLabel></Step>)}</Stepper>
        <Detail data={r} hide={['id', 'reason', 'managerComment', 'hrComment']} render={{ managerId: (v) => <EmployeeName id={v} /> }} />
        {(['reason', 'managerComment', 'hrComment'] as const).filter((k) => r[k]).map((k) => <div key={k}><div className="field-label">{t(`fields.${k}`, { defaultValue: k })}</div><SafeHtml html={r[k]} /></div>)}
        <CrudSection title="Exit tasks / clearance" list={{ op: 'exit.tasks', path: { id } }} create={{ op: 'exit.addTask', path: { id } }} tableId="exit-tasks" extraRowActions={(row) => row.status !== 'DONE' && row.status !== 'COMPLETED' ? <OpButton op="exit.complete" path={{ taskId: row.id }} label="Complete" variant="ghost" icon={<Check size={13} />} /> : null} />
        <OpView op="exit.interview" path={{ id }} title="Exit interview" render={{ answers: () => null }} />
        <OpView op="exit.settlement" path={{ id }} title="Final settlement" />
        <OpView op="exit.history" path={{ id }} title="History" />
      </div>}
      {iv && <InterviewDialog resignationId={id} onClose={() => { setIv(false); q.refetch(); }} />}
    </Modal>
  );
}
function Mine() {
  const [open, setOpen] = useState<string | null>(null);
  return (<>
    <Card><CardHeader><CardTitle>My resignation</CardTitle><OpButton op="exit.submit" label="Submit resignation" variant="default" size="md" overrides={{ reason: { rich: true } }} /></CardHeader>
      <CardBody className="p-3"><OpTable op="exit.mine" tableId="exit-mine" columns={COLS} onRowClick={(r) => setOpen(r.id)} /></CardBody></Card>
    {open && <ResignationDetail id={open} onClose={() => setOpen(null)} />}</>);
}
function Pending() {
  const { t } = useTranslation(); const [open, setOpen] = useState<string | null>(null);
  return (<>
    <Card><CardHeader><CardTitle>Awaiting my decision</CardTitle></CardHeader><CardBody className="p-3"><OpTable op="exit.pending" tableId="exit-pending" columns={COLS} onRowClick={(r) => setOpen(r.id)}
      rowActions={(r) => <OpButton op="exit.managerDecision" path={{ id: r.id }} label="Decide" icon={<X size={13} />} variant="outline" overrides={{ comment: { rich: true } }} />} /></CardBody></Card>
    {open && <ResignationDetail id={open} onClose={() => setOpen(null)} />}<span hidden>{t('common.ok')}</span></>);
}
function All() {
  const [open, setOpen] = useState<string | null>(null); const [status, setStatus] = useState('');
  const sum = useOp<any>('exit.summary'); const data = Object.entries(sum.data?.byStatus ?? {}).map(([name, value]) => ({ name, value: Number(value) }));
  return (<div className="d-grid gap-3">
    <div className="row g-3"><div className="col-lg-4"><ChartCard title={`Exit status · total ${sum.data?.total ?? 0}`} loading={sum.isLoading} error={sum.error} empty={!data.length} height={220}><DonutSeries data={data} /></ChartCard></div>
      <div className="col-lg-8"><OpTable op="exit.list" tableId="exit-all" columns={COLS} query={{ status }} onRowClick={(r) => setOpen(r.id)} filters={<select className="form-select form-select-sm w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="status"><option value="">All</option>{STEPS.concat(['MANAGER_REJECTED', 'WITHDRAWN']).map((s) => <option key={s}>{s}</option>)}</select>} /></div></div>
    {open && <ResignationDetail id={open} onClose={() => setOpen(null)} />}</div>);
}
function PolicyTab() {
  return <OpView op="exit.policy" title="Exit policy" actions={<OpButton op="exit.updatePolicy" label="Edit policy" variant="default" />} />;
}
export default function ExitPage() {
  const { t } = useTranslation(); const p = usePermissions(); const self = useAppSelector((s) => s.auth.user?.employeeId);
  return (
    <>
      <PageHeader title={t('hr.exit.title')} description={t('hr.exit.sub')} icon={<LogOut size={20} />} />
      <Tabs tabs={[
        { key: 'mine', label: t('nav.myWorkspace'), hidden: !self, content: <Mine /> },
        { key: 'pending', label: t('hr.leave.approvals'), hidden: !p.canCall('exit.pending'), content: <Pending /> },
        { key: 'all', label: 'All resignations', hidden: !p.canCall('exit.list'), content: <All /> },
        { key: 'policy', label: t('hr.leave.policy'), hidden: !p.canCall('exit.policy'), content: <PolicyTab /> },
      ]} />
    </>
  );
}
void RICH;
