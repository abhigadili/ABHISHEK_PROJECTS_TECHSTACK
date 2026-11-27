import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { History } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { OpTable } from '@/components/tables/OpTable';
import { Input, NativeSelect } from '@/components/ui/input';
import { usePermissions } from '@/hooks/usePermissions';
import { Modal } from '@/components/ui/dialog';
import { Detail } from '@/components/common/Detail';

export const SERVICES = ['auth', 'employee', 'organization', 'leave', 'attendance', 'holiday', 'payroll', 'tax', 'performance', 'project', 'timesheet', 'exit', 'document', 'notification', 'reporting'];
export default function AuditPage() {
  const { t } = useTranslation(); const { canCall } = usePermissions(); const [svc, setSvc] = useState('employee'); const [f, setF] = useState({ entityType: '', entityId: '', action: '' }); const [open, setOpen] = useState<any>(null);
  return (
    <>
      <PageHeader title={t('hr.admin.audit')} description={t('hr.admin.auditSub')} icon={<History size={20} />} />
      <OpTable key={svc} op={`${svc}.searchAudit`} tableId={`audit-${svc}`} query={f} defaultSort="createdAt,desc" onRowClick={setOpen} enabled={canCall(`${svc}.searchAudit`)}
        filters={<>
          <NativeSelect className="w-auto" value={svc} onChange={(e) => setSvc(e.target.value)} aria-label="service">{SERVICES.map((s) => <option key={s}>{s}</option>)}</NativeSelect>
          <Input className="w-[150px]" placeholder="entityType" value={f.entityType} onChange={(e) => setF({ ...f, entityType: e.target.value })} aria-label="entityType" />
          <Input className="w-[180px]" placeholder="entityId" value={f.entityId} onChange={(e) => setF({ ...f, entityId: e.target.value })} aria-label="entityId" />
          <NativeSelect className="w-auto" value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })} aria-label="action"><option value="">action</option>{['CREATE', 'UPDATE', 'DELETE'].map((a) => <option key={a}>{a}</option>)}</NativeSelect></>} />
      <Modal open={!!open} onOpenChange={(o) => !o && setOpen(null)} title="Audit record" size="lg">{open && <><Detail data={open} hide={['oldValue', 'newValue']} cols={2} />{['oldValue', 'newValue'].map((k) => open[k] && <div key={k} className="mt-3"><div className="field-label">{k}</div><pre className="rounded-md bg-surface-2 p-2" style={{ fontSize: 11, whiteSpace: 'pre-wrap' }}>{typeof open[k] === 'string' ? open[k] : JSON.stringify(open[k], null, 2)}</pre></div>)}</>}</Modal>
    </>
  );
}
