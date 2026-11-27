import { Suspense } from 'react';
import { requireRole } from '@/server/auth/guard';
import { getPublicHospitals } from '@/server/cache';
import { db } from '@/server/db';
import { PageHeader } from '@/components/common/PageHeader';
import { BookingWizard } from '@/features/appointments/BookingWizard';
import { TableSkeleton } from '@/components/ui/skeleton';
export const metadata = { title: 'Book appointment', robots: { index: false } };
export default async function BookPage() {
  await requireRole(['PATIENT']);
  const hs = await getPublicHospitals(); // public cached list; departments fetched in one query
  const deps = await db.department.findMany({ where: { hospitalId: { in: hs.map((h) => h.id) }, active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, hospitalId: true } });
  return <><PageHeader title="Book an appointment" description="Choose a hospital, department, doctor and a free slot." /><Suspense fallback={<TableSkeleton rows={6} />}><BookingWizard hospitals={hs.map((h) => ({ id: h.id, name: h.name, city: h.city, departments: deps.filter((d) => d.hospitalId === h.id) }))} /></Suspense></>;
}
