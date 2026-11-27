import type { Metadata } from 'next';
import { getPublicDoctors, getPublicSpecializations } from '@/lib/api/catalog';
import { DoctorDirectory } from '@/features/public/DoctorDirectory';
import { ErrorState } from '@/components/ui/empty-state';

/** ISR: the public doctor directory is regenerated at most every 5 minutes, and instantly when a doctor is edited (revalidateTag('doctors')). */
export const revalidate = 300;
export const metadata: Metadata = { title: 'Our doctors', description: 'Browse our specialists by name and specialization.', alternates: { canonical: '/public/doctors' } };

export default async function PublicDoctors() {
  let data: { doctors: Awaited<ReturnType<typeof getPublicDoctors>>; specs: string[] } | null = null;
  let failure: string | null = null;
  try {
    const [doctors, specs] = await Promise.all([getPublicDoctors(), getPublicSpecializations()]); // parallel data fetching
    data = { doctors, specs };
  } catch (e) { failure = e instanceof Error ? e.message : 'unavailable'; }
  if (!data) return <ErrorState title="The doctor directory is temporarily unavailable" message={failure ?? undefined} />;
  return (<><h1 className="text-3xl font-bold">Our doctors</h1><p className="mt-1 text-muted">Server-rendered with ISR; search and filters run in your browser.</p><DoctorDirectory doctors={data.doctors} specializations={data.specs} /></>);
}
