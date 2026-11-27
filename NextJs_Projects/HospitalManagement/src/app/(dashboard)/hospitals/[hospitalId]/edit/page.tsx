import { requirePermission } from '@/lib/auth/session';
import { hospitalService } from '@/services/backend/hospitals';
import { load, parseId } from '@/lib/api/guards';
import { PageHeader } from '@/components/common/PageHeader';
import { HospitalForm } from '@/features/hospitals/HospitalForm';
export const metadata = { title: 'Edit hospital' };
export default async function EditHospital({ params }: PageProps<'/hospitals/[hospitalId]/edit'>) {
  await requirePermission('hospitals:manage');
  const h = await load(hospitalService.get(parseId((await params).hospitalId)));
  return <><PageHeader title={`Edit ${h.name}`} /><HospitalForm hospital={h} /></>;
}
