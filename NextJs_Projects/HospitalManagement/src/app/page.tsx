import Image from 'next/image';
import Link from 'next/link';
import { CalendarCheck, FlaskConical, Pill, ReceiptText, ShieldCheck, Stethoscope } from 'lucide-react';
import { PublicFooter, PublicHeader } from '@/components/layouts/PublicHeader';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { APP_NAME } from '@/lib/config/public';

/** Static Rendering (SSG): no request-time data, so `next build` pre-renders this page once. Hero uses next/image with `priority` (LCP). */
export default function Home() {
  const features = [
    [CalendarCheck, 'Book appointments', 'Pick a doctor, see live free slots and confirm in seconds.'],
    [Stethoscope, 'Medical records', 'Diagnoses, visits and lab reports in one timeline.'],
    [FlaskConical, 'Laboratory', 'Request tests, track samples and download reports.'],
    [Pill, 'Prescriptions & pharmacy', 'Digital prescriptions flow straight to the pharmacy.'],
    [ReceiptText, 'Billing', 'Clear invoices, outstanding balances and payment history.'],
    [ShieldCheck, 'Secure by design', 'Role-based access; sensitive data is never cached or indexed.'],
  ] as const;
  return (
    <>
      <PublicHeader />
      <main>
        <section className="relative isolate overflow-hidden">
          <Image src="/images/hero-banner.jpg" alt="" fill priority sizes="100vw" quality={75} className="-z-10 object-cover" placeholder="empty" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/60 to-black/10" />
          <div className="mx-auto max-w-6xl px-4 py-24 text-white">
            <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">Healthcare that is organised around you</h1>
            <p className="mt-4 max-w-xl text-lg text-white/90">{APP_NAME} connects patients, doctors, laboratory, pharmacy and billing in one secure place.</p>
            <div className="mt-8 flex flex-wrap gap-3"><Button asChild size="lg"><Link href="/register">Create your account</Link></Button><Button asChild size="lg" variant="outline" className="border-white/60 bg-white/10 text-white hover:bg-white/20"><Link href="/public/doctors">Meet our doctors</Link></Button></div>
          </div>
        </section>
        <section className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-2xl font-semibold">Everything in one place</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(([Icon, t, d]) => <Card key={t}><CardBody><Icon className="mb-3 size-7 text-primary" /><h3 className="font-semibold">{t}</h3><p className="mt-1 text-sm text-muted">{d}</p></CardBody></Card>)}
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
