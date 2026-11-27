import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Pencil, Trash2 } from 'lucide-react';
import { OpView } from '@/components/op/OpView';
import { OpButton } from '@/components/op/OpButton';
import { OpTable } from '@/components/tables/OpTable';
import { CrudSection } from '@/components/op/CrudSection';
import { Tabs } from '@/components/ui/tabs';
import { Card, CardBody } from '@/components/ui/card';
import { Detail } from '@/components/common/Detail';
import { StatusBadge } from '@/components/common/values';
import { SafeHtml } from '@/components/editors/SafeHtml';
import { useOp } from '@/components/op/useOp';
import { ErrorState, LoadingBlock } from '@/components/feedback/states';

export default function CustomerDetailPage() {
  const { id = '' } = useParams(); const { t } = useTranslation(); const nav = useNavigate();
  const q = useOp<any>('project.getCustomers', { path: { id } });
  if (q.isLoading) return <LoadingBlock rows={5} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const c = q.data;
  return (
    <>
      <Card className="mb-3"><CardBody className="d-flex flex-wrap align-items-center gap-3">
        <div className="flex-grow-1"><h1 className="page-title">{c.name} <StatusBadge value={c.status} /></h1><div className="text-muted" style={{ fontSize: 13 }}>{c.code} · {c.industry}</div></div>
        <OpButton op="project.updateCustomers" path={{ id }} initial={c} label={t('common.edit')} icon={<Pencil size={13} />} dialogSize="lg" overrides={{ notes: { rich: true } }} />
        <OpButton op="project.delete" path={{ id }} label={t('common.delete')} icon={<Trash2 size={13} />} onDone={() => nav('/customers')} />
      </CardBody></Card>
      <Tabs tabs={[
        { key: 'overview', label: t('common.overview'), content: <Card><CardBody><Detail data={c} hide={['id', 'notes']} />{c.notes && <div className="mt-3"><div className="field-label">{t('fields.notes')}</div><SafeHtml html={c.notes} /></div>}</CardBody></Card> },
        { key: 'contacts', label: 'Contacts', content: <CrudSection title="Contacts" list={{ op: 'project.contacts', path: { id } }} create={{ op: 'project.addContact', path: { id } }} update={{ op: 'project.updateContact', path: (r) => ({ id, contactId: r.id }) }} remove={{ op: 'project.deleteContact', path: (r) => ({ id, contactId: r.id }) }} /> },
        { key: 'projects', label: t('nav.projects'), content: <OpTable op="project.list" query={{ customerId: id }} tableId="cust-projects" onRowClick={(r) => nav(`/projects/${r.id}`)} columns={[{ key: 'code' }, { key: 'name' }, { key: 'status', cell: (r) => <StatusBadge value={r.status} /> }, { key: 'startDate' }, { key: 'endDate' }, { key: 'budget' }]} /> },
      ]} />
      <span hidden><OpView op="project.getCustomers" path={{ id }} bare enabled={false} /></span>
    </>
  );
}
