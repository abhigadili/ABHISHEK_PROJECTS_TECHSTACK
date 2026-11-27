import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, LogIn, LogOut, Check, X } from 'lucide-react';
import dayjs from 'dayjs';
import { PageHeader } from '@/components/common/PageHeader';
import { Tabs } from '@/components/ui/tabs';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { OpButton } from '@/components/op/OpButton';
import { OpView } from '@/components/op/OpView';
import { OpTable } from '@/components/tables/OpTable';
import { CrudSection } from '@/components/op/CrudSection';
import { Calendar, type CalEvent } from '@/components/common/Calendar';
import { StatusBadge, Value } from '@/components/common/values';
import { Detail } from '@/components/common/Detail';
import { useOp } from '@/components/op/useOp';
import { usePermissions } from '@/hooks/usePermissions';
import { useAppSelector } from '@/store/redux';
import { useFormat } from '@/contexts/LanguageContext';
import { monthStr, isoDate } from '@/utils/format';
import { DataTable } from '@/components/tables/DataTable';
import { ChartCard, BarSeries } from '@/components/charts/charts';
import { LoadingBlock } from '@/components/feedback/states';

const hm = (m?: number) => (m == null ? '—' : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`);
const DEC = { comment: { rich: true } };
const TONE: Record<string, CalEvent['tone']> = { PRESENT: 'success', ABSENT: 'danger', HALF_DAY: 'warning', MISSING_PUNCH: 'warning', WEEKLY_OFF: 'neutral', HOLIDAY: 'info', LEAVE: 'info', ON_LEAVE: 'info', WFH: 'info' };

function Today() {
  const { t } = useTranslation(); const f = useFormat(); const q = useOp<any>('attendance.today'); const a = q.data;
  return (
    <Card><CardHeader><CardTitle>{t('common.today')} · {f.date(isoDate())}</CardTitle><StatusBadge value={a?.status} /></CardHeader>
      <CardBody className="d-flex flex-wrap align-items-center gap-4">
        <div><div className="field-label m-0">{t('fields.checkIn')}</div><div className="fs-4 fw-bold">{f.time(a?.checkIn)}</div></div>
        <div><div className="field-label m-0">{t('fields.checkOut')}</div><div className="fs-4 fw-bold">{f.time(a?.checkOut)}</div></div>
        <div><div className="field-label m-0">{t('hr.dashboard.workedToday')}</div><div className="fs-4 fw-bold">{hm(a?.workedMinutes)}</div></div>
        <div className="ms-auto d-flex gap-2"><OpButton op="attendance.checkIn" label={t('hr.dashboard.checkIn')} icon={<LogIn size={15} />} variant="default" size="md" /><OpButton op="attendance.checkOut" label={t('hr.dashboard.checkOut')} icon={<LogOut size={15} />} size="md" confirm={false} /></div>
      </CardBody></Card>
  );
}
function MyAttendance() {
  const { t } = useTranslation(); const [month, setMonth] = useState(monthStr()); const [range, setRange] = useState<[string, string]>(['', '']);
  const cal = useOp<any[]>('attendance.myCalendar', { query: { month } });
  const rec = useOp<any[]>('attendance.mine', { query: { from: dayjs(month + '-01').startOf('month').format('YYYY-MM-DD'), to: dayjs(month + '-01').endOf('month').format('YYYY-MM-DD') } });
  const summary = useOp<any>('attendance.myMonthly', { query: { month } });
  void range; void setRange;
  const events: CalEvent[] = (cal.data ?? []).filter((d) => d.type !== 'NO_RECORD').map((d) => ({ date: d.date, label: `${d.type.replace(/_/g, ' ')}${d.workedMinutes ? ' · ' + hm(d.workedMinutes) : ''}`, tone: TONE[d.type] ?? 'primary' }));
  return (
    <div className="d-grid gap-3">
      <Today />
      <div className="d-flex gap-2 align-items-center"><Input type="month" className="w-auto" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} aria-label={t('common.month')} /></div>
      <Card><CardHeader><CardTitle>{t('common.summary')} · {month}</CardTitle></CardHeader><CardBody>{summary.isLoading ? <LoadingBlock rows={2} /> : <Detail data={summary.data} hide={['employeeId', 'generatedAt', 'year']} />}</CardBody></Card>
      <Calendar key={month} initial={dayjs(month + '-01')} events={events} />
      <DataTable id="my-attendance" rows={rec.data ?? []} loading={rec.isLoading} error={rec.error}
        columns={[{ key: 'workDate', sortable: true }, { key: 'checkIn', cell: (r: any) => <Value k="checkIn" v={r.checkIn} /> }, { key: 'checkOut' }, { key: 'workedMinutes', cell: (r: any) => hm(r.workedMinutes) }, { key: 'lateMinutes' }, { key: 'earlyDepartureMinutes', defaultHidden: true }, { key: 'overtimeMinutes', defaultHidden: true }, { key: 'workMode' }, { key: 'status', cell: (r: any) => <StatusBadge value={r.status} /> }, { key: 'remarks', defaultHidden: true }]} />
    </div>
  );
}
function Requests() {
  const { t } = useTranslation();
  return (
    <div className="d-grid gap-3">
      <CrudSection title="Regularization / corrections" list={{ op: 'attendance.myCorrections' }} create={{ op: 'attendance.requestCorrection' }} extraRowActions={(r) => r.status === 'PENDING' ? <OpButton op="attendance.cancelCorrection" path={{ id: r.id }} variant="ghost" label={t('common.cancel')} /> : null} />
      <CrudSection title="Work from home" list={{ op: 'attendance.myWfh' }} create={{ op: 'attendance.requestWfh' }} extraRowActions={(r) => r.status === 'PENDING' ? <OpButton op="attendance.cancelWfh" path={{ id: r.id }} variant="ghost" label={t('common.cancel')} /> : null} />
    </div>
  );
}
function TeamView() {
  const { t } = useTranslation(); const [date, setDate] = useState(isoDate()); const [month, setMonth] = useState(monthStr());
  const daily = useOp<any[]>('attendance.daily', { query: { date } });
  const counts = Object.entries((daily.data ?? []).reduce((a: any, r) => ({ ...a, [r.status]: (a[r.status] ?? 0) + 1 }), {})).map(([name, count]) => ({ name, count }));
  return (
    <div className="d-grid gap-3">
      <div className="row g-3"><div className="col-12 col-xl-5"><ChartCard title={`Status · ${date}`} loading={daily.isLoading} error={daily.error} empty={!counts.length}><BarSeries data={counts} x="name" keys={[{ key: 'count', label: t('common.total') }]} /></ChartCard></div>
        <div className="col-12 col-xl-7"><Card className="h-100"><CardHeader><CardTitle>{t('common.day')}</CardTitle><Input type="date" className="w-auto" value={date} onChange={(e) => setDate(e.target.value)} /></CardHeader>
          <CardBody className="p-3"><DataTable id="att-daily" rows={daily.data ?? []} loading={daily.isLoading} error={daily.error} columns={[{ key: 'employeeName' }, { key: 'status', cell: (r: any) => <StatusBadge value={r.status} /> }, { key: 'checkIn' }, { key: 'checkOut' }, { key: 'workedMinutes', cell: (r: any) => hm(r.workedMinutes) }, { key: 'lateMinutes' }, { key: 'workMode' }]} /></CardBody></Card></div></div>
      <Card><CardHeader><CardTitle>Team monthly report</CardTitle><Input type="month" className="w-auto" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} /></CardHeader><CardBody className="p-3"><OpTable op="attendance.teamReport" query={{ month }} tableId="att-team" columns={[{ key: 'employeeId' }, { key: 'presentDays' }, { key: 'halfDays' }, { key: 'absentDays' }, { key: 'leaveDays' }, { key: 'wfhDays' }, { key: 'lateCount' }, { key: 'missingPunches' }, { key: 'workedMinutes', cell: (r: any) => hm(r.workedMinutes) }, { key: 'overtimeMinutes', cell: (r: any) => hm(r.overtimeMinutes) }]} /></CardBody></Card>
    </div>
  );
}
function Approvals() {
  const { t } = useTranslation();
  return (
    <div className="d-grid gap-3">
      <Card><CardHeader><CardTitle>Pending corrections</CardTitle></CardHeader><CardBody className="p-3"><OpTable op="attendance.pendingCorrections" tableId="att-corr" rowActions={(r) => <><OpButton op="attendance.approveCorrection" path={{ id: r.id }} label={t('common.approve')} icon={<Check size={13} />} variant="success" overrides={DEC} /><OpButton op="attendance.rejectCorrection" path={{ id: r.id }} label={t('common.reject')} icon={<X size={13} />} variant="danger" overrides={DEC} /></>} /></CardBody></Card>
      <Card><CardHeader><CardTitle>Pending work-from-home</CardTitle></CardHeader><CardBody className="p-3"><OpTable op="attendance.pendingWfh" tableId="att-wfh" rowActions={(r) => <><OpButton op="attendance.approveWfh" path={{ id: r.id }} label={t('common.approve')} variant="success" overrides={DEC} /><OpButton op="attendance.rejectWfh" path={{ id: r.id }} label={t('common.reject')} variant="danger" overrides={DEC} /></>} /></CardBody></Card>
    </div>
  );
}
function Admin() {
  return (
    <div className="d-grid gap-3">
      <CrudSection title="Shifts" list={{ op: 'attendance.shifts' }} create={{ op: 'attendance.createShift' }} update={{ op: 'attendance.updateShift', path: (r) => ({ id: r.id }) }} remove={{ op: 'attendance.deleteShift', path: (r) => ({ id: r.id }) }}
        extraRowActions={(r) => <OpButton op="attendance.assign" path={{ id: r.id }} label="Assign" variant="ghost" />} />
      <Card><CardHeader><CardTitle>Batch operations</CardTitle></CardHeader><CardBody className="d-flex gap-2 flex-wrap"><OpButton op="attendance.importPunches" label="Import punches" size="md" dialogSize="lg" /><OpButton op="attendance.runMissingPunchJob" label="Run missing-punch job" size="md" /></CardBody></Card>
    </div>
  );
}
export default function AttendancePage() {
  const { t } = useTranslation(); const p = usePermissions(); const self = useAppSelector((s) => s.auth.user?.employeeId);
  return (
    <>
      <PageHeader title={t('hr.attendance.title')} description={t('hr.attendance.sub')} icon={<Clock size={20} />} />
      <Tabs tabs={[
        { key: 'mine', label: t('nav.myWorkspace'), hidden: !self, content: <MyAttendance /> },
        { key: 'requests', label: 'Corrections & WFH', hidden: !self, content: <Requests /> },
        { key: 'team', label: 'Team & daily', hidden: !p.canCall('attendance.daily'), content: <TeamView /> },
        { key: 'approvals', label: t('hr.leave.approvals'), hidden: !p.canCall('attendance.pendingCorrections'), content: <Approvals /> },
        { key: 'admin', label: t('hr.leave.admin'), hidden: !p.canCall('attendance.createShift'), content: <Admin /> },
      ]} />
      {!self && !p.canCall('attendance.daily') && <div className="mt-3 text-muted">{t('common.notAuthorized')}</div>}
    </>
  );
}
