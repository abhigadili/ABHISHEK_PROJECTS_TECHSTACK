import type { Metadata } from 'next';
import { Avatar } from '@/components/common/Avatar';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Award, Briefcase, Building2, IndianRupee } from 'lucide-react';
import { getPublicDoctor, getPublicDoctors, getPublicHospital } from '@/lib/api/catalog';
import { Card, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { avatarUrl, formatCurrency } from '@/lib/utilities/format';

export const revalidate = 300;
export const dynamicParams = true;
/** Public doctor profiles: the first 30 are generated at build time, the rest on demand. */
export async function generateStaticParams() { try { return (await getPublicDoctors()).slice(0, 30).map((d) => ({ doctorId: String(d.id) })); } catch { return []; } }

export async function generateMetadata({ params }: PageProps<'/public/doctors/[doctorId]'>): Promise<Metadata> {
  const d = await getPublicDoctor(Number((await params).doctorId)).catch(() => null);
  if (!d) return { title: 'Doctor not found', robots: { index: false } };
  return { title: `${d.fullName} - ${d.specialization}`, description: `${d.fullName}, ${d.specialization}${d.qualification ? ` (${d.qualification})` : ''}${d.experienceYears ? `, ${d.experienceYears} years of experience` : ''}.`, alternates: { canonical: `/public/doctors/${d.id}` }, openGraph: { title: d.fullName, images: [{ url: avatarUrl(d.fullName) }] } };
}

export default async function PublicDoctorPage({ params }: PageProps<'/public/doctors/[doctorId]'>) {
  const id = Number((await params).doctorId);
  if (!Number.isInteger(id)) notFound();
  const d = await getPublicDoctor(id).catch(() => null);
  if (!d || !d.active) notFound();
  const hospital = await getPublicHospital(d.hospitalId).catch(() => null); // dependent fetch: needs hospitalId from the doctor
  return (
    <Card className="mx-auto max-w-3xl"><CardBody className="flex flex-col gap-6 sm:flex-row">
      <Avatar name={d.fullName} size={160} priority />
      <div className="flex-1">
        <h1 className="text-3xl font-bold">{d.fullName}</h1>
        <p className="text-lg text-primary">{d.specialization}</p>
        <ul className="mt-4 space-y-2 text-sm">
          {d.qualification && <li className="flex gap-2"><Award className="size-4 text-primary" />{d.qualification}</li>}
          {d.experienceYears !== null && <li className="flex gap-2"><Briefcase className="size-4 text-primary" />{d.experienceYears} years of experience</li>}
          <li className="flex gap-2"><IndianRupee className="size-4 text-primary" />Consultation fee {formatCurrency(d.consultationFee)}</li>
          {hospital && <li className="flex gap-2"><Building2 className="size-4 text-primary" /><Link className="hover:underline" href={`/public/hospitals/${hospital.id}`}>{hospital.name}</Link></li>}
        </ul>
        <Button asChild className="mt-6"><Link href={`/appointments/book?doctorId=${d.id}`}>Book an appointment</Link></Button>
        <p className="mt-2 text-xs text-muted">Booking requires a free patient account.</p>
      </div>
    </CardBody></Card>
  );
}
