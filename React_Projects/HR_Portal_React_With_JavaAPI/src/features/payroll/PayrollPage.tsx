import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Wallet, Check, X, Play, Lock } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Tabs } from '@/components/ui/tabs';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, NativeSelect } from '@/components/ui/input';
import { OpButton } from '@/components/op/OpButton';
import { OpView } from '@/components/op/OpView';
import { OpTable } from '@/components/tables/OpTable';
import { CrudSection } from '@/components/op/CrudSection';
import { DownloadButton } from '@/components/op/DownloadButton';
import { EmployeeScope } from '@/components/op/EmployeeScope';
import { StatusBadge } from '@/components/common/values';
import { Modal } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChartCard, BarSeries, DonutSeries } from '@/components/charts/charts';
import { useOp } from '@/components/op/useOp';
import { usePermissions } from '@/hooks/usePermissions';
import { useAppSelector } from '@/store/redux';
import { monthStr } from '@/utils/format';
import { useFormat } from '@/contexts/LanguageContext';
import { EmployeeName } from '@/components/op/employees';

const DEC = { comment: { rich: true } };

function Payslips({ employeeId }: { employeeId?: string }) {
  const { t } = useTranslation(); const f = useFormat();
  const op = employeeId ? 'payroll.payslipsOf' : 'payroll.myPayslips';
  const q = useOp<any[]>(op, employeeId ? { path: { employeeId } } : undefined);
  const [open, setOpen] = useState<any>(null);
  return (
    <>
      <Card><CardHeader><CardTitle>Payslips</CardTitle></CardHeader><CardBody className="p-3">
        <OpTable op={op} path={employeeId ? { employeeId } : undefined} tableId={`payslips-${employeeId ?? 'me'}`} onRowClick={setOpen}
          rowActions={(r) => <><DownloadButton op="payroll.download" path={{ id: r.id }} filename={`payslip-${r.payrollMonth ?? r.month ?? r.id}.pdf`} /><DownloadButton op="payroll.download" path={{ id: r.id }} filename="payslip.pdf" print /></>} /></CardBody></Card>
      <Modal open={!!open} onOpenChange={(o) => !o && setOpen(null)} title={`Payslip ${open?.payrollMonth ?? ''}`} size="lg"
        footer={open && <><DownloadButton op="payroll.download" path={{ id: open.id }} filename={`payslip-${open.payrollMonth}.pdf`} variant="outline" /><DownloadButton op="payroll.download" path={{ id: open.id }} filename="payslip.pdf" print variant="outline" /></>}>
        {open && <><div className="mb-2 text-muted" style={{ fontSize: 12 }}>{f.date(open.generatedAt ?? open.createdAt)}</div><PayslipBreakdown p={open} /></>}
      </Modal>
      <span hidden>{q.data?.length}</span>
    </>
  );
}
function PayslipBreakdown({ p }: { p: any }) {
  const f = useFormat();
  const lines: any[] = p.lines ?? p.components ?? p.items ?? [];
  const earn = lines.filter((l) => (l.type ?? l.kind) === 'EARNING'); const ded = lines.filter((l) => (l.type ?? l.kind) === 'DEDUCTION');
  const col = (title: string, rows: any[]) => <div className="col-md-6"><div className="field-label">{title}</div>{rows.map((l, i) => <div key={i} className="d-flex justify-content-between border-bottom py-1" style={{ fontSize: 13, borderColor: 'var(--hr-border)' }}><span>{l.name ?? l.componentName ?? l.code}</span><span>{f.money(l.amount)}</span></div>)}</div>;
  return (
    <div>
      <div className="row g-3 mb-3">{[['Gross', p.gross ?? p.grossPay ?? p.totalGross], ['Deductions', p.totalDeductions ?? p.deductions], ['Net pay', p.net ?? p.netPay ?? p.totalNet]].map(([l, v]: any) => <div key={l} className="col-4"><div className="rounded-lg bg-surface-2 p-2 text-center"><div className="text-muted" style={{ fontSize: 11 }}>{l}</div><div className="fw-bold">{f.money(v)}</div></div></div>)}</div>
      {lines.length ? <div className="row g-3">{col('Earnings', earn)}{col('Deductions', ded)}</div> : <div className="text-muted" style={{ fontSize: 12 }}>Salary breakdown is in the downloadable PDF.</div>}
    </div>
  );
}
function Salary({ employeeId }: { employeeId: string }) {
  const path = { employeeId };
  return (
    <div className="d-grid gap-3">
      <OpView op="payroll.summary" path={path} title="Salary summary" />
      <OpView op="payroll.salary" path={path} title="Current salary structure" actions={<><OpButton op="payroll.assign" path={path} label="Assign salary" dialogSize="lg" /><OpButton op="payroll.propose" path={path} label="Propose revision" dialogSize="lg" /></>} />
      <OpView op="payroll.salaryHistory" path={path} title="Salary history" />
    </div>
  );
}
function Runs() {
  const { t } = useTranslation(); const [sel, setSel] = useState<any>(null); const [entry, setEntry] = useState<string | null>(null);
  return (
    <>
      <CrudSection title="Payroll runs" list={{ op: 'payroll.list' }} create={{ op: 'payroll.create' }} tableId="pay-runs" remove={{ op: 'payroll.delete', path: (r) => ({ id: r.id }) }}
        columns={[{ key: 'payrollMonth', sortable: false }, { key: 'status', cell: (r) => <StatusBadge value={r.status} /> }, { key: 'employeeCount' }, { key: 'totalGross' }, { key: 'totalDeductions' }, { key: 'totalNet' }, { key: 'processedBy', defaultHidden: true }, { key: 'approvedBy', defaultHidden: true }, { key: 'finalizedAt', defaultHidden: true }]}
        view={{ op: 'payroll.get', path: (r) => ({ id: r.id }) }}
        extraRowActions={(r) => <>
          <Button size="sm" variant="ghost" onClick={() => setSel(r)}>Entries</Button>
          {r.status === 'DRAFT' && <OpButton op="payroll.process" path={{ id: r.id }} icon={<Play size={13} />} label="Process" variant="outline" />}
          {r.status === 'PROCESSED' && <><OpButton op="payroll.approve" path={{ id: r.id }} icon={<Check size={13} />} label={t('common.approve')} variant="success" /></>}
          {r.status === 'APPROVED' && <OpButton op="payroll.finalizeRun" path={{ id: r.id }} icon={<Lock size={13} />} label="Finalize" variant="outline" />}
          {r.status !== 'DRAFT' && <OpButton op="payroll.regenerate" path={{ id: r.id }} label="Payslips" variant="ghost" />}
        </>} />
      <Modal open={!!sel} onOpenChange={(o) => !o && setSel(null)} title={`Entries · ${sel?.payrollMonth}`} size="xl">{sel && <OpTable op="payroll.entries" path={{ id: sel.id }} tableId="pay-entries" onRowClick={(r) => setEntry(r.id)} />}</Modal>
      <Modal open={!!entry} onOpenChange={(o) => !o && setEntry(null)} title="Payroll entry" size="lg">{entry && <OpView op="payroll.entry" path={{ entryId: entry }} bare />}</Modal>
    </>
  );
}
function Setup() {
  return (
    <div className="d-grid gap-3">
      <CrudSection title="Salary components" list={{ op: 'payroll.components' }} create={{ op: 'payroll.createComponent' }} update={{ op: 'payroll.updateComponent', path: (r) => ({ id: r.id }) }} dialogSize="lg" />
      <CrudSection title="Salary structures" list={{ op: 'payroll.structures' }} create={{ op: 'payroll.createStructure' }} update={{ op: 'payroll.updateStructure', path: (r) => ({ id: r.id }) }} remove={{ op: 'payroll.deleteStructure', path: (r) => ({ id: r.id }) }} view={{ op: 'payroll.structure', path: (r) => ({ id: r.id }) }} dialogSize="xl" />
      <CrudSection title="Statutory & payroll configuration" list={{ op: 'payroll.config' }} columns={[{ key: 'key' }, { key: 'value' }, { key: 'description' }, { key: 'effectiveFrom' }]} update={{ op: 'payroll.updateConfig', path: (r) => ({ key: r.key }), initial: (r) => ({ value: r.value, description: r.description }) }} />
    </div>
  );
}
function Revisions() {
  const { t } = useTranslation(); const [status, setStatus] = useState('');
  return (
    <Card><CardHeader><CardTitle>Salary revisions</CardTitle><NativeSelect className="w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t('common.status')}><option value="">{t('common.all')}</option>{['PENDING', 'APPROVED', 'REJECTED'].map((s) => <option key={s}>{s}</option>)}</NativeSelect></CardHeader>
      <CardBody className="p-3"><OpTable op="payroll.revisions" query={{ status }} tableId="pay-rev" rowActions={(r) => <><OpButton op="payroll.approveRevision" path={{ id: r.id }} label={t('common.approve')} icon={<Check size={13} />} variant="success" overrides={DEC} /><OpButton op="payroll.rejectRevision" path={{ id: r.id }} label={t('common.reject')} icon={<X size={13} />} variant="danger" overrides={DEC} /></>} /></CardBody></Card>
  );
}
function Adjustments() {
  const [month, setMonth] = useState(monthStr());
  return (
    <CrudSection title={`Adjustments · ${month}`} list={{ op: 'payroll.adjustments', query: { month } }} create={{ op: 'payroll.addAdjustment', initial: { month } }} remove={{ op: 'payroll.cancelAdjustment', path: (r) => ({ id: r.id }) }}
      actions={<Input type="month" className="w-auto" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />} />
  );
}
function PayReports() {
  const [month, setMonth] = useState(monthStr());
  const dep = useOp<any[]>('payroll.departments', { query: { month } }); const comp = useOp<any[]>('payroll.componentsPayrollProcessing', { query: { month } });
  const dd = (dep.data ?? []).map((d) => ({ name: d.departmentName ?? d.department ?? d.departmentId, net: Number(d.net ?? d.totalNet ?? 0), gross: Number(d.gross ?? d.totalGross ?? 0) }));
  const cc = (comp.data ?? []).map((c) => ({ name: c.componentName ?? c.name ?? c.code, value: Number(c.total ?? c.amount ?? 0) })).filter((c) => c.value);
  return (
    <div className="d-grid gap-3">
      <Input type="month" className="w-auto" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
      <OpView op="payroll.monthly" query={{ month }} title={`Monthly report · ${month}`} />
      <div className="row g-3"><div className="col-lg-6"><ChartCard title="Department totals" loading={dep.isLoading} error={dep.error} empty={!dd.length}><BarSeries data={dd} x="name" keys={[{ key: 'gross', label: 'Gross' }, { key: 'net', label: 'Net' }]} /></ChartCard></div>
        <div className="col-lg-6"><ChartCard title="Component totals" loading={comp.isLoading} error={comp.error} empty={!cc.length}><DonutSeries data={cc} /></ChartCard></div></div>
      <OpView op="payroll.departments" query={{ month }} title="Departments" /><OpView op="payroll.componentsPayrollProcessing" query={{ month }} title="Components" />
    </div>
  );
}
export default function PayrollPage() {
  const { t } = useTranslation(); const p = usePermissions(); const self = useAppSelector((s) => s.auth.user?.employeeId);
  const staff = p.canCall('payroll.list'); void EmployeeName;
  return (
    <>
      <PageHeader title={t('hr.payroll.title')} description={t('hr.payroll.sub')} icon={<Wallet size={20} />} />
      <Tabs tabs={[
        { key: 'payslips', label: 'My payslips', hidden: !self, content: <Payslips /> },
        { key: 'salary', label: 'My salary', hidden: !self, content: self ? <Salary employeeId={self} /> : null },
        { key: 'runs', label: 'Payroll runs', hidden: !staff, content: <Runs /> },
        { key: 'employee', label: 'Employee payroll', hidden: !p.canCall('payroll.payslipsOf'), content: <EmployeeScope>{(id) => <div className="d-grid gap-3"><Salary employeeId={id} /><Payslips employeeId={id} /><OpView op="payroll.loans" path={{ employeeId: id }} title="Loans" actions={<OpButton op="payroll.addLoan" initial={{ employeeId: id }} label="Add loan" />} /></div>}</EmployeeScope> },
        { key: 'revisions', label: 'Revisions', hidden: !p.canCall('payroll.revisions'), content: <Revisions /> },
        { key: 'adjust', label: 'Adjustments', hidden: !staff, content: <Adjustments /> },
        { key: 'setup', label: t('common.settings'), hidden: !p.canCall('payroll.components'), content: <Setup /> },
        { key: 'reports', label: t('nav.reports'), hidden: !staff, content: <PayReports /> },
      ]} />
    </>
  );
}
