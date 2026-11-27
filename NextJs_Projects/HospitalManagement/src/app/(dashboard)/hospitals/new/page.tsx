import { requirePermission } from '@/lib/auth/session';
import { PageHeader } from '@/components/common/PageHeader';
import { HospitalForm } from '@/features/hospitals/HospitalForm';
export const metadata = { title: 'Add hospital' };
export default async function NewHospital() { await requirePermission('hospitals:manage'); return <><PageHeader title="Add hospital" /><HospitalForm /></>; }
