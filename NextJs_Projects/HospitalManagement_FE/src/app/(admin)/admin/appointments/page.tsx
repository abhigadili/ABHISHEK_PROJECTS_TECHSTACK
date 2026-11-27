import { requireRole } from '@/server/auth/guard';
import { PageHeader } from '@/components/common/PageHeader';
import { StaffAppointmentTable } from '@/features/appointments/StaffAppointmentTable';
import { RemindersButton } from '@/features/notifications/RemindersButton';
export const metadata = { title: 'Appointments', robots: { index: false } };
export default async function Page({ searchParams }: PageProps<'/admin/appointments'>) { const p = await requireRole(['HOSPITAL_ADMIN', 'RECEPTIONIST']); return <><PageHeader title="Appointments" description="All appointments of your hospital." actions={<RemindersButton />} /><StaffAppointmentTable p={p} searchParams={await searchParams} base="/admin/appointments" allow={['CONFIRMED', 'NO_SHOW', 'CANCELLED']} /></>; }
