import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Upload, Check, X } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Tabs } from '@/components/ui/tabs';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Modal } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { OpButton } from '@/components/op/OpButton';
import { OpView } from '@/components/op/OpView';
import { OpTable } from '@/components/tables/OpTable';
import { CrudSection } from '@/components/op/CrudSection';
import { DownloadButton } from '@/components/op/DownloadButton';
import { EmployeeScope } from '@/components/op/EmployeeScope';
import { Detail } from '@/components/common/Detail';
import { StatusBadge } from '@/components/common/values';
import { useOp } from '@/components/op/useOp';
import { usePermissions } from '@/hooks/usePermissions';
import { LoadingBlock } from '@/components/feedback/states';

const fmtSize = (b?: number) => (b == null ? '—' : b > 1_048_576 ? `${(b / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const DEC = { reason: { textarea: true } };
const COLS = [{ key: 'title' }, { key: 'categoryCode' }, { key: 'fileName', defaultHidden: true }, { key: 'sizeBytes', cell: (r: any) => fmtSize(r.sizeBytes) }, { key: 'status', cell: (r: any) => <StatusBadge value={r.status} /> }, { key: 'expiryDate' }, { key: 'versionNumber', defaultHidden: true }, { key: 'createdAt', defaultHidden: true }];

function useUploadOptions() {
  const c = useOp<any[]>('document.categories');
  return { categoryCode: { options: (c.data ?? []).filter((x) => x.active !== false).map((x) => ({ value: x.code, label: x.name })) } };
}
function UploadButton({ ownerEmployeeId }: { ownerEmployeeId?: string }) {
  const { t } = useTranslation(); const qo = useUploadOptions();
  return <OpButton op="document.upload" label={t('common.upload')} icon={<Upload size={14} />} variant="default" size="md" query={ownerEmployeeId ? { ownerEmployeeId } : undefined} queryOverrides={qo} />;
}
function DocDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useOp<any>('document.get', { path: { id } }); const d = q.data; const p = usePermissions();
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={d?.title ?? 'Document'} size="xl"
      footer={d && <><DownloadButton op="document.download" path={{ id }} filename={d.fileName ?? 'document'} variant="outline" size="md" />
        {p.canCall('document.verify') && d.status === 'UPLOADED' && <><OpButton op="document.verify" path={{ id }} label="Verify" variant="success" size="md" /><OpButton op="document.reject" path={{ id }} label="Reject" variant="danger" size="md" overrides={DEC} /></>}
        {p.canCall('document.approve') && d.status === 'VERIFIED' && <OpButton op="document.approve" path={{ id }} label="Approve" variant="success" size="md" />}</>}>
      {q.isLoading ? <LoadingBlock /> : d && <div className="d-grid gap-3">
        <Detail data={d} hide={['id', 'sha256']} />
        <OpView op="document.versions" path={{ id }} title="Versions" /><OpView op="document.history" path={{ id }} title="Access & change history" />
        <CrudSection title="Access permissions" list={{ op: 'document.permissions', path: { id } }} create={{ op: 'document.grant', path: { id } }} remove={{ op: 'document.revoke', path: (r) => ({ id, permissionId: r.id }) }} />
      </div>}
    </Modal>
  );
}
function Mine() {
  const [open, setOpen] = useState<string | null>(null);
  return (<>
    <Card><CardHeader><CardTitle>My documents</CardTitle><UploadButton /></CardHeader><CardBody className="p-3">
      <OpTable op="document.mine" tableId="docs-mine" columns={COLS} onRowClick={(r) => setOpen(r.id)} rowActions={(r) => <DownloadButton op="document.download" path={{ id: r.id }} filename={r.fileName ?? 'document'} />} /></CardBody></Card>
    {open && <DocDetail id={open} onClose={() => setOpen(null)} />}</>);
}
function Verification() {
  const { t } = useTranslation(); const [open, setOpen] = useState<string | null>(null); const [days, setDays] = useState(30);
  return (<div className="d-grid gap-3">
    <Card><CardHeader><CardTitle>Pending verification</CardTitle></CardHeader><CardBody className="p-3"><OpTable op="document.pending" tableId="docs-pending" columns={[{ key: 'ownerEmployeeId' }, ...COLS]} onRowClick={(r) => setOpen(r.id)}
      rowActions={(r) => <><OpButton op="document.verify" path={{ id: r.id }} label="Verify" icon={<Check size={13} />} variant="success" /><OpButton op="document.reject" path={{ id: r.id }} label={t('common.reject')} icon={<X size={13} />} variant="danger" overrides={DEC} /></>} /></CardBody></Card>
    <Card><CardHeader><CardTitle>Expiring documents</CardTitle><Input type="number" className="w-[90px]" value={days} min={1} onChange={(e) => setDays(Number(e.target.value) || 30)} aria-label="days" /></CardHeader><CardBody className="p-3"><OpTable op="document.expiring" query={{ days }} tableId="docs-expiring" columns={[{ key: 'ownerEmployeeId' }, ...COLS]} onRowClick={(r) => setOpen(r.id)} /></CardBody></Card>
    {open && <DocDetail id={open} onClose={() => setOpen(null)} />}</div>);
}
function EmployeeDocs() {
  const [open, setOpen] = useState<string | null>(null);
  return (<EmployeeScope>{(id) => (<>
    <Card><CardHeader><CardTitle>Employee documents</CardTitle><UploadButton ownerEmployeeId={id} /></CardHeader><CardBody className="p-3"><OpTable op="document.forEmployee" path={{ employeeId: id }} tableId="docs-emp" columns={COLS} onRowClick={(r) => setOpen(r.id)} /></CardBody></Card>
    {open && <DocDetail id={open} onClose={() => setOpen(null)} />}</>)}</EmployeeScope>);
}
export default function DocumentsPage() {
  const { t } = useTranslation(); const p = usePermissions();
  return (
    <>
      <PageHeader title={t('hr.documents.title')} description={t('hr.documents.sub')} icon={<FileText size={20} />} />
      <Tabs tabs={[
        { key: 'mine', label: t('nav.myWorkspace'), hidden: !p.canCall('document.mine'), content: <Mine /> },
        { key: 'verify', label: 'Verification', hidden: !p.canCall('document.pending'), content: <Verification /> },
        { key: 'employee', label: 'Employee documents', hidden: !p.isAdmin, content: <EmployeeDocs /> },
        { key: 'categories', label: 'Categories', content: <CrudSection title="Document categories" list={{ op: 'document.categories' }} create={{ op: 'document.createCategory' }} update={{ op: 'document.updateCategory', path: (r) => ({ id: r.id }) }} dialogSize="lg" /> },
      ]} />
    </>
  );
}
