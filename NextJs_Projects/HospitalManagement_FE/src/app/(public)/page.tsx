import Image from 'next/image';
import Link from 'next/link';
import { CalendarCheck, FlaskConical, Pill, ReceiptText, ShieldCheck, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { getPublicDoctors, getPublicHospitals } from '@/server/cache';
import { APP_NAME } from '@/lib/configuration/public';
import { HospitalCard } from './hospitals/_components/HospitalCard';

/** Static rendering + ISR: pre-rendered at build, regenerated in the background every 5 minutes (and on demand via revalidateTag). */
export const revalidate = 300;
export default async function Home() {
  const [hospitals, doctors] = await Promise.all([getPublicHospitals().catch(() => []), getPublicDoctors().catch(() => [])]); // parallel fetching
  const features = [[CalendarCheck, 'Book appointments', 'Live slots, instant confirmation.'], [Stethoscope, 'Medical records', 'Your history in one secure place.'], [FlaskConical, 'Laboratory', 'Request, track and download reports.'], [Pill, 'Prescriptions & pharmacy', 'Digital prescriptions go straight to the pharmacy.'], [ReceiptText, 'Billing', 'Clear invoices and safe online payment.'], [ShieldCheck, 'Secure by design', 'Role-based access, MFA and audit logging.']] as const;
  return (
    <>
      <section className="relative isolate -mx-4 mb-10 overflow-hidden rounded-2xl sm:mx-0"><Image src="/images/hero-banner.jpg" alt="" fill priority sizes="(max-width:1152px) 100vw, 1152px" quality={75} className="-z-10 object-cover" /><div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/60 to-black/10" /><div className="px-6 py-20 text-white sm:px-10"><h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">Healthcare organised around you</h1><p className="mt-4 max-w-xl text-lg text-white/90">{APP_NAME} connects patients, doctors, laboratory, pharmacy and billing.</p><div className="mt-8 flex flex-wrap gap-3"><Button asChild size="lg"><Link href="/register">Create your account</Link></Button><Button asChild size="lg" variant="outline" className="border-white/60 bg-white/10 text-white hover:bg-white/20"><Link href="/doctors">Find a doctor</Link></Button></div></div></section>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{features.map(([I, t, d]) => <Card key={t}><CardBody><I className="mb-3 size-7 text-primary" /><h3 className="font-semibold">{t}</h3><p className="mt-1 text-sm text-muted">{d}</p></CardBody></Card>)}</div>
      {hospitals.length > 0 && <section className="mt-12"><h2 className="mb-4 text-2xl font-semibold">Our hospitals</h2><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{hospitals.slice(0, 3).map((h, i) => <HospitalCard key={h.id} h={h} priority={i === 0} />)}</div></section>}
      {doctors.length > 0 && <p className="mt-8 text-center text-muted">{doctors.length} specialists available - <Link className="text-primary underline" href="/doctors">browse the directory</Link></p>}
    </>
  );
}
