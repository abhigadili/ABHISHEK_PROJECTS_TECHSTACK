import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, CalendarPlus, Check, X } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Tabs } from '@/components/ui/tabs';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Modal } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/input';
import { OpButton } from '@/components/op/OpButton';
import { OpView } from '@/components/op/OpView';
import { OpTable } from '@/components/tables/OpTable';
import { CrudSection } from '@/components/op/CrudSection';
import { Calendar, expandRange, type CalEvent } from '@/components/common/Calendar';
import { StatusBadge } from '@/components/common/values';
import { SafeHtml } from '@/components/editors/SafeHtml';
import { useOp } from '@/components/op/useOp';
import { useRefOptions } from '@/components/op/refs';
import { usePermissions } from '@/hooks/usePermissions';
import { useAppSelector } from '@/store/redux';
import { ErrorState } from '@/components/feedback/states';
import type { Col } from '@/components/tables/DataTable';
import { EmployeeName } from '@/components/op/employees';

const APP_COLS: Col[] = [
  { key: 'employeeName', defaultHidden: true }, { key: 'leaveTypeName' }, { key: 'fromDate', sortable: true }, { key: 'toDate' }, { key: 'days' },
  { key: 'reason', cell: (r) => <span className="line-clamp-1" style={{ maxWidth: 220, display: 'inline-block' }}>{r.reason}</span> }, { key: 'stage', defaultHidden: true },
  { key: 'status', cell: (r) => <StatusBadge value={r.status} />, sortable: true }, { key: 'appliedAt', defaultHidden: true },
];
const RICH = { reason: { textarea: true } };
const DECISION = { comment: { rich: true } };

function Detail({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Leave application" size="lg">
      <OpView op="leave.get" path={{ id }} bare hide={['attachments']} />
      <div className="mt-3"><div className="field-label">Approval trail</div><OpView op="leave.approvals" path={{ id }} bare /></div>
      <div className="mt-3"><div className="d-flex justify-content-between"><div className="field-label">{t('common.comments')}</div><OpButton op="leave.addComment" path={{ id }} label={t('common.add')} overrides={{ comment: { rich: true } }} /></div>
        <OpView op="leave.comments" path={{ id }} bare>{(d: any[]) => d?.length ? d.map((c) => <div key={c.id} className="mb-2 rounded-md bg-surface-2 p-2"><div className="text-xs text-muted"><EmployeeName id={c.authorEmployeeId ?? c.employeeId} /> · {c.createdAt}</div><SafeHtml html={c.comment ?? c.body ?? c.text} /></div>) : <div className="text-muted text-xs">—</div>}</OpView></div>
    </Modal>
  );
}

function MyLeave() {
  const { t } = useTranslation(); const [status, setStatus] = useState(''); const [detail, setDetail] = useState<string | null>(null);
  const bal = useOp<any[]>('leave.mine', { query: { year: new Date().getFullYear() } });
  return (
    <div className="d-grid gap-3">
      <Card><CardHeader><CardTitle>{t('hr.leave.balance')} · {new Date().getFullYear()}</CardTitle><OpButton op="leave.apply" label={t('hr.leave.apply')} icon={<CalendarPlus size={14} />} variant="default" overrides={RICH} dialogSize="lg" /></CardHeader>
        <CardBody>{bal.isError ? <ErrorState error={bal.error} /> : <div className="row g-3">{(bal.data ?? []).map((b) => (
          <div key={b.leaveTypeId} className="col-6 col-md-4 col-xl-3"><div className="rounded-lg border p-3 h-100" style={{ borderColor: 'var(--hr-border)' }}>
            <div className="text-muted" style={{ fontSize: 12 }}>{b.leaveTypeName}</div><div className="fs-3 fw-bold">{b.available}</div>
            <div className="text-muted" style={{ fontSize: 11 }}>Entitled {Number(b.opening ?? 0) + Number(b.accrued ?? 0) + Number(b.carriedForward ?? 0) + Number(b.adjusted ?? 0)} · Used {b.used} · Pending {b.pending}{b.encashed ? ` · Encashed ${b.encashed}` : ''}</div></div></div>))}
          {bal.data && !bal.data.length && <div className="text-muted">—</div>}</div>}</CardBody></Card>
      <OpTable op="leave.mineLeaveApplications" tableId="my-leaves" columns={APP_COLS} sortable={['fromDate', 'status']} defaultSort="fromDate,desc" query={{ status }} onRowClick={(r) => setDetail(r.id)}
        filters={<NativeSelect className="w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t('common.status')}><option value="">{t('common.all')}</option>{['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'WITHDRAWN'].map((s) => <option key={s}>{s}</option>)}</NativeSelect>}
        rowActions={(r) => <>
          {r.status === 'PENDING' && <><OpButton op="leave.update" path={{ id: r.id }} initial={r} variant="ghost" label={t('common.edit')} overrides={RICH} /><OpButton op="leave.withdraw" path={{ id: r.id }} variant="ghost" label="Withdraw" /></>}
          {r.status === 'APPROVED' && <OpButton op="leave.cancel" path={{ id: r.id }} variant="ghost" label={t('common.cancel')} overrides={{ reason: { textarea: true } }} />}
        </>} />
      {detail && <Detail id={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function LeaveCalendar() {
  const { t } = useTranslation(); const p = usePermissions(); const [range, setRange] = useState<[string, string]>(['', '']); const [dept, setDept] = useState(''); const [scope, setScope] = useState<'me' | 'team'>('me');
  const deps = useRefOptions('department'); const team = scope === 'team' && p.canCall('leave.teamCalendar');
  const mine = useOp<any[]>('leave.myCalendar', { query: { from: range[0], to: range[1] } }, { enabled: !!range[0] && !team });
  const tm = useOp<any[]>('leave.teamCalendar', { query: { from: range[0], to: range[1], departmentId: dept || undefined } }, { enabled: !!range[0] && team });
  const hol = useOp<any[]>('holiday.range', { query: { from: range[0], to: range[1] } }, { enabled: !!range[0] });
  const rows = (team ? tm.data : mine.data) ?? [];
  const events: CalEvent[] = [
    ...rows.flatMap((e) => expandRange(e.fromDate, e.toDate, () => ({ label: `${team ? e.employeeName + ' · ' : ''}${e.leaveTypeName}`, title: `${e.employeeName} ${e.leaveTypeName} (${e.status})`, tone: e.status === 'APPROVED' ? 'success' : e.status === 'PENDING' ? 'warning' : 'neutral' }))),
    ...(hol.data ?? []).map((h) => ({ date: h.holidayDate, label: `★ ${h.name}`, tone: 'info' as const })),
  ];
  return (
    <>
      <Calendar events={events} onRange={(f, to) => setRange((r) => (r[0] === f && r[1] === to ? r : [f, to]))}
        toolbar={<>{p.canCall('leave.teamCalendar') && <NativeSelect className="h-8 w-auto text-xs" value={scope} onChange={(e) => setScope(e.target.value as any)} aria-label="scope"><option value="me">{t('nav.myWorkspace')}</option><option value="team">Team</option></NativeSelect>}
          {team && <NativeSelect className="h-8 w-auto text-xs" value={dept} onChange={(e) => setDept(e.target.value)} aria-label={t('common.department')}><option value="">{t('common.all')}</option>{deps.options.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</NativeSelect>}</>} />
      {p.canCall('leave.upcoming') && <div className="mt-3"><OpView op="leave.upcoming" query={{ days: 30 }} title="Upcoming leave (30 days)" /></div>}
    </>
  );
}

function Approvals() {
  const { t } = useTranslation();
  const act = (r: any) => <>
    <OpButton op="leave.approve" path={{ id: r.id }} label={t('common.approve')} icon={<Check size={13} />} variant="success" overrides={DECISION} />
    <OpButton op="leave.reject" path={{ id: r.id }} label={t('common.reject')} icon={<X size={13} />} variant="danger" overrides={DECISION} /></>;
  return (
    <div className="d-grid gap-3">
      <Card><CardHeader><CardTitle>{t('hr.leave.approvals')}</CardTitle></CardHeader><CardBody className="p-3"><OpTable op="leave.pending" tableId="leave-pending" columns={APP_COLS} rowActions={act} exportable /></CardBody></Card>
      <Card><CardHeader><CardTitle>Cancellation requests</CardTitle></CardHeader><CardBody className="p-3">
        <OpTable op="leave.cancellationRequests" tableId="leave-cancel" columns={APP_COLS} rowActions={(r) => <>
          <OpButton op="leave.approveCancellation" path={{ id: r.id }} label={t('common.approve')} variant="success" overrides={DECISION} /><OpButton op="leave.rejectCancellation" path={{ id: r.id }} label={t('common.reject')} variant="danger" overrides={DECISION} /></>} /></CardBody></Card>
    </div>
  );
}

function Policy() {
  return (
    <div className="d-grid gap-3">
      <CrudSection title="Leave types" list={{ op: 'leave.types' }} create={{ op: 'leave.createType' }} update={{ op: 'leave.updateType', path: (r) => ({ id: r.id }) }} remove={{ op: 'leave.deleteType', path: (r) => ({ id: r.id }) }} dialogSize="lg" />
      <CrudSection title="Leave policies" list={{ op: 'leave.policies' }} create={{ op: 'leave.createPolicy' }} update={{ op: 'leave.updatePolicy', path: (r) => ({ id: r.id }) }} view={{ op: 'leave.policy', path: (r) => ({ id: r.id }) }} dialogSize="xl" />
    </div>
  );
}

function Admin() {
  const [emp, setEmp] = useState('');
  return (
    <div className="d-grid gap-3">
      <Card><CardHeader><CardTitle>Batch jobs</CardTitle></CardHeader><CardBody className="d-flex flex-wrap gap-2">
        <OpButton op="leave.accrue" label="Run monthly accrual" variant="outline" size="md" /><OpButton op="leave.carryForward" label="Run year-end carry-forward" variant="outline" size="md" /></CardBody></Card>
      <Card><CardHeader><CardTitle>Employee balance tools</CardTitle></CardHeader><CardBody>
        <div className="d-flex flex-wrap gap-2 align-items-end mb-3"><div style={{ minWidth: 260 }}><div className="field-label">Employee id</div><input className="form-control form-control-sm" value={emp} onChange={(e) => setEmp(e.target.value.trim())} placeholder="employee UUID (see Employees)" /></div>
          {emp && <><OpButton op="leave.adjust" path={{ employeeId: emp }} label="Adjust balance" size="md" /><OpButton op="leave.encash" path={{ employeeId: emp }} label="Encash" size="md" /></>}</div>
        {emp && <><OpView op="leave.encashable" path={{ employeeId: emp }} title="Encashable" /><div className="mt-3"><OpView op="leave.reconcile" path={{ employeeId: emp }} title="Reconciliation" /></div></>}</CardBody></Card>
      <Card><CardHeader><CardTitle>Unpaid days (for payroll)</CardTitle></CardHeader><CardBody><OpView op="leave.unpaid" bare /></CardBody></Card>
    </div>
  );
}
void Button;

export default function LeavePage() {
  const { t } = useTranslation(); const p = usePermissions(); const self = useAppSelector((s) => s.auth.user?.employeeId);
  return (
    <>
      <PageHeader title={t('hr.leave.title')} description={t('hr.leave.sub')} icon={<CalendarDays size={20} />} />
      <Tabs tabs={[
        { key: 'mine', label: t('nav.myWorkspace'), hidden: !self, content: <MyLeave /> },
        { key: 'calendar', label: t('hr.leave.calendar'), content: <LeaveCalendar /> },
        { key: 'approvals', label: t('hr.leave.approvals'), hidden: !p.canCall('leave.pending'), content: <Approvals /> },
        { key: 'policy', label: t('hr.leave.policy'), content: <Policy /> },
        { key: 'admin', label: t('hr.leave.admin'), hidden: !p.isAdmin, content: <Admin /> },
      ]} />
    </>
  );
}
