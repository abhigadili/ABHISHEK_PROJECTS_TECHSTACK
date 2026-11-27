import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FolderKanban } from 'lucide-react';
import dayjs from 'dayjs';
import { PageHeader } from '@/components/common/PageHeader';
import { OpTable } from '@/components/tables/OpTable';
import { OpButton } from '@/components/op/OpButton';
import { StatusBadge } from '@/components/common/values';
import { NativeSelect } from '@/components/ui/input';
import { useRefOptions } from '@/components/op/refs';
import { ProgressBar, scheduleProgress } from './progress';

export const PROJECT_STATUSES = ['PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];
export default function ProjectsPage() {
  const { t } = useTranslation(); const nav = useNavigate(); const [f, setF] = useState({ status: '', customerId: '' }); const cust = useRefOptions('customer');
  return (
    <>
      <PageHeader title={t('hr.projects.title')} description={t('hr.projects.sub')} icon={<FolderKanban size={20} />} actions={<OpButton op="project.create" label={t('common.create')} variant="default" size="md" dialogSize="lg" overrides={{ description: { rich: true }, billingNotes: { textarea: true } }} />} />
      <OpTable op="project.list" tableId="projects" searchParam="q" query={f} sortable={['name', 'startDate', 'status']} onRowClick={(r) => nav(`/projects/${r.id}`)}
        columns={[{ key: 'code' }, { key: 'name', sortable: true }, { key: 'customerId' }, { key: 'projectManagerId' }, { key: 'status', sortable: true, cell: (r) => <StatusBadge value={r.status} /> }, { key: 'startDate', sortable: true }, { key: 'endDate' },
          { key: 'progress', header: 'Schedule', cell: (r) => <ProgressBar value={scheduleProgress(r.startDate, r.endDate, r.status)} />, exportValue: (r) => `${scheduleProgress(r.startDate, r.endDate, r.status)}%` }, { key: 'budget', defaultHidden: true }, { key: 'billingModel', defaultHidden: true }]}
        filters={<><NativeSelect className="w-auto" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} aria-label={t('common.status')}><option value="">{t('common.status')}</option>{PROJECT_STATUSES.map((s) => <option key={s}>{s}</option>)}</NativeSelect>
          <NativeSelect className="w-auto" value={f.customerId} onChange={(e) => setF({ ...f, customerId: e.target.value })} aria-label="customer"><option value="">{t('fields.customerId')}</option>{cust.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect></>} />
      <span hidden>{dayjs().year()}</span>
    </>
  );
}
