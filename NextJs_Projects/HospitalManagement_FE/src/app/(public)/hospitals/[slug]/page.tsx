import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Clock, Layers, Mail, MapPin, Phone } from 'lucide-react';
import { getPublicHospital, getPublicHospitals } from '@/server/cache';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { banner } from '../_components/HospitalCard';

/** SSG: one static page per hospital at build time (generateStaticParams); unknown slugs render on first request then are cached (ISR). */
export const revalidate = 300;
export const dynamicParams = true;
export async function generateStaticParams() { try { return (await getPublicHospitals()).map((h) => ({ slug: h.slug })); } catch { return []; } }
/** Dynamic metadata from the record - public facts only. */
export async function generateMetadata({ params }: PageProps<'/hospitals/[slug]'>): Promise<Metadata> {
  const h = await getPublicHospital((await params).slug).catch(() => null);
  if (!h) return { title: 'Hospital not found', robots: { index: false } };
  const d = `${h.name}${h.city ? ' in ' + h.city : ''} - departments, facilities and opening hours.`;
  return { title: h.name, description: d, alternates: { canonical: `/hospitals/${h.slug}` }, openGraph: { title: h.name, description: d, images: [banner(h.id)] }, twitter: { card: 'summary_large_image', title: h.name, description: d } };
}
export default async function HospitalPage({ params }: PageProps<'/hospitals/[slug]'>) {
  const h = await getPublicHospital((await params).slug).catch(() => null);
  if (!h) notFound();
  const facilities = (h.facilities as string[] | null) ?? []; const hours = (h.operatingHours as { text?: string } | null)?.text;
  return (
    <>
      <div className="relative mb-6 aspect-[16/5] overflow-hidden rounded-2xl"><Image src={banner(h.id)} alt={`${h.name} banner`} fill priority sizes="(max-width:1152px) 100vw, 1152px" quality={75} className="object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" /><h1 className="absolute bottom-4 left-5 text-3xl font-bold text-white">{h.name}</h1></div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card><CardHeader><CardTitle>Contact</CardTitle></CardHeader><CardBody><ul className="space-y-2 text-sm">{h.address && <li className="flex gap-2"><MapPin className="size-4 text-primary" />{h.address}</li>}{h.phone && <li className="flex gap-2"><Phone className="size-4 text-primary" />{h.phone}</li>}{h.email && <li className="flex gap-2"><Mail className="size-4 text-primary" />{h.email}</li>}{hours && <li className="flex gap-2"><Clock className="size-4 text-primary" />{hours}</li>}</ul><Button asChild className="mt-4 w-full"><Link href={`/register`}>Register to book</Link></Button></CardBody></Card>
        <Card className="lg:col-span-2"><CardHeader><CardTitle className="flex items-center gap-2"><Layers className="size-4" />Departments</CardTitle></CardHeader><CardBody><p className="mb-4 text-sm text-muted">{h.description}</p><ul className="grid gap-2 sm:grid-cols-2">{h.departments.map((d) => <li key={d.id} className="rounded-lg border border-line p-3 text-sm font-medium">{d.name}</li>)}</ul></CardBody></Card>
        <Card className="lg:col-span-2"><CardHeader><CardTitle>Facilities</CardTitle></CardHeader><CardBody><ul className="flex flex-wrap gap-2">{facilities.map((f) => <li key={f} className="rounded-full bg-surface2 px-3 py-1 text-sm">{f}</li>)}</ul></CardBody></Card>
        {h.branches.length > 0 && <Card><CardHeader><CardTitle>Branches</CardTitle></CardHeader><CardBody><ul className="space-y-1 text-sm">{h.branches.map((b) => <li key={b.id}><Link className="text-primary hover:underline" href={`/hospitals/${b.slug}`}>{b.name}</Link></li>)}</ul></CardBody></Card>}
      </div>
    </>
  );
}
