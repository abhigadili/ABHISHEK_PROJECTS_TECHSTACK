import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Building2, Layers, Mail, MapPin, Phone } from 'lucide-react';
import { getPublicDepartments, getPublicDoctors, getPublicHospital, getPublicHospitals } from '@/lib/api/catalog';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { hospitalBanner } from '@/features/public/images';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

/** SSG with generateStaticParams: one HTML page per hospital is built at `next build`; new hospitals are rendered on first request (dynamicParams) then cached (ISR). */
export const revalidate = 3600;
export const dynamicParams = true;
export async function generateStaticParams() {
  try { return (await getPublicHospitals()).map((h) => ({ hospitalId: String(h.id) })); } catch { return []; }
}

/** Dynamic metadata: title/description/Open Graph from the record - only public hospital facts, never patient data. */
export async function generateMetadata({ params }: PageProps<'/public/hospitals/[hospitalId]'>): Promise<Metadata> {
  const h = await getPublicHospital(Number((await params).hospitalId)).catch(() => null);
  if (!h) return { title: 'Hospital not found', robots: { index: false } };
  const desc = `${h.name}${h.city ? ` in ${h.city}` : ''} - departments, facilities and contact details.`;
  return { title: h.name, description: desc, alternates: { canonical: `/public/hospitals/${h.id}` }, openGraph: { title: h.name, description: desc, images: [hospitalBanner(h.id)] }, twitter: { card: 'summary_large_image', title: h.name, description: desc } };
}

const FACILITIES = ['Emergency & trauma care', 'Outpatient clinics', 'Diagnostic laboratory', 'In-house pharmacy', 'Online appointment booking'];

export default async function PublicHospitalPage({ params }: PageProps<'/public/hospitals/[hospitalId]'>) {
  const id = Number((await params).hospitalId);
  if (!Number.isInteger(id)) notFound();
  const hospital = await getPublicHospital(id).catch(() => null);
  if (!hospital || !hospital.active) notFound();
  const [departments, doctors] = await Promise.all([getPublicDepartments(id).catch(() => []), getPublicDoctors().catch(() => [])]); // parallel data fetching
  const mine = doctors.filter((d) => d.hospitalId === id);
  return (
    <>
      <div className="relative mb-6 aspect-[16/5] overflow-hidden rounded-2xl"><Image src={hospitalBanner(id)} alt={`${hospital.name} banner`} fill priority sizes="(max-width:1152px) 100vw, 1152px" quality={75} className="object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" /><h1 className="absolute bottom-4 left-5 text-3xl font-bold text-white">{hospital.name}</h1></div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1"><CardHeader><CardTitle>Contact</CardTitle><Badge>{hospital.code}</Badge></CardHeader><CardBody><ul className="space-y-2 text-sm">
          {(hospital.address || hospital.city) && <li className="flex gap-2"><MapPin className="size-4 shrink-0 text-primary" />{[hospital.address, hospital.city].filter(Boolean).join(', ')}</li>}
          {hospital.phone && <li className="flex gap-2"><Phone className="size-4 text-primary" />{hospital.phone}</li>}
          {hospital.email && <li className="flex gap-2"><Mail className="size-4 text-primary" />{hospital.email}</li>}
        </ul></CardBody></Card>
        <Card className="lg:col-span-2"><CardHeader><CardTitle className="flex items-center gap-2"><Layers className="size-4" />Departments</CardTitle></CardHeader><CardBody>
          {departments.filter((d) => d.active).length ? <ul className="grid gap-3 sm:grid-cols-2">{departments.filter((d) => d.active).map((d) => <li key={d.id} className="rounded-lg border border-line p-3"><p className="font-medium">{d.name}</p>{d.description && <p className="text-sm text-muted">{d.description}</p>}</li>)}</ul> : <p className="text-sm text-muted">No departments are listed yet.</p>}
        </CardBody></Card>
        <Card className="lg:col-span-1"><CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="size-4" />Facilities</CardTitle></CardHeader><CardBody><ul className="list-disc space-y-1 pl-5 text-sm">{FACILITIES.map((f) => <li key={f}>{f}</li>)}</ul><p className="mt-3 text-xs text-muted">General facilities; the backend does not store per-hospital facility lists.</p></CardBody></Card>
        <Card className="lg:col-span-2"><CardHeader><CardTitle>Doctors at this hospital</CardTitle></CardHeader><CardBody>{mine.length ? <ul className="grid gap-2 sm:grid-cols-2">{mine.map((d) => <li key={d.id}><Link className="text-primary hover:underline" href={`/public/doctors/${d.id}`}>{d.fullName}</Link> <span className="text-sm text-muted">· {d.specialization}</span></li>)}</ul> : <p className="text-sm text-muted">No doctors are listed for this hospital.</p>}</CardBody></Card>
      </div>
    </>
  );
}
