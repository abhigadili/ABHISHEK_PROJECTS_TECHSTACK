import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { PublicChrome } from '@/components/layout/PublicChrome';
import { buttonClass } from '@/components/common/ui';

export const metadata: Metadata = { title: { absolute: 'EMS — Employee Management System' }, alternates: { canonical: '/' } };

const FEATURES = [
  ['People directory', 'Search, filter and share employee lists; open any profile in a dialog or a full page.'],
  ['Attendance & leave', 'Check in, apply for leave and approve requests with live balances.'],
  ['Organization chart', 'Explore the reporting hierarchy built from real manager relationships.'],
  ['Reports', 'Headcount, joiners, leave and attendance reports with CSV export.'],
];

/**
 * PUBLIC landing page — fully static (SSG): no cookies, no request data, so it is prerendered at build time and served from the CDN-able
 * static shell. `priority` on the hero image preloads the LCP element; width/height reserve its space (no layout shift).
 */
export default function Home() {
  return (
    <PublicChrome>
      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 lg:grid-cols-2">
          <div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">One workspace for your people.</h1>
            <p className="mt-4 text-lg text-muted">Employee records, attendance, leave, organization chart and HR reports — secure, role-aware and fast.</p>
            <div className="mt-6 flex flex-wrap gap-3"><Link href="/login" className={buttonClass('primary', 'px-5 py-2.5')}>Sign in</Link><Link href="/register" className={buttonClass('secondary', 'px-5 py-2.5')}>Create an account</Link></div>
          </div>
          <Image src="/images/hero.png" alt="Illustration of an EMS dashboard with cards and charts" width={1200} height={630} priority sizes="(min-width: 1024px) 560px, 100vw" className="h-auto w-full rounded-2xl shadow-xl" />
        </section>
        <section aria-labelledby="features" className="mx-auto max-w-6xl px-4 pb-16">
          <h2 id="features" className="mb-6 text-2xl font-bold">What you can do</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{FEATURES.map(([t, d]) => <article key={t} className="rounded-xl border border-border bg-surface p-5"><h3 className="font-semibold">{t}</h3><p className="mt-1 text-sm text-muted">{d}</p></article>)}</div>
        </section>
      </main>
    </PublicChrome>
  );
}
