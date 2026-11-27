import Link from 'next/link';
import type { Metadata } from 'next';
import { buttonClass } from '@/components/common/ui';

export const metadata: Metadata = { title: 'Page not found', robots: { index: false } };
/** Global 404 (also rendered when a page calls `notFound()` and no closer not-found.tsx exists). */
export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg p-12 text-center">
      <p className="text-6xl font-bold text-primary">404</p>
      <h1 className="mt-2 text-2xl font-bold">We can&apos;t find that page</h1>
      <p className="mt-2 text-muted">It may have moved, or the address may be wrong.</p>
      <Link href="/dashboard" className={buttonClass('primary', 'mt-6')}>Go to the dashboard</Link>
    </main>
  );
}
