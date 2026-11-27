import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCheck, Check, X } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { OpButton } from '@/components/op/OpButton';
import { OpTable } from '@/components/tables/OpTable';
import { StatusBadge } from '@/components/common/values';
import { useOp } from '@/components/op/useOp';
import { usePermissions } from '@/hooks/usePermissions';
import { EmptyState } from '@/components/feedback/states';
import { cn } from '@/utils/cn';

const DEC = { comment: { rich: true } };
const DEC2 = { reason: { textarea: true } };
interface Src { key: string; label: string; op: string; query?: Record<string, unknown>; cols: any[]; actions: (r: any) => ReactNode }
const approve = (op: string, ov = DEC) => (r: any, p: any = { id: r.id }) => <><OpButton op={op} path={p} label="Approve" icon={<Check size={13} />} variant="success" overrides={ov} /></>;
void approve;
const S = (op: string, path: (r: any) => any, ov = DEC) => <T,>(r: T) => <OpButton op={op} path={path(r)} label="Approve" icon={<Check size={13} />} variant="success" overrides={ov} />;
void S;
const SOURCES: Src[] = [
  { key: 'leave', label: 'Leave', op: 'leave.pending', cols: [{ key: 'employeeName' }, { key: 'leaveTypeName' }, { key: 'fromDate' }, { key: 'toDate' }, { key: 'days' }, { key: 'status', cell: (r: any) => <StatusBadge value={r.status} /> }],
    actions: (r) => <><OpButton op="leave.approve" path={{ id: r.id }} label="Approve" icon={<Check size={13} />} variant="success" overrides={DEC} /><OpButton op="leave.reject" path={{ id: r.id }} label="Reject" icon={<X size={13} />} variant="danger" overrides={DEC} /></> },
  { key: 'leaveCancel', label: 'Leave cancellations', op: 'leave.cancellationRequests', cols: [{ key: 'employeeName' }, { key: 'leaveTypeName' }, { key: 'fromDate' }, { key: 'toDate' }, { key: 'cancelReason' }],
    actions: (r) => <><OpButton op="leave.approveCancellation" path={{ id: r.id }} label="Approve" variant="success" overrides={DEC} /><OpButton op="leave.rejectCancellation" path={{ id: r.id }} label="Reject" variant="danger" overrides={DEC} /></> },
  { key: 'timesheet', label: 'Timesheets', op: 'timesheet.pending', cols: [{ key: 'employeeName' }, { key: 'weekStart' }, { key: 'totalHours' }, { key: 'billableHours' }],
    actions: (r) => <><OpButton op="timesheet.approve" path={{ id: r.id }} label="Approve" variant="success" overrides={DEC} icon={<Check size={13} />} /><OpButton op="timesheet.reject" path={{ id: r.id }} label="Reject" variant="danger" overrides={DEC} icon={<X size={13} />} /></> },
  { key: 'correction', label: 'Attendance corrections', op: 'attendance.pendingCorrections', cols: [{ key: 'employeeId' }, { key: 'workDate' }, { key: 'requestedCheckIn' }, { key: 'requestedCheckOut' }, { key: 'reason' }],
    actions: (r) => <><OpButton op="attendance.approveCorrection" path={{ id: r.id }} label="Approve" variant="success" overrides={DEC} /><OpButton op="attendance.rejectCorrection" path={{ id: r.id }} label="Reject" variant="danger" overrides={DEC} /></> },
  { key: 'wfh', label: 'Work from home', op: 'attendance.pendingWfh', cols: [{ key: 'employeeId' }, { key: 'fromDate' }, { key: 'toDate' }, { key: 'reason' }],
    actions: (r) => <><OpButton op="attendance.approveWfh" path={{ id: r.id }} label="Approve" variant="success" overrides={DEC} /><OpButton op="attendance.rejectWfh" path={{ id: r.id }} label="Reject" variant="danger" overrides={DEC} /></> },
  { key: 'review', label: 'Performance reviews', op: 'performance.pending', cols: [{ key: 'employeeName' }, { key: 'cycleId' }, { key: 'status', cell: (r: any) => <StatusBadge value={r.status} /> }],
    actions: (r) => <><OpButton op="performance.approve" path={{ id: r.id }} label="Approve" variant="success" overrides={DEC} /><OpButton op="performance.returnReview" path={{ id: r.id }} label="Return" variant="outline" overrides={DEC} /></> },
  { key: 'revision', label: 'Salary revisions', op: 'payroll.revisions', query: { status: 'PENDING' }, cols: [{ key: 'employeeId' }, { key: 'effectiveFrom' }, { key: 'newCtc' }, { key: 'status', cell: (r: any) => <StatusBadge value={r.status} /> }],
    actions: (r) => <><OpButton op="payroll.approveRevision" path={{ id: r.id }} label="Approve" variant="success" overrides={DEC} /><OpButton op="payroll.rejectRevision" path={{ id: r.id }} label="Reject" variant="danger" overrides={DEC} /></> },
  { key: 'tax', label: 'Tax declarations', op: 'tax.pending', cols: [{ key: 'employeeName' }, { key: 'financialYear' }, { key: 'regime' }, { key: 'totalDeclared' }, { key: 'status', cell: (r: any) => <StatusBadge value={r.status} /> }],
    actions: (r) => <><OpButton op="tax.approve" path={{ id: r.id }} label="Approve" variant="success" overrides={DEC} /><OpButton op="tax.reject" path={{ id: r.id }} label="Reject" variant="danger" overrides={DEC} /></> },
  { key: 'proof', label: 'Tax proofs', op: 'tax.proofsPending', cols: [{ key: 'fileName' }, { key: 'status', cell: (r: any) => <StatusBadge value={r.status} /> }],
    actions: (r) => <><OpButton op="tax.verify" path={{ proofId: r.id }} label="Verify" variant="success" /><OpButton op="tax.rejectProof" path={{ proofId: r.id }} label="Reject" variant="danger" overrides={DEC} /></> },
  { key: 'exit', label: 'Resignations', op: 'exit.pending', cols: [{ key: 'employeeName' }, { key: 'requestedLastWorkingDay' }, { key: 'reason' }],
    actions: (r) => <OpButton op="exit.managerDecision" path={{ id: r.id }} label="Decide" variant="outline" overrides={DEC} /> },
  { key: 'document', label: 'Documents', op: 'document.pending', cols: [{ key: 'title' }, { key: 'categoryCode' }, { key: 'ownerEmployeeId' }],
    actions: (r) => <><OpButton op="document.verify" path={{ id: r.id }} label="Verify" variant="success" /><OpButton op="document.reject" path={{ id: r.id }} label="Reject" variant="danger" overrides={DEC2} /></> },
];
function Count({ s }: { s: Src }) {
  const { canCall } = usePermissions(); const q = useOp<any>(s.op, { query: s.query }, { enabled: canCall(s.op), refetchInterval: 60_000 });
  const n = Array.isArray(q.data) ? q.data.length : q.data?.totalElements ?? 0;
  return <Badge tone={n ? 'warning' : 'neutral'}>{n}</Badge>;
}
/** Approval center: one inbox for every approval workflow discovered in the backend (leave, timesheets, attendance, reviews, payroll revisions, tax, exits, documents). */
export default function ApprovalsPage() {
  const { t } = useTranslation(); const { canCall } = usePermissions();
  const avail = SOURCES.filter((s) => canCall(s.op)); const [sel, setSel] = useState(avail[0]?.key);
  const cur = avail.find((s) => s.key === sel) ?? avail[0];
  return (
    <>
      <PageHeader title={t('hr.approvals.title')} description={t('hr.approvals.sub')} icon={<CheckCheck size={20} />} />
      {!avail.length ? <Card><CardBody><EmptyState /></CardBody></Card> : (
        <div className="row g-3">
          <div className="col-12 col-lg-3"><Card><CardBody className="p-2">{avail.map((s) => (
            <button key={s.key} onClick={() => setSel(s.key)} className={cn('mb-1 flex w-full items-center justify-between rounded-md border-0 px-3 py-2 text-left text-[13px]', cur?.key === s.key ? 'bg-primary-soft text-primary fw-semibold' : 'bg-transparent hover:bg-surface-2')}>{s.label}<Count s={s} /></button>))}</CardBody></Card></div>
          <div className="col-12 col-lg-9">{cur && <Card><CardHeader><CardTitle>{cur.label}</CardTitle></CardHeader><CardBody className="p-3"><OpTable key={cur.key} op={cur.op} query={cur.query} tableId={`appr-${cur.key}`} columns={cur.cols} rowActions={cur.actions} /></CardBody></Card>}</div>
        </div>)}
    </>
  );
}
