import { useParams } from 'react-router-dom';
import { useUi } from '@/hooks/useUi';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@mui/material';
import { ArrowRightLeft, Pencil, UserCog, UserMinus } from 'lucide-react';
import { OpView } from '@/components/op/OpView';
import { OpButton } from '@/components/op/OpButton';
import { CrudSection } from '@/components/op/CrudSection';
import { OpTable } from '@/components/tables/OpTable';
import { EmployeeName } from '@/components/op/employees';
import { Tabs } from '@/components/ui/tabs';
import { Card, CardBody } from '@/components/ui/card';
import { StatusBadge } from '@/components/common/values';
import { Detail } from '@/components/common/Detail';
import { useOp } from '@/components/op/useOp';
import { useRefNames } from '@/components/op/refs';
import { usePermissions } from '@/hooks/usePermissions';
import { ErrorState, LoadingBlock } from '@/components/feedback/states';
import { initials, monthStr, financialYear, isoDate } from '@/utils/format';
import { useAppSelector } from '@/store/redux';
import dayjs from 'dayjs';

const Sub = ({ title, children }: { title: string; children: React.ReactNode }) => { const ui = useUi(); return <div className="mb-4"><div className="field-label">{ui(title)}</div>{children}</div>; };

export default function EmployeeProfilePage() {
  const { id = '' } = useParams(); const { t } = useTranslation(); const p = usePermissions(); const self = useAppSelector((s) => s.auth.user?.employeeId);
  const q = useOp<any>('employee.get', { path: { id } });
  const dep = useRefNames('department'); const des = useRefNames('designation'); const loc = useRefNames('location');
  if (q.isLoading) return <LoadingBlock rows={6} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const e = q.data; const path = { employeeId: id }; const isSelf = self === id; const month = monthStr();
  const T = (k: string) => t(`hr.employees.tabs.${k}`);
  const range = { from: dayjs().startOf('month').format('YYYY-MM-DD'), to: isoDate() };
  const admin = p.isAdmin;
  const tabs = [
    { key: 'overview', label: T('overview'), content: (
      <div className="row g-3"><div className="col-12"><Card><CardBody><Detail data={e} hide={['id', 'version', 'contact', 'fullName', 'departmentId', 'designationId', 'locationId', 'managerId']} /></CardBody></Card></div>
        {e.contact && <div className="col-12"><Card><CardBody><div className="field-label">Contact</div><Detail data={e.contact} cols={3} /></CardBody></Card></div>}
        <div className="col-12"><OpView op="employee.summary" path={{ id }} title="Summary" /></div></div>) },
    { key: 'job', label: T('job'), content: (<>
      <Sub title="Employment history"><OpView op="employee.employmentHistory" path={path} bare /></Sub>
      <Sub title="Status history"><OpView op="employee.statusHistory" path={path} bare /></Sub>
      <Sub title="Reporting chain"><OpView op="organization.chain" path={path} bare /></Sub></>) },
    { key: 'contact', label: T('contact'), content: (<div className="d-grid gap-3">
      <CrudSection title="Addresses" list={{ op: 'employee.addresses', path }} create={{ op: 'employee.addAddress', path }} update={{ op: 'employee.updateAddress', path: (r) => ({ employeeId: id, id: r.id }) }} remove={{ op: 'employee.deleteAddress', path: (r) => ({ employeeId: id, id: r.id }) }} />
      <CrudSection title="Emergency contacts" list={{ op: 'employee.contacts', path }} create={{ op: 'employee.addContact', path }} update={{ op: 'employee.updateContact', path: (r) => ({ employeeId: id, id: r.id }) }} remove={{ op: 'employee.deleteContact', path: (r) => ({ employeeId: id, id: r.id }) }} /></div>) },
    { key: 'education', label: T('education'), content: (<div className="d-grid gap-3">
      <CrudSection title="Education" list={{ op: 'employee.education', path }} create={{ op: 'employee.addEducation', path }} update={{ op: 'employee.updateEducation', path: (r) => ({ employeeId: id, id: r.id }) }} remove={{ op: 'employee.deleteEducation', path: (r) => ({ employeeId: id, id: r.id }) }} />
      <CrudSection title="Experience" list={{ op: 'employee.experience', path }} create={{ op: 'employee.addExperience', path }} update={{ op: 'employee.updateExperience', path: (r) => ({ employeeId: id, id: r.id }) }} remove={{ op: 'employee.deleteExperience', path: (r) => ({ employeeId: id, id: r.id }) }} /></div>) },
    { key: 'bank', label: T('bank'), hidden: !(admin || isSelf || p.hasRole('PAYROLL_ADMIN', 'FINANCE_ADMIN')), content: (
      <OpView op="employee.bank" path={path} actions={<OpButton op="employee.saveBank" path={path} label={t('common.edit')} icon={<Pencil size={13} />} />} />) },
    { key: 'team', label: T('team'), content: (<>
      <Sub title="Direct reports"><OpView op="employee.team" path={{ id }} bare /></Sub>
      <Sub title="All subordinates"><OpView op="organization.subordinates" path={path} query={{ depth: 3 }} bare /></Sub></>) },
    { key: 'leave', label: T('leave'), content: (<>
      <Sub title="Balances"><OpView op="leave.of" path={path} query={{ year: new Date().getFullYear() }} bare /></Sub>
      <Sub title="Balance reconciliation"><OpView op="leave.reconcile" path={path} query={{ year: new Date().getFullYear() }} bare /></Sub>
      <Sub title="Balance history"><OpView op="leave.history" path={path} query={{ year: new Date().getFullYear() }} bare /></Sub>
      <Sub title="Applications"><OpTable op="leave.forEmployee" path={path} tableId="emp-leave" /></Sub></>) },
    { key: 'attendance', label: T('attendance'), content: (<>
      <Sub title={`Monthly summary · ${month}`}><OpView op="attendance.monthlySummary" path={path} query={{ month }} bare /></Sub>
      <Sub title="Attendance this month"><OpView op="attendance.of" path={path} query={range} bare /></Sub>
      <Sub title="Calendar"><OpView op="attendance.calendarOf" path={path} query={{ month }} bare /></Sub>
      <Sub title="Shift assignments"><OpView op="attendance.assignments" path={path} bare /></Sub></>) },
    { key: 'timesheets', label: T('timesheets'), content: (<>
      <Sub title="Timesheets"><OpTable op="timesheet.forEmployee" path={path} tableId="emp-ts" /></Sub>
      <Sub title="Hours summary"><OpView op="timesheet.employee" path={path} bare /></Sub></>) },
    { key: 'projects', label: T('projects'), content: (<>
      <Sub title="Projects"><OpView op="project.employeeProjects" path={path} bare /></Sub>
      <Sub title="Allocation summary"><OpView op="project.allocationSummary" path={path} bare /></Sub></>) },
    { key: 'documents', label: T('documents'), content: <OpView op="document.forEmployee" path={path} title={T('documents')} /> },
    { key: 'payroll', label: T('payroll'), hidden: !p.canAny('payroll.payslipsOf') && !isSelf, content: (<>
      <Sub title="Salary summary"><OpView op="payroll.summary" path={path} bare /></Sub>
      <Sub title="Current salary"><OpView op="payroll.salary" path={path} bare /></Sub>
      <Sub title="Salary history"><OpView op="payroll.salaryHistory" path={path} bare /></Sub>
      <Sub title="Payslips"><OpView op="payroll.payslipsOf" path={path} bare /></Sub>
      <CrudSection title="Loans" list={{ op: 'payroll.loans', path }} create={{ op: 'payroll.addLoan', initial: { employeeId: id } }} extraRowActions={(r) => <OpButton op="payroll.closeLoan" path={{ id: r.id }} label="Close" variant="ghost" />} /></>) },
    { key: 'performance', label: T('performance'), content: (<>
      <Sub title="Reviews"><OpView op="performance.history" path={path} bare /></Sub>
      <Sub title="Goals"><OpView op="performance.goalsOf" path={path} bare /></Sub>
      <Sub title="Feedback"><OpView op="performance.about" path={path} bare /></Sub></>) },
    { key: 'tax', label: T('tax'), hidden: !(admin || p.hasRole('FINANCE_ADMIN') || isSelf), content: (<>
      <Sub title="Income-tax statement"><OpView op="tax.statement" query={{ employeeId: id, financialYear: financialYear() }} bare /></Sub>
      <Sub title="Tax computation"><OpView op="tax.compute" query={{ employeeId: id, financialYear: financialYear() }} bare /></Sub>
      <Sub title="Monthly TDS"><OpView op="tax.monthlyTds" query={{ employeeId: id, month }} bare /></Sub>
      <Sub title="Tax documents"><OpView op="tax.documents" query={{ employeeId: id }} bare /></Sub></>) },
    { key: 'audit', label: T('audit'), hidden: !admin, content: (<>
      <Sub title="Profile changes"><OpView op="employee.profileHistory" path={path} bare /></Sub>
      <Sub title="Audit"><OpTable op="employee.searchAudit" query={{ entityId: id }} tableId="emp-audit" /></Sub></>) },
  ];
  return (
    <>
      <Card className="mb-3"><CardBody className="d-flex flex-wrap align-items-center gap-3">
        <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main' }}>{initials(e.fullName)}</Avatar>
        <div className="flex-grow-1"><h1 className="page-title">{e.fullName}</h1>
          <div className="text-muted" style={{ fontSize: 13 }}>{e.employeeCode} · {des(e.designationId)} · {dep(e.departmentId)} · {loc(e.locationId)}</div>
          <div className="mt-1 d-flex align-items-center gap-2"><StatusBadge value={e.status} /><span className="text-muted" style={{ fontSize: 12 }}>{t('common.manager')}: <EmployeeName id={e.managerId} /></span></div></div>
        <div className="d-flex flex-wrap gap-2">
          <OpButton op="employee.update" path={{ id }} initial={e} label={t('common.edit')} icon={<Pencil size={13} />} dialogSize="lg" overrides={{ status: { hidden: true } }} />
          <OpButton op="employee.transfer" path={{ id }} label="Transfer" icon={<ArrowRightLeft size={13} />} />
          <OpButton op="employee.manager" path={{ id }} label={t('common.manager')} icon={<UserCog size={13} />} />
          <OpButton op="employee.status" path={{ id }} label={t('common.status')} icon={<UserMinus size={13} />} />
          {isSelf && <OpButton op="employee.updateMyContact" label="My contact" initial={e.contact} />}
        </div>
      </CardBody></Card>
      <Tabs tabs={tabs} />
    </>
  );
}
