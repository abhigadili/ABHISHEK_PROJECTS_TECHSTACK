import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Receipt, Check, X, Eye } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Tabs } from '@/components/ui/tabs';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { OpButton } from '@/components/op/OpButton';
import { OpView } from '@/components/op/OpView';
import { OpTable } from '@/components/tables/OpTable';
import { CrudSection } from '@/components/op/CrudSection';
import { EmployeeScope } from '@/components/op/EmployeeScope';
import { DataTable } from '@/components/tables/DataTable';
import { Detail } from '@/components/common/Detail';
import { StatusBadge } from '@/components/common/values';
import { useOp } from '@/components/op/useOp';
import { usePermissions } from '@/hooks/usePermissions';
import { useAppSelector } from '@/store/redux';
import { financialYear, monthStr } from '@/utils/format';
import { SafeHtml } from '@/components/editors/SafeHtml';
import { LoadingBlock } from '@/components/feedback/states';

const DEC = { comment: { rich: true } };
const FY = { financialYear: { help: 'e.g. 2026-27' } };

/** Options for "pick one of my uploaded documents" (proofs reference documents stored by the document service). */
function useDocOptions() {
  const q = useOp<any[]>('document.mine');
  return useMemo(() => (q.data ?? []).map((d) => ({ value: d.id, label: `${d.title ?? d.fileName} (${d.categoryCode ?? ''})` })), [q.data]);
}
function ProofButton({ declId, inv }: { declId: string; inv: any }) {
  const opts = useDocOptions();
  return <OpButton op="tax.addProof" path={{ id: declId, investmentId: inv.id }} label="Add proof" variant="ghost" overrides={{ documentId: { options: opts }, fileName: { help: 'optional' } }} />;
}
function DeclarationDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useOp<any>('tax.get', { path: { id } }); const d = q.data; const { t } = useTranslation(); const p = usePermissions();
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={`Declaration ${d?.financialYear ?? ''}`} size="xl"
      footer={d && <>
        {d.status === 'DRAFT' && <OpButton op="tax.submit" path={{ id }} label={t('common.submit')} variant="default" size="md" />}
        {p.canCall('tax.startReview') && d.status === 'SUBMITTED' && <OpButton op="tax.startReview" path={{ id }} label="Start review" size="md" />}
        {p.canCall('tax.approve') && ['SUBMITTED', 'UNDER_REVIEW'].includes(d.status) && <><OpButton op="tax.approve" path={{ id }} label={t('common.approve')} variant="success" size="md" overrides={DEC} /><OpButton op="tax.reject" path={{ id }} label={t('common.reject')} variant="danger" size="md" overrides={DEC} /></>}</>}>
      {q.isLoading ? <LoadingBlock /> : d && <div className="d-grid gap-3">
        <Detail data={d} hide={['id', 'investments', 'reviewComment']} />
        {d.reviewComment && <div><div className="field-label">Review comment</div><SafeHtml html={d.reviewComment} /></div>}
        <div><div className="field-label">Investments</div>
          <DataTable id="tax-inv" rows={d.investments ?? []} rowActions={(r) => <ProofButton declId={id} inv={r} />} /></div>
        <OpView op="tax.history" path={{ id }} title="History" />
      </div>}
    </Modal>
  );
}
function Mine() {
  const { t } = useTranslation(); const self = useAppSelector((s) => s.auth.user?.employeeId); const [fy, setFy] = useState(financialYear()); const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <Card><CardHeader><CardTitle>Tax declarations</CardTitle><div className="d-flex gap-2"><Input className="w-[110px]" value={fy} onChange={(e) => setFy(e.target.value)} aria-label="financial year" /><OpButton op="tax.save" label="New / update declaration" variant="default" size="md" dialogSize="lg" initial={{ financialYear: fy }} overrides={FY} /></div></CardHeader>
        <CardBody className="p-3"><OpTable op="tax.mine" query={{ financialYear: fy }} tableId="tax-mine" columns={[{ key: 'financialYear' }, { key: 'regime' }, { key: 'status', cell: (r) => <StatusBadge value={r.status} /> }, { key: 'totalDeclared' }, { key: 'totalApproved' }, { key: 'submittedAt' }]} onRowClick={(r) => setOpen(r.id)}
          rowActions={(r) => <Button size="sm" variant="ghost" onClick={() => setOpen(r.id)}><Eye size={13} />{t('common.view')}</Button>} /></CardBody></Card>
      <div className="mt-3 d-grid gap-3">
        <OpView op="tax.statement" query={{ financialYear: fy, employeeId: self }} title="Income-tax statement" />
        <OpView op="tax.compute" query={{ financialYear: fy, employeeId: self }} title="Tax computation" />
        <OpView op="tax.monthlyTds" query={{ month: monthStr(), employeeId: self }} title="Monthly TDS" />
        <CrudSection title="Income-tax documents" list={{ op: 'tax.documents', query: { financialYear: fy, employeeId: self } }} />
      </div>
      {open && <DeclarationDetail id={open} onClose={() => setOpen(null)} />}
    </>
  );
}
function Review() {
  const { t } = useTranslation(); const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="d-grid gap-3">
      <Card><CardHeader><CardTitle>Declarations awaiting review</CardTitle></CardHeader><CardBody className="p-3"><OpTable op="tax.pending" tableId="tax-pending" onRowClick={(r) => setOpen(r.id)} /></CardBody></Card>
      <Card><CardHeader><CardTitle>Proofs awaiting verification</CardTitle></CardHeader><CardBody className="p-3">
        <OpTable op="tax.proofsPending" tableId="tax-proofs" rowActions={(r) => <><OpButton op="tax.verify" path={{ proofId: r.id }} label="Verify" icon={<Check size={13} />} variant="success" /><OpButton op="tax.rejectProof" path={{ proofId: r.id }} label={t('common.reject')} icon={<X size={13} />} variant="danger" overrides={DEC} /></>} /></CardBody></Card>
      {open && <DeclarationDetail id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
function TaxAdmin() {
  const [fy, setFy] = useState(financialYear());
  return (
    <div className="d-grid gap-3">
      <div className="d-flex gap-2 align-items-center"><Input className="w-[110px]" value={fy} onChange={(e) => setFy(e.target.value)} aria-label="financial year" /><OpButton op="tax.reminders" label="Send proof reminders" size="md" /></div>
      <OpView op="tax.status" query={{ financialYear: fy }} title="Declaration status summary" />
      <CrudSection title="Tax rules & slabs" list={{ op: 'tax.rules', query: { financialYear: fy } }} create={{ op: 'tax.createRule', initial: { financialYear: fy } }} update={{ op: 'tax.updateRule', path: (r) => ({ id: r.id }) }} dialogSize="xl" />
      <Card><CardHeader><CardTitle>Issue income-tax document</CardTitle><OpButton op="tax.addDocument" label="Add document" variant="default" size="md" initial={{ financialYear: fy }} /></CardHeader>
        <CardBody><EmployeeScope>{(id) => <OpView op="tax.documents" query={{ employeeId: id, financialYear: fy }} title="Documents" />}</EmployeeScope></CardBody></Card>
    </div>
  );
}
export default function TaxPage() {
  const { t } = useTranslation(); const p = usePermissions(); const self = useAppSelector((s) => s.auth.user?.employeeId);
  return (
    <>
      <PageHeader title={t('hr.tax.title')} description={t('hr.tax.sub')} icon={<Receipt size={20} />} />
      <Tabs tabs={[
        { key: 'mine', label: t('nav.myWorkspace'), hidden: !self, content: <Mine /> },
        { key: 'review', label: 'Review', hidden: !p.canCall('tax.pending'), content: <Review /> },
        { key: 'admin', label: t('hr.leave.admin'), hidden: !p.canAny('tax.rules', 'tax.status'), content: <TaxAdmin /> },
        { key: 'lookup', label: 'Employee tax', hidden: !p.canCall('tax.compute') || !p.isAdmin, content: <EmployeeScope>{(id) => <div className="d-grid gap-3"><OpView op="tax.statement" query={{ employeeId: id, financialYear: financialYear() }} title="Statement" /><OpView op="tax.compute" query={{ employeeId: id, financialYear: financialYear() }} title="Computation" /><OpView op="tax.monthlyTds" query={{ employeeId: id, month: monthStr() }} title="Monthly TDS" /></div>}</EmployeeScope> },
      ]} />
    </>
  );
}
