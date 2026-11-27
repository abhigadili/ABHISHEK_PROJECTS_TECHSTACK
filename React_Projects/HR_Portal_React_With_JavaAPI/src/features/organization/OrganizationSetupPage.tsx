import { useTranslation } from 'react-i18next';
import { Building2, UserCog } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Tabs } from '@/components/ui/tabs';
import { CrudSection } from '@/components/op/CrudSection';
import { OpButton } from '@/components/op/OpButton';
import { OpView } from '@/components/op/OpView';

const crud = (title: string, suffix: string, base: { list: string; create: string; update: string; del: string; get: string }, extra?: (r: any) => React.ReactNode) => (
  <CrudSection title={title} list={{ op: base.list, query: { size: 100 } }} create={{ op: base.create }} update={{ op: base.update, path: (r) => ({ id: r.id }) }}
    remove={{ op: base.del, path: (r) => ({ id: r.id }) }} view={{ op: base.get, path: (r) => ({ id: r.id }) }} tableId={`org-${suffix}`} extraRowActions={extra} />
);
export default function OrganizationSetupPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t('hr.org.setup')} description="Organizations, business units, departments, designations, job grades and locations" icon={<Building2 size={20} />} />
      <Tabs tabs={[
        { key: 'dept', label: t('common.department'), content: <>{crud(t('nav.organization') + ' · ' + t('common.department'), 'dept', { list: 'organization.listDepartments', create: 'organization.createDepartments', update: 'organization.updateDepartments', del: 'organization.deleteDepartments', get: 'organization.getDepartments' },
          (r) => <OpButton op="organization.assignHead" path={{ id: r.id }} label="Head" icon={<UserCog size={13} />} variant="ghost" />)}</> },
        { key: 'desig', label: t('common.designation'), content: crud(t('common.designation'), 'desig', { list: 'organization.listDesignations', create: 'organization.createDesignations', update: 'organization.updateDesignations', del: 'organization.deleteDesignations', get: 'organization.getDesignations' }) },
        { key: 'grade', label: 'Job grades', content: crud('Job grades', 'grade', { list: 'organization.listJobGrades', create: 'organization.createJobGrades', update: 'organization.updateJobGrades', del: 'organization.deleteJobGrades', get: 'organization.getJobGrades' }) },
        { key: 'loc', label: t('common.location'), content: crud(t('common.location'), 'loc', { list: 'organization.listLocations', create: 'organization.createLocations', update: 'organization.updateLocations', del: 'organization.deleteLocations', get: 'organization.getLocations' }) },
        { key: 'bu', label: 'Business units', content: crud('Business units', 'bu', { list: 'organization.listBusinessUnits', create: 'organization.createBusinessUnits', update: 'organization.updateBusinessUnits', del: 'organization.deleteBusinessUnits', get: 'organization.getBusinessUnits' }) },
        { key: 'org', label: 'Organizations', content: crud('Organizations', 'org', { list: 'organization.list', create: 'organization.create', update: 'organization.update', del: 'organization.delete', get: 'organization.get' }) },
        { key: 'hc', label: 'Headcount', content: <OpView op="organization.headcount" /> },
      ]} />
    </>
  );
}
