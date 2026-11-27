import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Briefcase } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { OpTable } from '@/components/tables/OpTable';
import { OpButton } from '@/components/op/OpButton';
import { StatusBadge } from '@/components/common/values';
import { NativeSelect } from '@/components/ui/input';

export default function CustomersPage() {
  const { t } = useTranslation(); const nav = useNavigate(); const [status, setStatus] = useState('');
  return (
    <>
      <PageHeader title={t('hr.customers.title')} description={t('hr.customers.sub')} icon={<Briefcase size={20} />} actions={<OpButton op="project.createCustomers" label={t('common.create')} variant="default" size="md" dialogSize="lg" overrides={{ notes: { rich: true } }} />} />
      <OpTable op="project.listCustomers" tableId="customers" searchParam="q" onRowClick={(r) => nav(`/customers/${r.id}`)} selectable
        columns={[{ key: 'code' }, { key: 'name' }, { key: 'industry' }, { key: 'billingEmail' }, { key: 'paymentTermsDays', defaultHidden: true }, { key: 'creditLimit', defaultHidden: true }, { key: 'status', cell: (r) => <StatusBadge value={r.status} /> }]}
        // the list endpoint has no status filter - filter client side on the loaded page
        pick={(d) => (d?.content ?? []).filter((c: any) => !status || c.status === status)}
        filters={<NativeSelect className="w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t('common.status')}><option value="">{t('common.all')}</option><option>ACTIVE</option><option>INACTIVE</option></NativeSelect>}
        rowActions={(r) => <OpButton op="project.updateCustomers" path={{ id: r.id }} initial={r} label={t('common.edit')} variant="ghost" dialogSize="lg" overrides={{ notes: { rich: true } }} />} />
    </>
  );
}
