import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { ArrowDown, ArrowUp, Eye, EyeOff, LayoutDashboard, SlidersHorizontal, Users, UserCheck, UserX, CalendarClock, PartyPopper, Timer, Target, Wallet, LogOut, Plane } from 'lucide-react';
import { Popover } from '@mui/material';
import { motion } from 'motion/react';
import { PageHeader } from '@/components/common/PageHeader';
import { KpiCard } from '@/components/common/KpiCard';
import { ChartCard, BarSeries, DonutSeries, LineSeries } from '@/components/charts/charts';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, NativeSelect } from '@/components/ui/input';
import { OpButton } from '@/components/op/OpButton';
import { OpView } from '@/components/op/OpView';
import { useOp } from '@/components/op/useOp';
import { useRefList, useRefNames } from '@/components/op/refs';
import { usePermissions } from '@/hooks/usePermissions';
import { useFormat } from '@/contexts/LanguageContext';
import { DEFAULT_WIDGETS, useUiStore } from '@/store/zustand/uiStore';
import { StatusBadge } from '@/components/common/values';
import { EmptyState } from '@/components/feedback/states';
import { monthStr, isoDate } from '@/utils/format';
import { useAppSelector } from '@/store/redux';
import { Checkbox, FormControlLabel } from '@mui/material';

interface Filters { month: string; year: number; dept: string }

function Customize({ anchor, onClose }: { anchor: HTMLElement | null; onClose: () => void }) {
  const { t } = useTranslation(); const { widgetOrder, widgetHidden, setWidgetOrder, toggleWidget, resetWidgets } = useUiStore();
  const move = (i: number, d: number) => { const o = [...widgetOrder]; const j = i + d; if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; setWidgetOrder(o); };
  return (
    <Popover open={!!anchor} anchorEl={anchor} onClose={onClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }} slotProps={{ paper: { sx: { width: 320, p: 2 } } }}>
      <div className="fw-semibold">{t('hr.dashboard.customizeTitle')}</div><div className="mb-2 text-muted" style={{ fontSize: 12 }}>{t('hr.dashboard.customizeHint')}</div>
      {widgetOrder.map((w, i) => (
        <div key={w} className="d-flex align-items-center justify-content-between">
          <FormControlLabel control={<Checkbox size="small" checked={!widgetHidden.includes(w)} onChange={() => toggleWidget(w)} />} label={<span style={{ fontSize: 13 }}>{t(`hr.dashboard.w_${w}`, { defaultValue: w })}</span>} />
          <span><Button size="icon" variant="ghost" className="h-7 w-7" aria-label="up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={14} /></Button><Button size="icon" variant="ghost" className="h-7 w-7" aria-label="down" disabled={i === widgetOrder.length - 1} onClick={() => move(i, 1)}><ArrowDown size={14} /></Button></span>
        </div>
      ))}
      <Button size="sm" variant="outline" className="mt-2" onClick={resetWidgets}>{t('common.reset')}</Button>
    </Popover>
  );
}

function Kpis({ f }: { f: Filters }) {
  const { t } = useTranslation(); const p = usePermissions(); const fmt = useFormat(); const today = isoDate();
  const exec = useOp<any>('reporting.headcount', { query: { groupBy: 'department' } }, { enabled: p.canCall('reporting.headcount') });
  const daily = useOp<any[]>('attendance.daily', { query: { date: today } }, { enabled: p.canCall('attendance.daily') });
  const onLeave = useOp<any[]>('leave.teamCalendar', { query: { from: today, to: today, departmentId: f.dept || undefined } }, { enabled: p.canCall('leave.teamCalendar') });
  const pendLeave = useOp<any[]>('leave.pending', undefined, { enabled: p.canCall('leave.pending') });
  const hol = useOp<any[]>('holiday.upcoming', { query: { limit: 5 } });
  const ts = useOp<any[]>('timesheet.pending', undefined, { enabled: p.canCall('timesheet.pending') });
  const rev = useOp<any[]>('performance.pending', undefined, { enabled: p.canCall('performance.pending') });
  const pay = useOp<any>('payroll.list', { query: { size: 1 } }, { enabled: p.canCall('payroll.list') });
  const exits = useOp<any>('exit.summary', undefined, { enabled: p.canCall('exit.summary') });
  const rows: any[] = daily.data ?? [];
  const present = rows.filter((r) => ['PRESENT', 'LATE', 'HALF_DAY', 'WFH'].includes(r.status)).length;
  const absent = rows.filter((r) => r.status === 'ABSENT').length;
  const run = pay.data?.content?.[0];
  const openExits = exits.data ? Object.entries(exits.data.byStatus ?? {}).filter(([k]) => !['COMPLETED', 'EXITED', 'WITHDRAWN', 'REJECTED'].includes(k)).reduce((a, [, v]) => a + Number(v), 0) : undefined;
  const items: { show: boolean; el: ReactNode }[] = [
    { show: p.canCall('reporting.headcount'), el: <KpiCard label={t('hr.dashboard.totalEmployees')} value={exec.data?.total} loading={exec.isLoading} icon={<Users size={20} />} to="/employees" /> },
    { show: p.canCall('reporting.headcount'), el: <KpiCard label={t('hr.dashboard.activeEmployees')} value={exec.data?.active} loading={exec.isLoading} icon={<UserCheck size={20} />} tone="success" to="/employees" /> },
    { show: p.canCall('leave.teamCalendar'), el: <KpiCard label={t('hr.dashboard.onLeave')} value={onLeave.data?.filter((e) => e.status === 'APPROVED').length} loading={onLeave.isLoading} icon={<Plane size={20} />} tone="info" to="/leave" /> },
    { show: p.canCall('attendance.daily'), el: <KpiCard label={t('hr.dashboard.present')} value={present} loading={daily.isLoading} icon={<UserCheck size={20} />} tone="success" to="/attendance" /> },
    { show: p.canCall('attendance.daily'), el: <KpiCard label={t('hr.dashboard.absent')} value={absent} loading={daily.isLoading} icon={<UserX size={20} />} tone="danger" to="/attendance" /> },
    { show: p.canCall('leave.pending'), el: <KpiCard label={t('hr.dashboard.pendingLeaves')} value={pendLeave.data?.length} loading={pendLeave.isLoading} icon={<CalendarClock size={20} />} tone="warning" to="/approvals" /> },
    { show: true, el: <KpiCard label={t('hr.dashboard.upcomingHolidays')} value={hol.data?.length} loading={hol.isLoading} icon={<PartyPopper size={20} />} hint={hol.data?.[0] ? `${hol.data[0].name} · ${fmt.date(hol.data[0].holidayDate)}` : undefined} to="/holidays" /> },
    { show: p.canCall('timesheet.pending'), el: <KpiCard label={t('hr.dashboard.pendingTimesheets')} value={ts.data?.length} loading={ts.isLoading} icon={<Timer size={20} />} tone="warning" to="/approvals" /> },
    { show: p.canCall('performance.pending'), el: <KpiCard label={t('hr.dashboard.pendingReviews')} value={rev.data?.length} loading={rev.isLoading} icon={<Target size={20} />} to="/performance" /> },
    { show: p.canCall('payroll.list'), el: <KpiCard label={t('hr.dashboard.payroll')} value={run ? <StatusBadge value={run.status} /> : '—'} loading={pay.isLoading} icon={<Wallet size={20} />} hint={run ? `${run.month ?? run.period ?? ''}` : undefined} to="/payroll" /> },
    { show: p.canCall('exit.summary'), el: <KpiCard label={t('hr.dashboard.openExits')} value={openExits} loading={exits.isLoading} icon={<LogOut size={20} />} tone="danger" to="/exit" /> },
  ].filter((i) => i.show);
  return <div className="row g-3">{items.map((i, k) => <div key={k} className="col-12 col-sm-6 col-lg-4 col-xxl-3">{i.el}</div>)}</div>;
}

function Headcount({ f }: { f: Filters }) {
  const { t } = useTranslation(); const p = usePermissions(); const [by, setBy] = useState<'department' | 'designation'>('department');
  const q = useOp<any>('reporting.headcount', { query: { groupBy: by } }, { enabled: p.canCall('reporting.headcount') });
  const des = useRefNames('designation');
  const data = (q.data?.rows ?? []).filter((r: any) => by !== 'department' || !f.dept || r.key === f.dept).map((r: any) => ({ name: by === 'designation' ? des(r.key) : r.label, count: r.count }));
  return (
    <ChartCard title={by === 'department' ? t('hr.dashboard.byDepartment') : t('hr.dashboard.byDesignation')} loading={q.isLoading} error={q.error} onRetry={() => q.refetch()} empty={!data.length}
      actions={<NativeSelect className="h-8 w-auto text-xs" value={by} onChange={(e) => setBy(e.target.value as any)} aria-label="group by"><option value="department">{t('common.department')}</option><option value="designation">{t('common.designation')}</option></NativeSelect>}>
      <BarSeries data={data} x="name" keys={[{ key: 'count', label: t('common.total') }]} />
    </ChartCard>
  );
}
function Leaves({ f }: { f: Filters }) {
  const { t } = useTranslation(); const p = usePermissions();
  const q = useOp<any>('reporting.leave', { query: { period: f.month } }, { enabled: p.canCall('reporting.leave') });
  const agg = useMemo(() => { const m = new Map<string, number>(); (q.data?.rows ?? []).filter((r: any) => r.status === 'APPROVED').forEach((r: any) => m.set(r.leaveType, (m.get(r.leaveType) ?? 0) + Number(r.days))); return [...m].map(([name, value]) => ({ name, value })); }, [q.data]);
  const apps = useMemo(() => { const m = new Map<string, number>(); (q.data?.rows ?? []).forEach((r: any) => m.set(r.status, (m.get(r.status) ?? 0) + Number(r.applications))); return [...m].map(([name, value]) => ({ name: t(`hr.statuses.${name}`, { defaultValue: name }), value })); }, [q.data, t]);
  const data = agg.length ? agg : apps;
  return <ChartCard title={`${t('hr.dashboard.leaveUtilisation')} · ${f.month}`} loading={q.isLoading} error={q.error} onRetry={() => q.refetch()} empty={!data.length}><DonutSeries data={data} /></ChartCard>;
}
function Attendance({ f }: { f: Filters }) {
  const { t } = useTranslation(); const p = usePermissions();
  const q = useOp<any>('reporting.attendance', { query: { month: f.month } }, { enabled: p.canCall('reporting.attendance') });
  const data = (q.data?.rows ?? []).filter((r: any) => !f.dept || r.departmentId === f.dept).map((r: any) => ({ name: r.departmentName, late: r.lateCount, days: r.employeeDays, hours: Math.round((r.averageWorkedMinutes ?? 0) / 6) / 10 }));
  return <ChartCard title={`${t('hr.dashboard.attendanceTrend')} · ${f.month}`} loading={q.isLoading} error={q.error} onRetry={() => q.refetch()} empty={!data.length}><BarSeries data={data} x="name" keys={[{ key: 'days', label: 'Employee-days' }, { key: 'late', label: 'Late' }]} /></ChartCard>;
}
function Joining({ f }: { f: Filters }) {
  const { t } = useTranslation(); const p = usePermissions();
  const q = useOp<any>('reporting.joiningExit', { query: { year: f.year } }, { enabled: p.canCall('reporting.joiningExit') });
  const data = useMemo(() => { const m = new Map<string, any>(); for (let i = 1; i <= 12; i++) m.set(`${f.year}-${String(i).padStart(2, '0')}`, { month: dayjs(`${f.year}-${i}-01`).format('MMM'), joiners: 0, leavers: 0 }); (q.data?.joiners ?? []).forEach((r: any) => m.get(r.month) && (m.get(r.month).joiners = r.count)); (q.data?.leavers ?? []).forEach((r: any) => m.get(r.month) && (m.get(r.month).leavers = r.count)); return [...m.values()]; }, [q.data, f.year]);
  return <ChartCard title={`${t('hr.dashboard.joining')} · ${f.year}`} loading={q.isLoading} error={q.error} onRetry={() => q.refetch()} empty={!q.data} actions={q.data && <span className="text-xs text-muted">+{q.data.totalJoiners} / −{q.data.totalLeavers}</span>}><LineSeries data={data} x="month" keys={[{ key: 'joiners', label: 'Joiners' }, { key: 'leavers', label: 'Leavers (attrition)' }]} /></ChartCard>;
}
function Projects() {
  const { t } = useTranslation(); const p = usePermissions();
  const q = useOp<any[]>('reporting.allocation', undefined, { enabled: p.canCall('reporting.allocation') });
  const data = (q.data ?? []).map((r: any) => ({ name: r.projectName ?? r.name ?? r.project, allocation: r.totalAllocation ?? r.allocationPercent ?? r.members ?? r.headcount ?? 0 }));
  return <ChartCard title={t('hr.dashboard.projectAllocation')} loading={q.isLoading} error={q.error} onRetry={() => q.refetch()} empty={!data.length}><BarSeries data={data} x="name" keys={[{ key: 'allocation', label: 'Allocation' }]} /></ChartCard>;
}
function Timesheets({ f }: { f: Filters }) {
  const { t } = useTranslation(); const p = usePermissions();
  const q = useOp<any>('reporting.timesheets', { query: { month: f.month } }, { enabled: p.canCall('reporting.timesheets') });
  const data = (q.data?.rows ?? []).map((r: any) => ({ name: r.employeeName, billable: Number(r.billableHours), nonBillable: Number(r.totalHours) - Number(r.billableHours) }));
  return <ChartCard title={`${t('hr.dashboard.timesheetUtil')} · ${f.month}`} loading={q.isLoading} error={q.error} onRetry={() => q.refetch()} empty={!data.length}><BarSeries stacked data={data} x="name" keys={[{ key: 'billable', label: 'Billable h' }, { key: 'nonBillable', label: 'Non-billable h' }]} /></ChartCard>;
}
function Performance() {
  const { t } = useTranslation(); const p = usePermissions();
  const cycles = useOp<any[]>('performance.cycles'); const [cid, setCid] = useState('');
  const cycle = cid || cycles.data?.find((c) => c.status !== 'DRAFT')?.id || '';
  const q = useOp<any>('reporting.performance', { query: { cycleId: cycle } }, { enabled: !!cycle && p.canCall('reporting.performance') });
  const byStatus = q.data?.byStatus ?? q.data?.statusCounts ?? q.data?.summary?.byStatus ?? {};
  const data = Object.entries(byStatus).map(([name, value]) => ({ name: t(`hr.statuses.${name}`, { defaultValue: name }), value: Number(value) }));
  return (
    <ChartCard title={t('hr.dashboard.reviewCompletion')} loading={cycles.isLoading || q.isLoading} error={q.error} onRetry={() => q.refetch()} empty={!data.length}
      actions={<NativeSelect className="h-8 w-auto text-xs" value={cycle} onChange={(e) => setCid(e.target.value)} aria-label="cycle">{(cycles.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect>}>
      <DonutSeries data={data} />
    </ChartCard>
  );
}
function Holidays() {
  const { t } = useTranslation(); const f = useFormat(); const q = useOp<any[]>('holiday.upcoming', { query: { limit: 6 } });
  return (
    <Card className="h-100"><CardHeader><CardTitle>{t('hr.dashboard.upcomingHolidays')}</CardTitle><Link to="/holidays" className="text-xs">{t('common.view')} →</Link></CardHeader>
      <CardBody>{q.data?.length ? <ul className="m-0 list-none p-0">{q.data.map((h) => <li key={h.id} className="d-flex justify-content-between border-bottom py-2" style={{ fontSize: 13, borderColor: 'var(--hr-border)' }}><span>{h.name}</span><span className="text-muted">{f.date(h.holidayDate)}</span></li>)}</ul> : <EmptyState />}</CardBody></Card>
  );
}
function Overview({ op, title }: { op: 'reporting.employee' | 'reporting.manager'; title: string }) {
  return <OpView op={op} title={title} hide={['employeeId', 'assembledInMs', 'profile']} cols={3} />;
}
function MyDay() {
  const { t } = useTranslation(); const f = useFormat(); const today = useOp<any>('attendance.today', undefined, { retry: false });
  const bal = useOp<any[]>('leave.mine', undefined, { retry: false });
  const a = today.data;
  return (
    <Card className="h-100"><CardHeader><CardTitle>{t('hr.dashboard.myDay')}</CardTitle><StatusBadge value={a?.status} /></CardHeader>
      <CardBody>
        <div className="d-flex gap-2 flex-wrap mb-3"><OpButton op="attendance.checkIn" label={t('hr.dashboard.checkIn')} variant="default" size="md" /><OpButton op="attendance.checkOut" label={t('hr.dashboard.checkOut')} size="md" /></div>
        <div className="text-[13px] text-muted mb-2">{a?.checkIn ? `${f.time(a.checkIn)} → ${f.time(a.checkOut)} · ${Math.floor((a.workedMinutes ?? 0) / 60)}h ${(a.workedMinutes ?? 0) % 60}m` : t('common.noData')}</div>
        <div className="field-label">{t('hr.dashboard.myBalances')}</div>
        <div className="d-flex flex-wrap gap-2">{(bal.data ?? []).map((b) => <span key={b.leaveTypeId} className="rounded-md bg-primary-soft px-2 py-1 text-xs"><strong>{b.leaveTypeName}</strong> {b.available}</span>)}</div>
      </CardBody></Card>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation(); const p = usePermissions(); const user = useAppSelector((s) => s.auth.user);
  const { widgetOrder, widgetHidden } = useUiStore();
  const [f, setF] = useState<Filters>({ month: monthStr(), year: new Date().getFullYear(), dept: '' });
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const deps = useRefList('department');
  const W: Record<string, { el: ReactNode; cls: string; show: boolean }> = {
    kpis: { el: <Kpis f={f} />, cls: 'col-12', show: true },
    headcount: { el: <Headcount f={f} />, cls: 'col-12 col-xl-6', show: p.canCall('reporting.headcount') },
    leaves: { el: <Leaves f={f} />, cls: 'col-12 col-xl-6', show: p.canCall('reporting.leave') },
    attendance: { el: <Attendance f={f} />, cls: 'col-12 col-xl-6', show: p.canCall('reporting.attendance') },
    holidays: { el: <Holidays />, cls: 'col-12 col-xl-6', show: true },
    projects: { el: <Projects />, cls: 'col-12 col-xl-6', show: p.canCall('reporting.allocation') },
    timesheets: { el: <Timesheets f={f} />, cls: 'col-12 col-xl-6', show: p.canCall('reporting.timesheets') },
    performance: { el: <Performance />, cls: 'col-12 col-xl-6', show: p.canCall('reporting.performance') },
    joining: { el: <Joining f={f} />, cls: 'col-12 col-xl-6', show: p.canCall('reporting.joiningExit') },
    mine: { el: <Overview op="reporting.employee" title={t('hr.dashboard.myOverview', { defaultValue: 'My overview' })} />, cls: 'col-12', show: !!user?.employeeId },
    team: { el: <Overview op="reporting.manager" title={t('hr.dashboard.teamOverview', { defaultValue: 'My team' })} />, cls: 'col-12', show: !!user?.employeeId && p.canCall('reporting.manager') },
  };
  const order = [...widgetOrder, ...DEFAULT_WIDGETS.filter((w) => !widgetOrder.includes(w))];
  return (
    <>
      <PageHeader title={t('hr.dashboard.title')} description={t('hr.dashboard.sub')} icon={<LayoutDashboard size={20} />}
        actions={<>
          <Input type="month" className="w-auto" value={f.month} onChange={(e) => e.target.value && setF({ ...f, month: e.target.value, year: Number(e.target.value.slice(0, 4)) })} aria-label={t('hr.dashboard.range')} />
          <NativeSelect className="w-auto" value={f.dept} onChange={(e) => setF({ ...f, dept: e.target.value })} aria-label={t('hr.dashboard.department')}><option value="">{t('common.all')} · {t('common.department')}</option>{(deps.data?.content ?? []).map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}</NativeSelect>
          <Button variant="outline" onClick={(e) => setAnchor(e.currentTarget)}><SlidersHorizontal size={15} />{t('common.customize')}</Button>
        </>} />
      <Customize anchor={anchor} onClose={() => setAnchor(null)} />
      <div className="row g-3">
        {user?.employeeId && !widgetHidden.includes('kpis') && <div className="col-12 col-xl-6"><MyDay /></div>}
        {order.filter((w) => W[w] && W[w].show && !widgetHidden.includes(w)).map((w, i) => (
          <motion.div key={w} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 6) * 0.04 }} className={W[w].cls}>{W[w].el}</motion.div>
        ))}
      </div>
      {widgetHidden.length > 0 && <div className="mt-3 text-xs text-muted"><EyeOff size={12} className="me-1" />{widgetHidden.length} widget(s) hidden — <button className="border-0 bg-transparent p-0 text-primary" onClick={() => useUiStore.getState().resetWidgets()}>{t('common.reset')}</button><Eye size={0} /></div>}
    </>
  );
}
