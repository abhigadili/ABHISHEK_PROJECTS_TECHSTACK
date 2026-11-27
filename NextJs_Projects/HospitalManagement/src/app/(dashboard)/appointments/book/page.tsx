import type { Metadata } from 'next';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { requirePermission } from '@/lib/auth/session';
import { patientService } from '@/services/backend/patients';
import { loadOptional } from '@/lib/api/guards';
import { PageHeader } from '@/components/common/PageHeader';
import { BookingWizard } from '@/features/appointments/BookingWizard';
import { TableSkeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Book appointment' };
export default async function BookPage() {
  const s = await requirePermission('appointments:book');
  let fixed = null;
  if (s.role === 'PATIENT') { fixed = await loadOptional(patientService.byUser(s.userId)); if (!fixed) redirect('/patients/register'); }
  return (
    <>
      <PageHeader title="Book an appointment" description="Find a doctor, pick a free slot and confirm." />
      {/* useSearchParams() inside the wizard requires a Suspense boundary */}
      <Suspense fallback={<TableSkeleton rows={6} />}><BookingWizard fixedPatient={fixed} isStaff={s.role === 'ADMIN'} /></Suspense>
    </>
  );
}
