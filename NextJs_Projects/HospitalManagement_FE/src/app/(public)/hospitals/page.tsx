import type { Metadata } from 'next';
import { getPublicHospitals } from '@/server/cache';
import { EmptyState } from '@/components/ui/empty-state';
import { HospitalCard } from './_components/HospitalCard';
/** ISR: static HTML regenerated at most every 5 minutes; admin edits trigger revalidateTag('hospitals') for instant refresh. */
export const revalidate = 300;
export const metadata: Metadata = { title: 'Hospitals', description: 'Our hospitals, branches and contact details.', alternates: { canonical: '/hospitals' } };
export default async function Hospitals() {
  const hospitals = await getPublicHospitals().catch(() => []);
  return <><h1 className="text-3xl font-bold">Our hospitals</h1><p className="mt-1 text-muted">Public information, cached and refreshed every 5 minutes (ISR).</p>{hospitals.length === 0 ? <div className="mt-6"><EmptyState title="No hospitals published yet" /></div> : <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{hospitals.map((h, i) => <HospitalCard key={h.id} h={h} priority={i === 0} />)}</div>}</>;
}
