import Link from 'next/link';
/** Server Component: no JS shipped. */
export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 py-8 text-sm text-slate-500 dark:border-slate-800">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4">
        <p>Train Ticket Booking · a learning project - payments are simulated, no real money moves.</p>
        <nav className="flex gap-4" aria-label="Footer"><Link href="/trains">Trains</Link><Link href="/stations">Stations</Link><Link href="/help">Help</Link><Link href="/sitemap.xml">Sitemap</Link></nav>
      </div>
    </footer>
  );
}
