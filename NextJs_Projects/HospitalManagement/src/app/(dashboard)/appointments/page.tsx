import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarPlus } from 'lucide-react';
import { requireSession } from '@/lib/auth/session';
import { patientService } from '@/services/backend/patients';
import { doctorService } from '@/services/backend/doctors';
import { loadOptional, load } from '@/lib/api/guards';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/common/PageHeader';
import { AppointmentsBoard } from '@/features/appointments/AppointmentsBoard';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/empty-state';
import { can } from '@/constants/permissions';

export const metadata: Metadata = { title: 'Appointments' };
/** Server Component resolves WHO is looking (patient id / doctor ids) and hands plain ids to the interactive Client Component. */
export default async function AppointmentsPage() {
  const s = await requireSession('/appointments');
  let scope: 'patient' | 'staff' = 'staff'; let patientId: number | null = null; let doctorIds: number[] = [];
  if (s.role === 'PATIENT') {
    scope = 'patient';
    const me = await loadOptional(patientService.byUser(s.userId));
    if (!me) redirect('/patients/register');
    patientId = me.id;
  } else if (s.role === 'ADMIN' || s.role === 'DOCTOR') {
    const docs = (await load(doctorService.list({ size: 100, active: true }))).content;
    doctorIds = s.role === 'ADMIN' ? docs.slice(0, 40).map((d) => d.id) : docs.filter((d) => d.userId === s.userId).map((d) => d.id);
  } else return <Alert tone="warn">Your role does not have access to appointments.</Alert>;
  return (
    <>
      <PageHeader title="Appointments" description={scope === 'patient' ? 'Your appointment history and upcoming visits.' : 'Appointments across the selected doctors.'} actions={<>{can(s.role, 'appointments:book') && <Button asChild><Link href="/appointments/book"><CalendarPlus className="size-4" />Book appointment</Link></Button>}<Button asChild variant="outline"><Link href="/appointments/availability">Availability</Link></Button></>} />
      <AppointmentsBoard scope={scope} patientId={patientId} doctorIds={doctorIds} />
    </>
  );
}
