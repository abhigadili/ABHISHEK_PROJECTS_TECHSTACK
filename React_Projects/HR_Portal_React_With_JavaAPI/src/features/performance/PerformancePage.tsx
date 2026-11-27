import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Target, Check, Undo2, Play, Square } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Tabs } from '@/components/ui/tabs';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Modal } from '@/components/ui/dialog';
import { NativeSelect } from '@/components/ui/input';
import { OpButton } from '@/components/op/OpButton';
import { OpView } from '@/components/op/OpView';
import { OpTable } from '@/components/tables/OpTable';
import { CrudSection } from '@/components/op/CrudSection';
import { EmployeeScope } from '@/components/op/EmployeeScope';
import { Detail } from '@/components/common/Detail';
import { StatusBadge } from '@/components/common/values';
import { SafeHtml } from '@/components/editors/SafeHtml';
import { DataTable } from '@/components/tables/DataTable';
import { ChartCard, BarSeries, DonutSeries } from '@/components/charts/charts';
import { useOp } from '@/components/op/useOp';
import { useRefOptions } from '@/components/op/refs';
import { usePermissions } from '@/hooks/usePermissions';
import { useAppSelector } from '@/store/redux';
import { LoadingBlock } from '@/components/feedback/states';

const RICH_SELF = { achievements: { rich: true }, strengths: { rich: true }, improvementAreas: { rich: true } };
const RICH_MGR = { managerFeedback: { rich: true }, strengths: { rich: true }, improvementAreas: { rich: true } };
const FB = { comment: { rich: true } };

function ReviewDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation(); const p = usePermissions(); const self = useAppSelector((s) => s.auth.user?.employeeId);
  const q = useOp<any>('performance.review', { path: { id } }); const r = q.data;
  const isOwner = r && r.employeeId === self; const isMgr = r && r.managerId === self;
  const stat = r?.status;
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={`Review · ${r?.employeeName ?? ''}`} size="xl"
      footer={r && <>
        {(isOwner || !self) && stat === 'SELF_PENDING' && <><OpButton op="performance.saveSelf" path={{ id }} initial={r} label="Save self-evaluation" size="md" dialogSize="xl" overrides={RICH_SELF} /><OpButton op="performance.submitSelf" path={{ id }} label="Submit self-evaluation" variant="default" size="md" /></>}
        {p.canCall('performance.saveManager') && stat === 'SELF_SUBMITTED' && <>
          <OpButton op="performance.saveManager" path={{ id }} initial={r} label="Manager evaluation" size="md" dialogSize="xl" overrides={RICH_MGR} />
          <OpButton op="performance.submitManager" path={{ id }} label="Submit evaluation" variant="default" size="md" />
          <OpButton op="performance.returnReview" path={{ id }} label="Return to employee" icon={<Undo2 size={14} />} size="md" overrides={FB} /></>}
        {p.canCall('performance.approve') && stat === 'MANAGER_SUBMITTED' && <OpButton op="performance.approve" path={{ id }} label={t('common.approve')} icon={<Check size={14} />} variant="success" size="md" overrides={{ comment: { rich: true } }} />}
        {isMgr && false}
      </>}>
      {q.isLoading ? <LoadingBlock /> : r && <div className="d-grid gap-3">
        <Detail data={r} hide={['id', 'answers', 'achievements', 'strengths', 'improvementAreas', 'managerFeedback', 'hrComment']} />
        {(['achievements', 'strengths', 'improvementAreas', 'managerFeedback', 'hrComment'] as const).filter((k) => r[k]).map((k) => <div key={k}><div className="field-label">{t(`fields.${k}`, { defaultValue: k })}</div><SafeHtml html={r[k]} /></div>)}
        {r.answers?.length > 0 && <div><div className="field-label">Answers</div><DataTable id="rev-answers" rows={r.answers} /></div>}
        <OpView op="performance.trail" path={{ id }} title="Review history" />
        {r.formId && <OpView op="performance.form" path={{ id: r.formId }} title="Review form" />}
      </div>}
    </Modal>
  );
}
function MyReviews() {
  const [open, setOpen] = useState<string | null>(null);
  return (<>
    <Card><CardHeader><CardTitle>My reviews</CardTitle></CardHeader><CardBody className="p-3"><OpTable op="performance.myReviews" tableId="my-reviews" onRowClick={(r) => setOpen(r.id)} columns={[{ key: 'cycleId' }, { key: 'status', cell: (r) => <StatusBadge value={r.status} /> }, { key: 'selfRating' }, { key: 'managerRating' }, { key: 'finalRating' }, { key: 'managerId', defaultHidden: true }]} /></CardBody></Card>
    {open && <ReviewDetail id={open} onClose={() => setOpen(null)} />}</>);
}
function Goals({ employeeId }: { employeeId?: string }) {
  const [cycle, setCycle] = useState(''); const cycles = useRefOptions('cycle');
  return (
    <CrudSection title="Goals & OKRs" list={employeeId ? { op: 'performance.goalsOf', path: { employeeId } } : { op: 'performance.myGoals', query: { cycleId: cycle } }} tableId={`goals-${employeeId ?? 'me'}`}
      create={employeeId ? undefined : { op: 'performance.createGoal' }} update={{ op: 'performance.updateGoal', path: (r) => ({ id: r.id }) }} remove={employeeId ? undefined : { op: 'performance.deleteGoal', path: (r) => ({ id: r.id }) }} dialogSize="lg"
      actions={!employeeId && <NativeSelect className="w-auto" value={cycle} onChange={(e) => setCycle(e.target.value)} aria-label="cycle"><option value="">All cycles</option>{cycles.options.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</NativeSelect>}
      columns={[{ key: 'title' }, { key: 'type' }, { key: 'status', cell: (r) => <StatusBadge value={r.status} /> }, { key: 'progress', cell: (r) => (r.progress != null ? `${r.progress}%` : '—') }, { key: 'weight' }, { key: 'targetDate' }, { key: 'cycleId', defaultHidden: true }]}
      extraRowActions={(r) => <><OpButton op="performance.progress" path={{ id: r.id }} label="Progress" variant="ghost" />{(r.keyResults ?? []).slice(0, 4).map((k: any) => <OpButton key={k.id} op="performance.keyResult" path={{ id: r.id, keyResultId: k.id }} label={`KR: ${String(k.title ?? k.description ?? 'result').slice(0, 14)}`} variant="ghost" />)}</>} />
  );
}
function Feedback() {
  return <CrudSection title="Feedback about me" list={{ op: 'performance.aboutMe' }} create={{ op: 'performance.give' }} actions={null} />;
}
function Team() {
  const [open, setOpen] = useState<string | null>(null);
  return (<>
    <Card><CardHeader><CardTitle>Reviews awaiting my action</CardTitle></CardHeader><CardBody className="p-3"><OpTable op="performance.pending" tableId="rev-pending" onRowClick={(r) => setOpen(r.id)} columns={[{ key: 'employeeName' }, { key: 'cycleId' }, { key: 'status', cell: (r) => <StatusBadge value={r.status} /> }, { key: 'selfRating' }, { key: 'managerRating' }]} /></CardBody></Card>
    {open && <ReviewDetail id={open} onClose={() => setOpen(null)} />}</>);
}
function CyclesAdmin() {
  const [cid, setCid] = useState('');
  const cycles = useOp<any[]>('performance.cycles'); const cycle = cid || cycles.data?.[0]?.id || '';
  const sum = useOp<any>('performance.summary', { path: { id: cycle } }, { enabled: !!cycle });
  const dist = Object.entries(sum.data?.finalRatingDistribution ?? {}).map(([name, count]) => ({ name, count }));
  const st = Object.entries(sum.data?.byStatus ?? {}).map(([name, value]) => ({ name, value: Number(value) }));
  return (
    <div className="d-grid gap-3">
      <CrudSection title="Review cycles" list={{ op: 'performance.cycles' }} create={{ op: 'performance.createCycle' }} dialogSize="lg" tableId="cycles"
        actions={<OpButton op="performance.runReminders" label="Send reminders" />}
        extraRowActions={(r) => <>{r.status === 'DRAFT' && <OpButton op="performance.activate" path={{ id: r.id }} icon={<Play size={13} />} label="Activate" variant="outline" />}{r.status === 'ACTIVE' && <OpButton op="performance.close" path={{ id: r.id }} icon={<Square size={13} />} label="Close" variant="outline" />}</>} />
      <Card><CardHeader><CardTitle>Cycle summary</CardTitle><NativeSelect className="w-auto" value={cycle} onChange={(e) => setCid(e.target.value)} aria-label="cycle">{(cycles.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></CardHeader>
        <CardBody>{sum.data && <><Detail data={sum.data} hide={['cycleId']} /><div className="row g-3 mt-1"><div className="col-lg-6"><ChartCard title="Reviews by status" empty={!st.length}><DonutSeries data={st} /></ChartCard></div><div className="col-lg-6"><ChartCard title="Final rating distribution" empty={!dist.length}><BarSeries data={dist} x="name" keys={[{ key: 'count', label: 'Employees' }]} /></ChartCard></div></div></>}</CardBody></Card>
      <CrudSection title="Review forms" list={{ op: 'performance.forms' }} create={{ op: 'performance.createForm' }} update={{ op: 'performance.updateForm', path: (r) => ({ id: r.id }) }} view={{ op: 'performance.form', path: (r) => ({ id: r.id }) }} dialogSize="xl" />
    </div>
  );
}
export default function PerformancePage() {
  const { t } = useTranslation(); const p = usePermissions(); const self = useAppSelector((s) => s.auth.user?.employeeId);
  return (
    <>
      <PageHeader title={t('hr.performance.title')} description={t('hr.performance.sub')} icon={<Target size={20} />} />
      <Tabs tabs={[
        { key: 'reviews', label: 'My reviews', hidden: !self, content: <MyReviews /> },
        { key: 'goals', label: 'My goals', hidden: !self, content: <Goals /> },
        { key: 'feedback', label: 'Feedback', hidden: !p.canCall('performance.aboutMe'), content: <Feedback /> },
        { key: 'team', label: 'Team reviews', hidden: !p.canCall('performance.pending'), content: <Team /> },
        { key: 'cycles', label: 'Cycles & forms', hidden: !p.canCall('performance.createCycle'), content: <CyclesAdmin /> },
        { key: 'employee', label: 'Employee performance', hidden: !p.canCall('performance.history') || !p.isManager, content: <EmployeeScope>{(id) => <div className="d-grid gap-3"><OpView op="performance.history" path={{ employeeId: id }} title="Review history" /><Goals employeeId={id} /><OpView op="performance.about" path={{ employeeId: id }} title="Feedback" /></div>}</EmployeeScope> },
      ]} />
    </>
  );
}
