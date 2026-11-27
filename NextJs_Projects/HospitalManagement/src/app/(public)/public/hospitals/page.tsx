import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Building2, Mail, MapPin, Phone } from 'lucide-react';
import { getPublicHospitals } from '@/lib/api/catalog';
import { Card, CardBody } from '@/components/ui/card';
import { ErrorState, EmptyState } from '@/components/ui/empty-state';
import { hospitalBanner } from '@/features/public/images';

/**
 * ISR (Incremental Static Regeneration): pre-rendered at build time, regenerated in the background at most every hour
 * (`revalidate`), or immediately when an admin edits a hospital (revalidateTag('hospitals') / revalidatePath in the Server Action).
 */
export const revalidate = 3600; // Route Segment Config
export const metadata: Metadata = { title: 'Hospitals', description: 'Our hospitals, addresses and contact details.', alternates: { canonical: '/public/hospitals' } };

export default async function PublicHospitals() {
  let hospitals;
  try { hospitals = await getPublicHospitals(); } catch (e) { return <ErrorState title="Hospital information is temporarily unavailable" message={e instanceof Error ? e.message : undefined} />; }
  const active = hospitals.filter((h) => h.active);
  return (
    <>
      <h1 className="text-3xl font-bold">Our hospitals</h1>
      <p className="mt-1 text-muted">Public information, refreshed hourly (ISR).</p>
      {active.length === 0 ? <div className="mt-6"><EmptyState title="No hospitals published yet" /></div> : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((h, i) => (
            <Link key={h.id} href={`/public/hospitals/${h.id}`} className="group">
              <Card className="h-full overflow-hidden transition-shadow group-hover:shadow-md">
                <div className="relative aspect-[16/6]"><Image src={hospitalBanner(h.id)} alt={`${h.name} banner`} fill sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw" quality={60} priority={i === 0} className="object-cover" /></div>
                <CardBody>
                  <h2 className="flex items-center gap-2 font-semibold"><Building2 className="size-4 text-primary" />{h.name}</h2>
                  <ul className="mt-3 space-y-1 text-sm text-muted">
                    {(h.address || h.city) && <li className="flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0" />{[h.address, h.city].filter(Boolean).join(', ')}</li>}
                    {h.phone && <li className="flex gap-2"><Phone className="size-4 shrink-0" />{h.phone}</li>}
                    {h.email && <li className="flex gap-2"><Mail className="size-4 shrink-0" />{h.email}</li>}
                  </ul>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
