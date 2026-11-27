import type { Metadata } from 'next';
import { getPublicDoctors, getSpecializations } from '@/server/cache';
import { DoctorDirectory } from '@/components/public/DoctorDirectory';
import { ErrorState } from '@/components/ui/empty-state';
export const revalidate = 300;
export const metadata: Metadata = { title: 'Doctors', description: 'Browse our specialists by name and specialization.', alternates: { canonical: '/doctors' } };
export default async function Doctors() {
  let data: [Awaited<ReturnType<typeof getPublicDoctors>>, string[]] | null = null;
  try { const [d, s] = await Promise.all([getPublicDoctors(), getSpecializations()]); data = [d, s.map((x) => x.name)]; } catch { /* handled below */ }
  if (!data) return <ErrorState title="The doctor directory is temporarily unavailable" />;
  return <><h1 className="text-3xl font-bold">Our doctors</h1><p className="mt-1 text-muted">Server-rendered with ISR; search and filters run in your browser.</p><DoctorDirectory specializations={data[1]} doctors={data[0].map((d) => ({ id: d.id, name: `Dr. ${d.user.firstName} ${d.user.lastName}`, specialization: d.specialization.name, qualifications: d.qualifications, experienceYears: d.experienceYears, fee: Number(d.consultationFee) }))} /></>;
}
