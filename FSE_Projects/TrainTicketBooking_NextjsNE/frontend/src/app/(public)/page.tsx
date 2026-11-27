import { Clock, ShieldCheck, Ticket, Wallet } from 'lucide-react';
import Image from 'next/image';
import { RecentSearches } from '@/components/common/RecentSearches';
import { SearchForm } from '@/components/forms/SearchForm';
import { Card, CardBody } from '@/components/ui/Card';
import { getStations } from '@/features/stations/server';

/**
 * STATIC rendering: no cookies/headers/searchParams are read here, so this page is prerendered at build time.
 * The station list it needs comes from the Data Cache (revalidated hourly / on demand via the `stations` tag),
 * so station edits made by an admin show up here without a rebuild (ISR behaviour).
 */
export const revalidate = 3600;
const features = [
  { icon: Ticket, title: 'Instant PNR', text: 'Confirmed seats and a 10-digit PNR the moment payment succeeds.' },
  { icon: Clock, title: 'Segment-aware seats', text: 'A berth freed at an intermediate stop is sold again for the remaining journey.' },
  { icon: Wallet, title: 'Fair refunds', text: 'Cancellation charges follow a transparent, time-based rule table.' },
  { icon: ShieldCheck, title: 'Safe by design', text: 'No card numbers stored - only the last four digits.' },
];
export default async function HomePage() {
  const stations = await getStations().catch(() => []); // build must not fail if the API is down
  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-2xl text-white">
        {/* next/image: priority (LCP image), responsive `sizes`, AVIF/WebP negotiated by the optimizer */}
        <Image src="/images/hero-train.jpg" alt="" fill priority sizes="(max-width: 1152px) 100vw, 1152px" className="object-cover" />
        <div className="absolute inset-0 bg-indigo-950/55" />
        <div className="relative p-8 md:p-12">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Where to next?</h1><p className="mt-1 text-indigo-100">Search trains, pick your seats and pay in under two minutes.</p>
          <Card className="mt-6 border-0 text-slate-900 dark:text-slate-100"><CardBody><SearchForm stations={stations} /></CardBody></Card>
        </div>
      </section>
      <RecentSearches />
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map(({ icon: I, title, text }) => <Card key={title}><CardBody><I className="text-indigo-600" /><h2 className="mt-3 font-semibold">{title}</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{text}</p></CardBody></Card>)}
      </section>
    </div>
  );
}
