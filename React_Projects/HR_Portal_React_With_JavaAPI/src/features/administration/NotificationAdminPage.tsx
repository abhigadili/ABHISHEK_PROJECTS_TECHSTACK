import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, Send } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Tabs } from '@/components/ui/tabs';
import { CrudSection } from '@/components/op/CrudSection';
import { OpView } from '@/components/op/OpView';
import { OpTable } from '@/components/tables/OpTable';
import { OpButton } from '@/components/op/OpButton';
import { Input } from '@/components/ui/input';
import { SafeHtml } from '@/components/editors/SafeHtml';
import { StatusBadge } from '@/components/common/values';
import { usePermissions } from '@/hooks/usePermissions';

const TPL = { bodyTemplate: { rich: true } };
export default function NotificationAdminPage() {
  const { t } = useTranslation(); const p = usePermissions(); const [f, setF] = useState({ employeeId: '', type: '', status: '' }); const [ev, setEv] = useState({ topic: '', employeeId: '' });
  return (
    <>
      <PageHeader title={t('hr.admin.notifications')} description={t('hr.admin.notificationsSub')} icon={<Mail size={20} />} actions={<OpButton op="notification.send" label="Send notification" icon={<Send size={14} />} variant="default" size="md" dialogSize="lg" overrides={{ message: { rich: true }, channels: { options: ['EMAIL', 'IN_APP'].map((v) => ({ value: v, label: v })) } }} />} />
      <Tabs tabs={[
        { key: 'templates', label: 'Templates', content: <CrudSection title="Notification templates" list={{ op: 'notification.templates' }} create={{ op: 'notification.createTemplate', overrides: TPL }} update={{ op: 'notification.updateTemplate', path: (r) => ({ id: r.id }), overrides: TPL }} dialogSize="xl" tableId="tpl"
          columns={[{ key: 'code' }, { key: 'subjectTemplate' }, { key: 'bodyTemplate', cell: (r) => <span className="line-clamp-1" style={{ maxWidth: 320, display: 'inline-block' }}><SafeHtml html={r.bodyTemplate} /></span> }, { key: 'active' }]} /> },
        { key: 'email', label: 'E-mail settings', content: <OpView op="notification.emailSettings" title="Outgoing e-mail" actions={<OpButton op="notification.updateEmailSettings" label={t('common.edit')} variant="default" />} /> },
        { key: 'history', label: 'Delivery history', content: <OpTable op="notification.history" tableId="notif-hist" query={f} columns={[{ key: 'recipientEmployeeId' }, { key: 'type' }, { key: 'channel' }, { key: 'subject' }, { key: 'status', cell: (r) => <StatusBadge value={r.status} /> }, { key: 'sentAt' }, { key: 'createdAt', defaultHidden: true }]}
          filters={<><Input className="w-[170px]" placeholder="employeeId" value={f.employeeId} onChange={(e) => setF({ ...f, employeeId: e.target.value })} aria-label="employeeId" /><Input className="w-[130px]" placeholder="type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} aria-label="type" /><Input className="w-[120px]" placeholder="status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} aria-label="status" /></>} /> },
        { key: 'events', label: 'Kafka events', hidden: !p.isAdmin, content: <div className="d-grid gap-3"><OpView op="notification.topics" title="Kafka topics" />
          <OpTable op="notification.eventHistory" tableId="event-hist" query={ev} filters={<><Input className="w-[220px]" placeholder="topic" value={ev.topic} onChange={(e) => setEv({ ...ev, topic: e.target.value })} aria-label="topic" /><Input className="w-[180px]" placeholder="employeeId" value={ev.employeeId} onChange={(e) => setEv({ ...ev, employeeId: e.target.value })} aria-label="employeeId" /></>} /></div> },
      ]} />
    </>
  );
}
