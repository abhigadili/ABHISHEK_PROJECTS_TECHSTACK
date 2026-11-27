import Link from 'next/link';
import { Button } from '@/components/ui/Button';
export const metadata = { title: 'Page not found', robots: { index: false } };
/** Rendered for unmatched URLs and whenever a page calls notFound(). */
export default function NotFound() {
  return <div className="mx-auto max-w-lg px-4 py-24 text-center"><p className="text-6xl font-bold text-indigo-600">404</p><h1 className="mt-2 text-xl font-semibold">This page has left the station</h1><p className="mt-1 text-slate-500">The link may be wrong or the page was removed.</p><Button asChild className="mt-6"><Link href="/">Back to search</Link></Button></div>;
}
