import { requireRole } from '@/server/auth/guard';
import { PageHeader } from '@/components/common/PageHeader';
import { StaffAppointmentTable } from '@/features/appointments/StaffAppointmentTable';
export const metadata = { title: 'Appointments', robots: { index: false } };
export default async function Page({ searchParams }: PageProps<'/doctor/appointments'>) { const p = await requireRole(['DOCTOR']); return <><PageHeader title="Appointments" description="Update status, open a consultation." /><StaffAppointmentTable p={p} searchParams={await searchParams} base="/doctor/appointments" detailBase="/doctor/appointments" allow={['CONFIRMED', 'COMPLETED', 'NO_SHOW', 'CANCELLED']} /></>; }
